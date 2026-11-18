#!/usr/bin/env node
// Convert a CSV export of the KTP alumni database into data/alumni.private.json.
//
//   npm run import:alumni -- path/to/export.csv
//
// Expected columns (header row, any order, case-insensitive), ONE ROW PER JOB:
//   name, ktp_class, grad_year, major, email, linkedin, company, title, type, start_year, end_year
// Rows with the same email are merged into one person with multiple experiences.
// type should be "internship" or "full-time" (also accepts "intern", "fulltime", "FT").
// end_year can be blank for current roles.
//
// The output file is gitignored: real alumni data must never be committed (the repo is public).
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run import:alumni -- path/to/export.csv");
  process.exit(1);
}

/** Minimal CSV parser that handles quoted fields with commas, quotes and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const [header, ...data] = parseCsv(fs.readFileSync(input, "utf8").replace(/^﻿/, ""));
const cols = header.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
const required = ["name", "email", "company", "title"];
const missing = required.filter((c) => !cols.includes(c));
if (missing.length) {
  console.error(`CSV is missing required column(s): ${missing.join(", ")}`);
  process.exit(1);
}

const num = (v) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
const normType = (v = "") => (/intern/i.test(v) ? "internship" : "full-time");

const people = new Map();
let skipped = 0;
for (const r of data) {
  const get = (c) => (r[cols.indexOf(c)] ?? "").trim();
  const email = get("email").toLowerCase();
  if (!email || !get("name")) { skipped++; continue; }
  if (!people.has(email)) {
    people.set(email, {
      id: `alum-${people.size + 1}`,
      name: get("name"),
      ktpClass: get("ktp_class"),
      gradYear: num(get("grad_year")) ?? 0,
      major: get("major"),
      email,
      linkedin: get("linkedin"),
      experiences: [],
    });
  }
  if (get("company")) {
    const start = num(get("start_year")) ?? people.get(email).gradYear;
    people.get(email).experiences.push({
      company: get("company"),
      title: get("title"),
      type: normType(get("type")),
      startYear: start,
      endYear: num(get("end_year")),
    });
  }
}

const out = path.join(process.cwd(), "data", "alumni.private.json");
fs.writeFileSync(out, JSON.stringify([...people.values()], null, 2) + "\n");
console.log(`Wrote ${people.size} alumni to ${out}${skipped ? ` (skipped ${skipped} rows without name/email)` : ""}.`);
console.log("This file is gitignored. Restart `npm run dev` to load it.");
