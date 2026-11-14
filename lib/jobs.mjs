import { boards } from "./companies.mjs";
import { citiesConflict, companyKey, fetchJobrightJobs, isTitleForTrack } from "./pipeline.mjs";

const UA = "intern-assistant/1.0";

export function locationLabel(location) {
  if (!location) return "";
  if (typeof location === "string") return location;
  if (typeof location.name === "string") return location.name;
  if (typeof location.location === "string") return location.location;
  return "";
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.json();
}

function normalize(partial) {
  return {
    id: `${partial.source}:${partial.board}:${partial.externalId}`,
    source: partial.source,
    board: partial.board,
    externalId: String(partial.externalId),
    company: partial.company,
    title: String(partial.title || "").replace(/\s+/g, " ").trim(),
    location: locationLabel(partial.location),
    url: partial.url || "",
    updatedAt: partial.updatedAt || "",
  };
}

function titleOk(title, track) {
  return isTitleForTrack(title, track);
}

async function greenhouseJobs(board, track) {
  const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board.board}/jobs`);
  return (data.jobs || [])
    .filter((job) => titleOk(job.title, track))
    .map((job) =>
      normalize({
        source: "greenhouse",
        board: board.board,
        company: board.company,
        externalId: job.id,
        title: job.title,
        location: job.location,
        url: job.absolute_url,
        updatedAt: job.updated_at,
      }),
    );
}

async function ashbyJobs(board, track) {
  const data = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${board.board}`);
  return (data.jobs || [])
    .filter((job) => job.isListed !== false && titleOk(job.title, track))
    .map((job) =>
      normalize({
        source: "ashby",
        board: board.board,
        company: board.company,
        externalId: job.id,
        title: job.title,
        location: job.location,
        url: job.jobUrl || job.applyUrl,
        updatedAt: job.publishedAt,
      }),
    );
}

async function leverJobs(board, track) {
  const data = await fetchJson(`https://api.lever.co/v0/postings/${board.board}?mode=json`);
  return (Array.isArray(data) ? data : [])
    .filter((job) => titleOk(job.text, track))
    .map((job) =>
      normalize({
        source: "lever",
        board: board.board,
        company: board.company,
        externalId: job.id,
        title: job.text,
        location: job.categories?.location,
        url: job.hostedUrl,
        updatedAt: job.createdAt ? new Date(job.createdAt).toISOString() : "",
      }),
    );
}

const FETCHERS = {
  greenhouse: greenhouseJobs,
  ashby: ashbyJobs,
  lever: leverJobs,
};

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

export async function searchInternships(track = "pm") {
  const catalog = boards();
  const results = await mapPool(catalog, 8, async (board) => {
    try {
      const jobs = await FETCHERS[board.source](board, track);
      return { ok: true, jobs };
    } catch (error) {
      return { ok: false, board: board.board, error: error.message };
    }
  });
  const jobs = [];
  const failures = [];
  for (const result of results) {
    if (result.ok) jobs.push(...result.jobs);
    else failures.push({ board: result.board, error: result.error });
  }
  try {
    const repoJobs = await fetchJobrightJobs(track);
    for (const job of repoJobs) {
      const duplicate = jobs.some((existing) => sameListing(existing, job));
      if (!duplicate) jobs.push(job);
    }
  } catch (error) {
    failures.push({ board: "jobright", error: error.message });
  }
  jobs.sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
  return {
    track,
    jobs,
    fetchedAt: new Date().toISOString(),
    boardsChecked: catalog.length + 1,
    boardsFailed: failures.length,
    failures,
  };
}

/** @deprecated use searchInternships */
export async function searchPmInternships() {
  return searchInternships("pm");
}

function looseTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(summer|winter|fall|spring|20\d\d|intern|internship|co op|coop)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameListing(left, right) {
  if (companyKey(left.company) !== companyKey(right.company)) return false;
  if (citiesConflict(left.location, right.location)) return false;
  const a = looseTitle(left.title);
  const b = looseTitle(right.title);
  return a === b;
}

export async function loadJobDetail(job) {
  if (job.source === "jobright" || job.source === "simplify") {
    return {
      description:
        job.source === "simplify"
          ? "This listing is from the Simplify Summer 2027 internship list. Open the link for the company posting."
          : "This listing is from the Jobright internship repo. Open the link for the company posting.",
      questions: [],
    };
  }
  if (job.source === "greenhouse") {
    const data = await fetchJson(
      `https://boards-api.greenhouse.io/v1/boards/${job.board}/jobs/${job.externalId}?questions=true`,
    );
    return {
      description: stripHtml(data.content),
      questions: data.questions || [],
    };
  }
  if (job.source === "ashby") {
    const data = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${job.board}`);
    const match = (data.jobs || []).find((item) => String(item.id) === job.externalId);
    return {
      description: stripHtml(match?.descriptionPlain || match?.descriptionHtml || ""),
      questions: [],
    };
  }
  const data = await fetchJson(
    `https://api.lever.co/v0/postings/${job.board}/${job.externalId}`,
  );
  return {
    description: stripHtml(data.descriptionPlain || data.description || ""),
    questions: [],
  };
}

export function emailsIn(text) {
  const found = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(found.map((email) => email.toLowerCase()))].filter(
    (email) => !email.endsWith(".png") && !email.endsWith(".jpg") && !email.includes("example.com"),
  );
}

export function recruiterSearchUrl(company, track = "pm") {
  const kind = track === "swe" ? "software" : "product";
  const keywords = encodeURIComponent(`university recruiter ${company} ${kind}`);
  return `https://www.linkedin.com/search/results/people/?keywords=${keywords}`;
}
