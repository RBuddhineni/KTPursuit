// All AI prompts live here so they're easy to tweak.
import type { Job, Preferences, Profile } from "@/lib/schemas";

export const PROFILE_SYSTEM = `You extract structured profiles from student resumes for a recruiting tool.
Rules:
- Only use information present in the resume. Use "" for anything missing.
- skills: concrete technical and professional skills (languages, frameworks, tools, methods), normalized to common names (e.g. "JavaScript", "React", "SQL", "Figma"). 5–25 items, no duplicates.
- experiences: jobs, internships, research, and significant projects or leadership roles. summary is one short sentence.
- experienceLevel: "beginner" (coursework/projects only), "intermediate" (1–2 internships or substantial projects), "advanced" (multiple internships or full-time experience).
- Never infer or mention age, gender, ethnicity, or other personal characteristics.`;

export function profileUserPrompt(resumeText: string) {
  return `Extract the profile from this resume:\n\n<resume>\n${resumeText}\n</resume>`;
}

export const FIT_SYSTEM = `You are a career advisor for university students. For each job, judge how well the candidate fits it.
- fit: integer 0–100. Consider relevant skills (including transferable ones), past experience, and whether the role suits their class year.
- reason: 1–2 sentences written directly to the student ("Your ..."), specific to their background. No fluff.
Return one entry for every job id given.`;

export function fitUserPrompt(profile: Profile, prefs: Preferences, jobs: Job[]) {
  const candidate = {
    major: profile.major,
    classYear: prefs.classYear,
    experienceLevel: profile.experienceLevel,
    skills: profile.skills,
    experiences: profile.experiences.map((e) => `${e.title} at ${e.company}: ${e.summary}`),
    interests: [...prefs.categories, prefs.otherInterest].filter(Boolean),
  };
  const jobList = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    type: j.type,
    requiredSkills: j.requiredSkills,
    niceToHaveSkills: j.niceToHaveSkills,
    description: j.description,
  }));
  return `<candidate>\n${JSON.stringify(candidate, null, 2)}\n</candidate>\n\n<jobs>\n${JSON.stringify(jobList, null, 2)}\n</jobs>`;
}
