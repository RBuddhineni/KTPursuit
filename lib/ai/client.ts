// Thin wrapper around the Anthropic SDK. Server-only (reads ANTHROPIC_API_KEY).
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Job, Preferences, Profile as ProfileT } from "@/lib/schemas";
import { Profile } from "@/lib/schemas";
import { FIT_SYSTEM, PROFILE_SYSTEM, fitUserPrompt, profileUserPrompt } from "./prompts";
import { mockFit, mockProfile } from "./mock";

const MODEL = "claude-opus-5-5";

/** True when no API key is set: we return mock data so the UI still works. */
export const isMockMode = () => !process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/**
 * One structured-output call: the model must answer with JSON matching `schema`,
 * and the SDK validates it for us (parsed_output).
 * `fallbacks: "default"` lets the API retry on a fallback model if the request is declined.
 */
async function structured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  user: string;
  effort: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  if (res.stop_reason === "refusal") throw new Error("The AI declined this request.");
  if (!res.parsed_output) throw new Error(`AI returned no usable output (stop: ${res.stop_reason}).`);
  return res.parsed_output;
}

export async function extractProfile(resumeText: string): Promise<ProfileT> {
  if (isMockMode()) return mockProfile(resumeText);
  return structured({
    schema: Profile,
    system: PROFILE_SYSTEM,
    user: profileUserPrompt(resumeText),
    effort: "low", // simple extraction; low effort is fast and cheap
  });
}

const FitResult = z.object({
  results: z.array(z.object({ id: z.string(), fit: z.number(), reason: z.string() })),
});
export type Fit = { fit: number; reason: string }; // fit 0–100

/** Ask the AI to judge fit for a batch of jobs in ONE call. Returns a map keyed by job id. */
export async function judgeFit(profile: ProfileT, prefs: Preferences, jobs: Job[]): Promise<Map<string, Fit>> {
  if (isMockMode() || jobs.length === 0) return mockFit(profile, jobs);
  const out = await structured({
    schema: FitResult,
    system: FIT_SYSTEM,
    user: fitUserPrompt(profile, prefs, jobs),
    effort: "medium",
  });
  return new Map(
    out.results.map((r) => [r.id, { fit: Math.max(0, Math.min(100, r.fit)), reason: r.reason }]),
  );
}
