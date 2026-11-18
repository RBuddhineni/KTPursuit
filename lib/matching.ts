/**
 * KTPursuit match score
 * =====================
 * Every recommended role gets a 0–100% score built from four parts:
 *
 *   final = 100 × ( 0.40 × skills      how many of the job's skills you already have
 *                 + 0.20 × interest    is it in a field you said you want?
 *                 + 0.15 × level       is it right for your class year?
 *                 + 0.25 × ai )        the AI's holistic judgment of your resume vs. the job
 *
 * Before scoring, we FILTER OUT roles that don't make sense for you at all:
 *   - wrong role type (you asked for internships, it's full-time, or vice versa)
 *   - wrong level (current students only see internships; full-time entry-level roles are
 *     for seniors, grad students and new grads; mid/senior roles are never shown)
 *   - programs restricted to other class years (e.g. a freshman/sophomore-only program)
 *   - fields you didn't pick
 * We use class year, never age.
 *
 * To keep the AI call fast and cheap, only the top candidates (by the first three parts)
 * are sent to the AI, all in a single request.
 */
import type { Job, Match, Preferences, Profile } from "@/lib/schemas";

export const WEIGHTS = { skills: 0.4, interest: 0.2, level: 0.15, ai: 0.25 };
const AI_CANDIDATES = 15; // how many top roles the AI judges
const LOCATION_MISS_PENALTY = 0.9; // ×0.9 if the job isn't where you want and isn't remote-OK

// ---------- 1. Skills overlap ----------

// Different spellings of the same skill.
const SKILL_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  "c plus plus": "c++",
  cpp: "c++",
  golang: "go",
  ml: "machine learning",
  ai: "machine learning",
  sklearn: "scikit-learn",
  "node": "node.js",
  nodejs: "node.js",
  reactjs: "react",
  "react.js": "react",
  postgres: "sql",
  postgresql: "sql",
  mysql: "sql",
  "amazon web services": "aws",
  "ux research": "user research",
  stats: "statistics",
};

export function normalizeSkill(s: string) {
  const k = s.toLowerCase().trim();
  return SKILL_ALIASES[k] ?? k;
}

/**
 * Required skills count for 80% of the skills score, nice-to-haves for 20%.
 * Returns 0–1 plus the lists shown as chips on each card.
 */
export function skillsOverlap(profileSkills: string[], job: Job) {
  const have = new Set(profileSkills.map(normalizeSkill));
  const matched: string[] = [];
  const missing: string[] = [];
  let req = 0;
  let nice = 0;
  for (const s of job.requiredSkills) {
    if (have.has(normalizeSkill(s))) { req++; matched.push(s); } else missing.push(s);
  }
  for (const s of job.niceToHaveSkills) {
    if (have.has(normalizeSkill(s))) { nice++; matched.push(s); }
  }
  const reqScore = job.requiredSkills.length ? req / job.requiredSkills.length : 1;
  const niceScore = job.niceToHaveSkills.length ? nice / job.niceToHaveSkills.length : 0;
  return { score: 0.8 * reqScore + 0.2 * niceScore, matched, missing };
}

// ---------- 2. Interest / category ----------

/** 1 = a field you picked, 0.6 = matches your "Other" text, 0 = not interested. */
export function interestScore(job: Job, prefs: Preferences) {
  if (prefs.categories.includes(job.category)) return 1;
  const words = prefs.otherInterest.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
  const hay = `${job.title} ${job.description}`.toLowerCase();
  if (words.some((w) => hay.includes(w))) return 0.6;
  // Nothing picked at all: everything is fair game.
  if (prefs.categories.length === 0 && !prefs.otherInterest.trim()) return 0.5;
  return 0;
}

// ---------- 3. Level fit (class year) ----------

/** Returns null if the job should be hidden, else 0–1. */
export function levelScore(job: Job, prefs: Preferences): number | null {
  const year = prefs.classYear;
  const isStudent = year !== "new_grad";

  if (prefs.roleType !== "either" && job.type !== prefs.roleType) return null;
  if (job.level === "mid" || job.level === "senior") return null;
  if (job.level === "intern" && !isStudent) return null; // new grads don't intern
  if (job.level === "entry" && !["senior", "grad", "new_grad"].includes(year)) return null;

  if (job.targetYears) {
    // Program built for specific years: perfect fit if you're one, hidden otherwise.
    return job.targetYears.includes(year) ? 1 : null;
  }
  // Open to all students: juniors+ are the typical intern pool, underclassmen still eligible.
  if (job.level === "intern") return year === "freshman" || year === "sophomore" ? 0.7 : 1;
  return 1;
}

function locationOk(job: Job, prefs: Preferences) {
  const want = prefs.location.trim().toLowerCase();
  if (!want) return true;
  if (job.remote && prefs.remoteOk) return true;
  return job.location.toLowerCase().includes(want);
}

// ---------- Put it together ----------

type Judge = (jobs: Job[]) => Promise<Map<string, { fit: number; reason: string }>>;

export async function rankJobs(profile: Profile, prefs: Preferences, jobs: Job[], judge: Judge): Promise<Match[]> {
  // Step 1: filter + score the parts that don't need AI.
  const candidates = jobs.flatMap((job) => {
    const level = levelScore(job, prefs);
    const interest = interestScore(job, prefs);
    if (level === null || interest === 0) return [];
    const skills = skillsOverlap(profile.skills, job);
    const pre =
      (WEIGHTS.skills * skills.score + WEIGHTS.interest * interest + WEIGHTS.level * level) /
      (WEIGHTS.skills + WEIGHTS.interest + WEIGHTS.level);
    return [{ job, level, interest, skills, pre }];
  });

  // Step 2: AI judges the top candidates in one batch.
  const top = candidates.sort((a, b) => b.pre - a.pre).slice(0, AI_CANDIDATES);
  const fits = await judge(top.map((c) => c.job));

  // Step 3: combine.
  return top
    .map(({ job, level, interest, skills }) => {
      const fit = fits.get(job.id);
      const ai = (fit?.fit ?? 50) / 100;
      let score =
        100 * (WEIGHTS.skills * skills.score + WEIGHTS.interest * interest + WEIGHTS.level * level + WEIGHTS.ai * ai);
      if (!locationOk(job, prefs)) score *= LOCATION_MISS_PENALTY;
      return {
        job,
        score: Math.round(score),
        breakdown: { skills: skills.score, interest, level, ai },
        matchedSkills: skills.matched,
        missingSkills: skills.missing,
        reason: fit?.reason ?? "",
      };
    })
    .sort((a, b) => b.score - a.score);
}
