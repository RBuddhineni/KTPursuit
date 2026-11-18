// Shared data shapes. zod gives us both TypeScript types and runtime validation
// (we validate everything the AI returns and everything the browser sends).
import { z } from "zod";

// Vercel serverless functions reject request bodies over 4.5 MB, so that's our real upload cap.
export const MAX_RESUME_BYTES = 4.5 * 1024 * 1024;

export const CATEGORIES = [
  "Software Engineering",
  "Data Science",
  "ML/AI",
  "Product Management",
  "UX/UI Design",
  "Quant",
  "Consulting",
  "Cybersecurity",
] as const;
export const Category = z.enum(CATEGORIES);
export type Category = z.infer<typeof Category>;

export const CLASS_YEARS = ["freshman", "sophomore", "junior", "senior", "grad", "new_grad"] as const;
export const ClassYear = z.enum(CLASS_YEARS);
export type ClassYear = z.infer<typeof ClassYear>;
export const CLASS_YEAR_LABELS: Record<ClassYear, string> = {
  freshman: "Freshman",
  sophomore: "Sophomore",
  junior: "Junior",
  senior: "Senior",
  grad: "Grad student",
  new_grad: "New grad",
};

export const RoleType = z.enum(["internship", "full-time", "either"]);
export type RoleType = z.infer<typeof RoleType>;

/** What the student picks on /upload. */
export const Preferences = z.object({
  categories: z.array(Category),
  otherInterest: z.string().default(""),
  classYear: ClassYear,
  roleType: RoleType,
  location: z.string().default(""),
  remoteOk: z.boolean().default(true),
});
export type Preferences = z.infer<typeof Preferences>;

/** What the AI extracts from the resume (and the user can edit on /review). */
export const Profile = z.object({
  name: z.string(),
  major: z.string(),
  school: z.string(),
  gradYear: z.string(),
  skills: z.array(z.string()),
  experiences: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      dates: z.string(),
      summary: z.string(),
    }),
  ),
  // How deep their experience is, independent of class year.
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]),
});
export type Profile = z.infer<typeof Profile>;

export const JobLevel = z.enum(["intern", "entry", "mid", "senior"]);
export const Job = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  remote: z.boolean(),
  type: z.enum(["internship", "full-time"]),
  category: Category,
  level: JobLevel,
  // Some programs only take certain years (e.g. Google STEP = freshman/sophomore).
  targetYears: z.array(ClassYear).optional(),
  requiredSkills: z.array(z.string()),
  niceToHaveSkills: z.array(z.string()),
  description: z.string(),
  url: z.string(),
});
export type Job = z.infer<typeof Job>;

export type Match = {
  job: Job;
  score: number; // final 0–100
  breakdown: { skills: number; interest: number; level: number; ai: number }; // each 0–1
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
};

export const Alumnus = z.object({
  id: z.string(),
  name: z.string(),
  ktpClass: z.string(),
  gradYear: z.number(),
  major: z.string(),
  email: z.string(),
  linkedin: z.string(),
  experiences: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      type: z.enum(["internship", "full-time"]),
      startYear: z.number(),
      endYear: z.number().nullable(),
    }),
  ),
});
export type Alumnus = z.infer<typeof Alumnus>;
