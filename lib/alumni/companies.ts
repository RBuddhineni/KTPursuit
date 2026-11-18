// Company name matching: "Google LLC", "Alphabet" and "google" should all be "google".

// Maps a normalized name to its canonical key. Add entries as you find new variants.
const ALIASES: Record<string, string> = {
  alphabet: "google",
  facebook: "meta",
  "meta platforms": "meta",
  "amazon web services": "amazon",
  aws: "amazon",
  "amazon com": "amazon",
  bcg: "boston consulting group",
  "the boston consulting group": "boston consulting group",
  mckinsey: "mckinsey company",
  bain: "bain company",
  "deloitte consulting": "deloitte",
  "jane street capital": "jane street",
  "two sigma investments": "two sigma",
  "capital one financial": "capital one",
  "ford motor company": "ford",
  "ford motor": "ford",
  "uber technologies": "uber",
  "cisco systems": "cisco",
  "jp morgan": "jpmorgan chase",
  jpmorgan: "jpmorgan chase",
  "j p morgan": "jpmorgan chase",
};

// Legal suffixes that don't change which company it is.
const SUFFIXES = /\b(inc|llc|l l c|ltd|corp|corporation|co|plc|gmbh|company)$/;

export function normalizeCompany(name: string): string {
  let n = name
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Check aliases before AND after stripping suffixes ("McKinsey & Company" vs "McKinsey").
  if (ALIASES[n]) return ALIASES[n];
  let prev = "";
  while (prev !== n) {
    prev = n;
    n = n.replace(SUFFIXES, "").trim();
  }
  return ALIASES[n] ?? n;
}
