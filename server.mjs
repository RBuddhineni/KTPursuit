import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { emailsIn, loadJobDetail, recruiterSearchUrl, searchInternships } from "./lib/jobs.mjs";
import { tailorResume } from "./lib/resume.mjs";
import {
  ensureStore,
  readApplications,
  readJobsCache,
  readOutreach,
  readProfile,
  readSettings,
  readSmtp,
  readSmtpSecret,
  uploadsDir,
  writeApplications,
  writeJobsCache,
  writeOutreach,
  writeProfile,
  writeSettings,
  writeSmtp,
} from "./lib/store.mjs";

const PORT = Number(process.env.PORT || 4317);
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "public");
const CACHE_MS = 2 * 60 * 60 * 1000;

ensureStore();

function send(res, status, body, type = "application/json") {
  const payload = type === "application/json" ? JSON.stringify(body) : body;
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readBody(req, limit = 12_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Upload is larger than 12 MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Request body must be JSON."));
      }
    });
    req.on("error", reject);
  });
}

function safeName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function saveUpload(upload, fallbackName) {
  if (!upload?.data) return null;
  const filename = `${Date.now()}-${safeName(upload.filename || fallbackName)}`;
  const bytes = Buffer.from(upload.data, "base64");
  if (bytes.length > 8_000_000) throw new Error("Each file must be under 8 MB.");
  fs.writeFileSync(path.join(uploadsDir(), filename), bytes);
  return { filename: upload.filename || fallbackName, stored: filename };
}

async function jobsResponse(refresh) {
  const { track } = readSettings();
  const cached = readJobsCache(track);
  const fresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_MS;
  const payload = !refresh && fresh ? cached : await searchInternships(track);
  if (payload !== cached) writeJobsCache(payload, track);
  return {
    ...payload,
    track,
    jobs: (payload.jobs || []).map((job) => ({
      ...job,
      trackerStatus: "",
      trackerBlocked: false,
    })),
  };
}

function findJob(id) {
  const { track } = readSettings();
  const cache = readJobsCache(track);
  return cache?.jobs?.find((job) => job.id === id) || null;
}

function profilePacket(job, description) {
  return tailorResume(readProfile(), job, description);
}

async function greenhouseForm(job) {
  const detail = await loadJobDetail(job);
  const profile = readProfile();
  const questions = (detail.questions || []).map((question) => {
    const field = question.fields?.[0] || {};
    const label = question.label || field.name || "Question";
    return {
      label,
      required: Boolean(question.required),
      type: field.type || "input_text",
      name: field.name,
      values: (field.values || []).map((value) => ({
        label: value.label,
        value: value.value,
      })),
    };
  }).filter((question) => question.name);
  return { description: detail.description, questions, prefill: suggestAnswers(profile, questions) };
}

function suggestAnswers(profile, questions) {
  const answers = {};
  const byName = {
    first_name: profile.firstName,
    last_name: profile.lastName,
    preferred_name: profile.preferredName || profile.firstName,
    email: profile.email,
    phone: profile.phone,
  };
  for (const question of questions) {
    if (byName[question.name]) answers[question.name] = byName[question.name];
    const label = question.label.toLowerCase();
    if (label.includes("linkedin") && profile.linkedin) answers[question.name] = profile.linkedin;
    if (/\bwebsite\b|\bportfolio\b/.test(label) && profile.website) answers[question.name] = profile.website;
    if (profile.savedAnswers?.[question.label]) answers[question.name] = profile.savedAnswers[question.label];
  }
  return answers;
}

