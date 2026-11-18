// POST { profile, prefs } → { matches, mock }
import { z } from "zod";
import { isMockMode, judgeFit } from "@/lib/ai/client";
import { mockFit } from "@/lib/ai/mock";
import { jobSource } from "@/lib/jobs";
import { rankJobs } from "@/lib/matching";
import { Preferences, Profile } from "@/lib/schemas";

const Body = z.object({ profile: Profile, prefs: Preferences });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid profile. Please go back and try again." }, { status: 400 });
  const { profile, prefs } = parsed.data;

  const jobs = await jobSource.search(prefs);
  let usedMock = isMockMode();
  const matches = await rankJobs(profile, prefs, jobs, async (candidates) => {
    try {
      return await judgeFit(profile, prefs, candidates);
    } catch (err) {
      // If the AI call fails, still return results using the non-AI estimate.
      console.error("judgeFit failed, using fallback scores", err);
      usedMock = true;
      return mockFit(profile, candidates);
    }
  });
  return Response.json({ matches, mock: usedMock });
}
