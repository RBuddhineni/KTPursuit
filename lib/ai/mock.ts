// Fallbacks used when ANTHROPIC_API_KEY is missing, so the whole flow works locally.
import type { Job, Profile } from "@/lib/schemas";
import { skillsOverlap } from "@/lib/matching";

// Skills we can spot with a simple keyword scan of the resume text.
const KNOWN_SKILLS = [
  "Python", "Java", "JavaScript", "TypeScript", "C++", "C", "Go", "SQL", "R", "React", "Node.js",
  "Next.js", "HTML", "CSS", "Git", "AWS", "Docker", "Linux", "PyTorch", "TensorFlow",
  "scikit-learn", "Pandas", "NumPy", "Machine Learning", "Statistics", "Tableau", "Excel",
  "Figma", "User Research", "Prototyping", "Product Strategy", "Agile", "Swift", "Kotlin",
  "Networking", "Cryptography", "Data Structures", "Algorithms", "Probability",
];

export function mockProfile(resumeText: string): Profile {
  const lower = resumeText.toLowerCase();
  const skills = KNOWN_SKILLS.filter((s) => {
    const k = s.toLowerCase();
    return k.length <= 2 ? new RegExp(`\\b${k.replace("+", "\\+")}\\b`).test(lower) : lower.includes(k);
  });
  const firstLine = resumeText.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  return {
    name: firstLine.length < 40 ? firstLine : "",
    major: lower.includes("computer science") ? "Computer Science" : "",
    school: lower.includes("michigan") ? "University of Michigan" : "",
    gradYear: resumeText.match(/20[2-3]\d/)?.[0] ?? "",
    skills: skills.length ? skills : ["Python", "Git"],
    experiences: [],
    experienceLevel: "intermediate",
  };
}

export function mockFit(profile: Profile, jobs: Job[]) {
  return new Map(
    jobs.map((job) => {
      const { score, matched } = skillsOverlap(profile.skills, job);
      return [
        job.id,
        {
          fit: Math.round(45 + 50 * score),
          reason: matched.length
            ? `Your experience with ${matched.slice(0, 3).join(", ")} lines up with what ${job.company} is asking for. (Mock explanation: no API key set.)`
            : `This role is in a field you picked, but your resume doesn't show its core skills yet. (Mock explanation: no API key set.)`,
        },
      ];
    }),
  );
}