async function submitGreenhouse(job, body) {
  const profile = readProfile();
  const detail = await greenhouseForm(job);
  const answers = { ...detail.prefill, ...(body.answers || {}) };
  const files = [];
  if (profile.resumeFilename) {
    files.push({ field: "resume", filename: profile.resumeFilename, stored: profile.resumeStored });
  }
  for (const upload of body.files || []) {
    const saved = saveUpload(upload, "attachment");
    if (saved && upload.field) files.push({ field: upload.field, ...saved });
  }
  const missing = detail.questions.filter((question) => {
    if (!question.required) return false;
    if (question.type === "input_file") return !files.some((file) => file.field === question.name);
    const value = answers[question.name];
    return value == null || value === "" || (Array.isArray(value) && value.length === 0);
  });
  if (missing.length) {
    const error = new Error(`Still needed: ${missing.map((question) => question.label).slice(0, 4).join("; ")}`);
    error.status = 400;
    throw error;
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(answers)) {
    if (Array.isArray(value)) value.forEach((item) => form.append(key, String(item)));
    else if (value != null && value !== "") form.append(key, String(value));
  }
  const tailored = profilePacket(job, detail.description);
  if (tailored.plainText) form.append("resume_text", tailored.plainText);
  if (!answers.cover_letter_text && tailored.coverNote) form.append("cover_letter_text", tailored.coverNote);
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(uploadsDir(), file.stored));
    form.append(file.field, new Blob([buffer]), file.filename);
  }
  const response = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${job.board}/jobs/${job.externalId}`,
    { method: "POST", body: form, headers: { "User-Agent": "intern-assistant/1.0" } },
  );
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(text.slice(0, 400) || "Greenhouse rejected the application.");
    error.status = 502;
    throw error;
  }
  const record = {
    id: randomUUID(),
    jobId: job.id,
    company: job.company,
    title: job.title,
    url: job.url,
    submittedAt: new Date().toISOString(),
    response: text.slice(0, 500),
  };
  writeApplications([record, ...readApplications()]);
  const savedAnswers = { ...profile.savedAnswers };
  for (const question of detail.questions) {
    if (["first_name", "last_name", "preferred_name", "email", "phone"].includes(question.name)) continue;
    if (answers[question.name] != null && answers[question.name] !== "") {
      savedAnswers[question.label] = answers[question.name];
    }
  }
  writeProfile({ ...profile, savedAnswers });
  return record;
}

async function sendMail(item) {
  const smtp = readSmtpSecret();
  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    const error = new Error("Add your email server settings before sending.");
    error.status = 400;
    throw error;
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port || 587),
    secure: Number(smtp.port) === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transport.sendMail({
    from: smtp.from || smtp.user,
    to: item.to,
    subject: item.subject,
    text: item.body,
  });
}

function publicFile(urlPath) {
  const requested = (urlPath === "/" ? "index.html" : urlPath).replace(/^\/+/, "");
  const full = path.normalize(path.join(publicDir, requested));
  if (!full.startsWith(publicDir + path.sep)) return null;
  if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return null;
  return full;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === "GET" && url.pathname === "/api/jobs") {
      return send(res, 200, await jobsResponse(url.searchParams.get("refresh") === "1"));
    }
    if (req.method === "GET" && url.pathname === "/api/settings") {
      return send(res, 200, readSettings());
    }
    if (req.method === "PUT" && url.pathname === "/api/settings") {
      const body = await readBody(req);
      if (body.track && body.track !== "pm" && body.track !== "swe") {
        return send(res, 400, { error: "Track must be pm or swe." });
      }
      return send(res, 200, writeSettings(body));
    }
    if (req.method === "GET" && url.pathname === "/api/profile") {
      const profile = readProfile();
      return send(res, 200, profile);
    }
    if (req.method === "PUT" && url.pathname === "/api/profile") {
      const body = await readBody(req);
      if (body.resume?.data) {
        const saved = saveUpload(body.resume, "resume.pdf");
        body.resumeFilename = saved.filename;
        body.resumeStored = saved.stored;
      }
      delete body.resume;
      return send(res, 200, writeProfile(body));
    }
    if (req.method === "GET" && url.pathname === "/api/outreach") {
      return send(res, 200, readOutreach());
    }
    if (req.method === "GET" && url.pathname === "/api/applications") {
      return send(res, 200, readApplications());
    }
    if (req.method === "GET" && url.pathname === "/api/smtp") {
      return send(res, 200, readSmtp());
    }
    if (req.method === "PUT" && url.pathname === "/api/smtp") {
      return send(res, 200, writeSmtp(await readBody(req)));
    }

    const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      const found = findJob(decodeURIComponent(jobMatch[1]));
      if (!found) return send(res, 404, { error: "Search listings first." });
      const { track } = readSettings();
      const job = { ...found, trackerStatus: "", trackerBlocked: false };
      const detail = job.source === "greenhouse" ? await greenhouseForm(job) : await loadJobDetail(job);
      const description = detail.description || "";
      const tailored = profilePacket(job, description);
      return send(res, 200, {
        job,
        description,
        tailored,
        emails: emailsIn(description),
        recruiterSearch: recruiterSearchUrl(job.company, track),
        questions: detail.questions || [],
        prefill: detail.prefill || {},
        applied: readApplications().some((item) => item.jobId === job.id),
      });
    }

    if (req.method === "POST" && url.pathname === "/api/apply") {
      const body = await readBody(req);
      const found = findJob(body.jobId);
      if (!found) return send(res, 404, { error: "That listing is not in the latest search." });
      const job = found;
      if (job.source !== "greenhouse") {
        return send(res, 400, {
          error: "This board has no public submit API. Open the listing and apply there with the tailored resume.",
          url: job.url,
        });
      }
      if (readApplications().some((item) => item.jobId === job.id)) {
        return send(res, 409, { error: "You already submitted this one from this desk." });
      }
      return send(res, 200, await submitGreenhouse(job, body));
    }

    if (req.method === "POST" && url.pathname === "/api/outreach") {
      const body = await readBody(req);
      const job = findJob(body.jobId);
      if (!job) return send(res, 404, { error: "Search listings first." });
      if (!body.to || !String(body.to).includes("@")) {
        return send(res, 400, { error: "A real recipient email is required. LinkedIn messages stay copy-and-paste." });
      }
      const item = {
        id: randomUUID(),
        jobId: job.id,
        company: job.company,
        title: job.title,
        to: String(body.to).trim(),
        subject: body.subject || `${job.title} — ${readProfile().firstName || "Applicant"}`,
        body: body.body || "",
        status: "draft",
        createdAt: new Date().toISOString(),
      };
      writeOutreach([item, ...readOutreach()]);
      return send(res, 200, item);
    }

    const sendMatch = url.pathname.match(/^\/api\/outreach\/([^/]+)\/send$/);
    if (req.method === "POST" && sendMatch) {
      const items = readOutreach();
      const item = items.find((entry) => entry.id === sendMatch[1]);
      if (!item) return send(res, 404, { error: "Draft not found." });
      await sendMail(item);
      item.status = "sent";
      item.sentAt = new Date().toISOString();
      writeOutreach(items);
      return send(res, 200, item);
    }

    if (req.method === "GET") {
      const file = publicFile(url.pathname);
      if (!file) return send(res, 404, { error: "Not found." });
      const ext = path.extname(file);
      return send(res, 200, fs.readFileSync(file), TYPES[ext] || "application/octet-stream");
    }
    return send(res, 405, { error: "Method not allowed." });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || "Something went wrong." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Internship desk at http://127.0.0.1:${PORT}`);
});
