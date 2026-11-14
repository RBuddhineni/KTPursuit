import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blankProfile } from "./resume.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data");

function file(name) {
  return path.join(root, name);
}

export function ensureStore() {
  fs.mkdirSync(root, { recursive: true });
  fs.mkdirSync(file("uploads"), { recursive: true });
}

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(name, value) {
  ensureStore();
  fs.writeFileSync(file(name), JSON.stringify(value, null, 2));
}

export function readProfile() {
  return { ...blankProfile(), ...readJson("profile.json", {}) };
}

export function writeProfile(profile) {
  const current = readProfile();
  const next = {
    ...current,
    ...profile,
    savedAnswers: profile.savedAnswers || current.savedAnswers || {},
    resumeFilename: profile.resumeFilename ?? current.resumeFilename ?? "",
  };
  writeJson("profile.json", next);
  return next;
}

export function readSettings() {
  const settings = readJson("settings.json", {});
  const track = settings.track === "swe" ? "swe" : "pm";
  return { track };
}

export function writeSettings(patch) {
  const current = readSettings();
  const next = {
    ...current,
    ...patch,
    track: patch.track === "swe" ? "swe" : patch.track === "pm" ? "pm" : current.track,
  };
  writeJson("settings.json", next);
  return next;
}

function jobsCacheName(track = readSettings().track) {
  return track === "swe" ? "jobs-swe.json" : "jobs-pm.json";
}

export function readJobsCache(track) {
  return readJson(jobsCacheName(track), null);
}

export function writeJobsCache(cache, track) {
  writeJson(jobsCacheName(track || cache?.track || readSettings().track), cache);
}

export function readOutreach() {
  return readJson("outreach.json", []);
}

export function writeOutreach(items) {
  writeJson("outreach.json", items);
}

export function readApplications() {
  return readJson("applications.json", []);
}

export function writeApplications(items) {
  writeJson("applications.json", items);
}

export function uploadsDir() {
  ensureStore();
  return file("uploads");
}

export function readSmtp() {
  const smtp = readJson("smtp.json", null);
  if (!smtp) return { configured: false };
  return {
    configured: Boolean(smtp.host && smtp.user && smtp.pass),
    host: smtp.host || "",
    port: smtp.port || 587,
    user: smtp.user || "",
    from: smtp.from || smtp.user || "",
  };
}

export function readSmtpSecret() {
  return readJson("smtp.json", null);
}

export function writeSmtp(smtp) {
  const current = readJson("smtp.json", {});
  writeJson("smtp.json", {
    host: smtp.host ?? current.host ?? "",
    port: Number(smtp.port || current.port || 587),
    user: smtp.user ?? current.user ?? "",
    pass: smtp.pass || current.pass || "",
    from: smtp.from ?? current.from ?? "",
  });
  return readSmtp();
}
