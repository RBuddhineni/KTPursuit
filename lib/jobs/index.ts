// Jobs come from a JobSource. Today it's the seeded JSON file; later you can add a
// JSearch or Adzuna source that implements the same interface. The UI never changes.
import seed from "@/data/jobs.json";
import { Job, type Preferences } from "@/lib/schemas";
import { z } from "zod";

export interface JobSource {
  name: string;
  /** Return candidate jobs. Matching (lib/matching.ts) does the real filtering and ranking. */
  search(prefs: Preferences): Promise<Job[]>;
}

const seededJobs = z.array(Job).parse(seed);

export const seedJobSource: JobSource = {
  name: "seed",
  async search() {
    return seededJobs;
  },
};

// Example for later:
// export const jsearchSource: JobSource = {
//   name: "jsearch",
//   async search(prefs) {
//     const res = await fetch(`https://jsearch.p.rapidapi.com/search?query=...`, { headers: {...} });
//     return (await res.json()).data.map(toJob);  // map their fields onto our Job shape
//   },
// };

export const jobSource: JobSource = seedJobSource;
