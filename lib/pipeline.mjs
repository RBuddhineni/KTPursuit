const JOBRIGHT_PM =
  "https://raw.githubusercontent.com/jobright-ai/2026-Product-Management-Internship/master/README.md";
const SIMPLIFY_SWE =
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md";
const SIMPLIFY_SWE_SECTION = "## 💻 Software Engineering Internship Roles";
const EXTERNAL_MAX_AGE_DAYS = 7;

const COMPANY_ALIASES = {
  "p and g": "procter and gamble",
  pg: "procter and gamble",
  "procter and gamble": "procter and gamble",
  altice: "optimum",
  "optimum financial group": "optimum",
  "volvo construction equipment": "volvo group",
  "h and r block": "hr block",
  "epic games": "epic",
};

const CITIES = [
  [/\bsan francisco\b|\bsan fransisco\b|\bsf\b/, "sf"],
  [/\bnew york\b|\bnyc\b/, "newyork"],
  [/\bmountain view\b/, "mtv"],
  [/\bsan mateo\b/, "sanmateo"],
  [/\bcincinnati\b|\bcincinatti\b/, "cincinnati"],
  [/\bst louis\b|\bstl\b/, "stl"],
  [/\bpalo alto\b/, "paloalto"],
  [/\bbellevue\b/, "bellevue"],
  [/\bpittsburgh\b/, "pittsburgh"],
  [/\bchicago\b/, "chicago"],
  [/\birvine\b/, "irvine"],
  [/\bseattle\b/, "seattle"],
  [/\braleigh\b/, "raleigh"],
  [/\btoronto\b/, "toronto"],
  [/\bparis\b/, "paris"],
];

export function companyKey(name) {
  let text = String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|the|usa)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return COMPANY_ALIASES[text] || text;
}

export function citiesOf(location) {
  const text = ` ${String(location || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z]+/g, " ")} `;
  const found = new Set();
  for (const [pattern, key] of CITIES) {
    if (pattern.test(text)) found.add(key);
  }
  return found;
}

export function citiesConflict(left, right) {
  const a = citiesOf(left);
  const b = citiesOf(right);
  const leftText = String(left || "").trim().toLowerCase();
  const rightText = String(right || "").trim().toLowerCase();
  if (a.size && b.size) {
    for (const city of a) if (b.has(city)) return false;
    return true;
  }
  if (!leftText || !rightText) return false;
  if (leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText)) return false;
  return true;
}

export function roleFamily(title) {
  const text = String(title || "").toLowerCase();
  if (/technical product/.test(text)) return "technical-product";
  if (/\bmba\b/.test(text)) return "mba-product";
  if (/technical program|program management/.test(text)) return "tpm";
  if (/product owner/.test(text)) return "product-owner";
  if (/product operations|product solutions/.test(text)) return "product-ops";
  if (/product strategy/.test(text)) return "product-strategy";
  if (/product manag|associate product|\bapm\b|product intern|product line management/.test(text)) return "pm-intern";
  if (
    /software engineer|software engineering|software developer|software development|\bswe\b|\bsde\b|full[-\s]?stack|front[-\s]?end engineer|back[-\s]?end engineer|mobile engineer|ios engineer|android engineer/.test(
      text,
    )
  ) {
    return "swe-intern";
  }
  return "other";
}

const SIDE_ROLE =
  /\b(product operations|product solutions|product analytics|data product|data science|product development|product line|technical product|product owner|product strategy|category management|methodology|brand intern)\b/i;
const CORE_PM = /\b(product manager|product management|associate product|\bapm\b)\b/i;
const CORE_SWE =
  /\b(software engineer|software engineering|software developer|software development|\bswe\b|\bsde\b|full[-\s]?stack|front[-\s]?end engineer|back[-\s]?end engineer|mobile engineer|ios engineer|android engineer|platform engineer|site reliability|\bsre\b)\b/i;
const SWE_EXCLUDE =
  /\b(product manager|product management|associate product|\bapm\b|data science|data analyst|machine learning intern|design intern|ux research|ui\/ux|marketing|finance|quant trading|hardware)\b/i;

/** Product manager, product management, or APM internships. A side role only stays when the title also says product manager or product management. */
export function isTruePmTitle(title) {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  if (!/\b(intern(ship)?|co-?op)\b/i.test(text)) return false;
  const core = CORE_PM.test(text);
  if (SIDE_ROLE.test(text) && !core) return false;
  if (core) return true;
  return /\bproduct intern\b/i.test(text);
}

