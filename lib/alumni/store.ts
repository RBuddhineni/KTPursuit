// Server-only alumni lookup. The full list is NEVER sent to the browser:
// callers ask for specific companies and get back only those alumni.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import sample from "@/data/alumni.json";
import { Alumnus } from "@/lib/schemas";
import { normalizeCompany } from "./companies";

let cache: Alumnus[] | null = null;

/**
 * Real chapter data lives in data/alumni.private.json (gitignored, created by
 * `npm run import:alumni`). If it's missing we use the fake sample data.
 */
function loadAlumni(): Alumnus[] {
  if (cache) return cache;
  let raw: unknown = sample;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "alumni.private.json"), "utf8"));
  } catch {
    /* no private file: use sample */
  }
  cache = z.array(Alumnus).parse(raw);
  return cache;
}

export type AlumniHit = Omit<Alumnus, "experiences"> & { roles: Alumnus["experiences"] };

/** Alumni who worked or interned at each company. Keys are the company names as given. */
export function alumniForCompanies(companies: string[]): Record<string, AlumniHit[]> {
  const all = loadAlumni();
  const out: Record<string, AlumniHit[]> = {};
  for (const company of companies) {
    const key = normalizeCompany(company);
    out[company] = all.flatMap(({ experiences, ...person }) => {
      const roles = experiences.filter((e) => normalizeCompany(e.company) === key);
      return roles.length ? [{ ...person, roles }] : [];
    });
  }
  return out;
}