/** Software engineering internships. Keeps core SWE titles and drops adjacent non-eng roles. */
export function isTrueSweTitle(title) {
  const text = String(title || "").replace(/\s+/g, " ").trim();
  if (!/\b(intern(ship)?|co-?op)\b/i.test(text)) return false;
  if (SWE_EXCLUDE.test(text) && !CORE_SWE.test(text)) return false;
  if (CORE_SWE.test(text)) return true;
  return /\b(engineer|developer) intern(ship)?\b/i.test(text) && /\b(software|web|mobile|platform|backend|frontend|full[-\s]?stack)\b/i.test(text);
}

export function isTitleForTrack(title, track = "pm") {
  return track === "swe" ? isTrueSweTitle(title) : isTruePmTitle(title);
}

export function parseJobrightReadme(markdown, track = "pm") {
  const jobs = [];
  let company = "";
  for (const line of String(markdown || "").split("\n")) {
    if (!line.startsWith("| **") && !line.startsWith("| ↳")) continue;
    const cells = line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length < 4) continue;
    if (cells[0] !== "↳") {
      company = (cells[0].match(/\[([^\]]+)\]/) || [, cells[0]])[1];
    }
    const titleMatch = cells[1].match(/\*\*\[(.+)\]\((https?:\/\/[^)]+)\)\*\*/);
    if (!titleMatch) continue;
    const title = titleMatch[1]
      .replace(/\s+/g, " ")
      .replace(/\s+Job Details \/ .+$/i, "")
      .replace(/\s+\[[^\]]+\]$/g, "")
      .trim();
    if (!isTitleForTrack(title, track)) continue;
    jobs.push({
      id: `jobright:${companyKey(company)}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`,
      source: "jobright",
      board: "jobright",
      externalId: titleMatch[2],
      company,
      title,
      location: (cells[2] || "").replace(/\s+/g, " ").trim(),
      url: titleMatch[2],
      updatedAt: "",
    });
  }
  return jobs;
}

function ageToDays(label) {
  const match = String(label || "")
    .trim()
    .match(/^(\d+)\s*(d|mo)$/i);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number(match[1]);
  return match[2].toLowerCase() === "mo" ? value * 30 : value;
}

export function parseSimplifySection(markdown, sectionHeading, track = "swe", maxAgeDays = EXTERNAL_MAX_AGE_DAYS) {
  const start = String(markdown || "").indexOf(sectionHeading);
  if (start < 0) return [];
  const rest = markdown.slice(start + sectionHeading.length);
  const next = rest.search(/\n## /);
  const section = next < 0 ? rest : rest.slice(0, next);
  const jobs = [];
  let company = "";
  const rows = section.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  for (const row of rows) {
    if (/<th>/i.test(row)) continue;
    const cells = [...row.matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
    if (cells.length < 5) continue;
    const companyCell = cells[0].trim();
    if (companyCell !== "↳") {
      company =
        (companyCell.match(/<strong><a[^>]*>([^<]+)<\/a><\/strong>/i) || [])[1] ||
        companyCell
          .replace(/<[^>]+>/g, " ")
          .replace(/🔥/g, " ")
          .replace(/\s+/g, " ")
          .trim();
    }
    const title = cells[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/🎓/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const location = cells[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const links = [...cells[3].matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((match) => match[1]);
    const url = links.find((link) => !/simplify\.jobs\/p\//i.test(link)) || links[0] || "";
    const age = ageToDays(cells[4].replace(/<[^>]+>/g, " ").trim());
    if (!company || !url || age > maxAgeDays) continue;
    if (!isTitleForTrack(title, track)) continue;
    jobs.push({
      id: `simplify:${companyKey(company)}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`,
      source: "simplify",
      board: "simplify",
      externalId: url,
      company,
      title,
      location,
      url,
      updatedAt: "",
    });
  }
  return jobs;
}

export async function fetchJobrightJobs(track = "pm") {
  if (track === "swe") {
    const response = await fetch(SIMPLIFY_SWE, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Simplify list returned ${response.status}`);
    return parseSimplifySection(await response.text(), SIMPLIFY_SWE_SECTION, "swe");
  }
  const response = await fetch(JOBRIGHT_PM, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Jobright repo returned ${response.status}`);
  return parseJobrightReadme(await response.text(), "pm");
}
