const STOP = new Set(
  `a an the and or of to for in on with at from by as is are be this that our your you we their they our its into about across over under than then per via using use used our will can may should the job role team work company intern internship product management manager associate our their applicant candidate experience experiences please including include ability abilities strong excellent great good well more most other such into with without within across using use our we're you'll you'll`.split(
    /\s+/,
  ),
);

function tokens(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function unique(list) {
  return [...new Set(list)];
}

export function blankProfile() {
  return {
    firstName: "",
    lastName: "",
    preferredName: "",
    email: "",
    phone: "",
    school: "",
    gradDate: "",
    location: "",
    linkedin: "",
    website: "",
    headline: "",
    summary: "",
    experiences: [{ org: "", role: "", dates: "", bullets: [""] }],
    projects: [{ name: "", bullets: [""] }],
    skills: [],
    savedAnswers: {},
    resumeFilename: "",
  };
}

function allBullets(profile) {
  const rows = [];
  for (const item of profile.experiences || []) {
    for (const bullet of item.bullets || []) {
      const text = bullet.trim();
      if (text) rows.push({ section: "experience", label: `${item.role || "Role"} — ${item.org || "Org"}`, text });
    }
  }
  for (const item of profile.projects || []) {
    for (const bullet of item.bullets || []) {
      const text = bullet.trim();
      if (text) rows.push({ section: "project", label: item.name || "Project", text });
    }
  }
  return rows;
}

function corpus(profile) {
  return [
    profile.headline,
    profile.summary,
    profile.school,
    ...(profile.skills || []),
    ...allBullets(profile).map((row) => row.text),
  ]
    .filter(Boolean)
    .join(" ");
}

export function tailorResume(profile, job, description) {
  const jobText = `${job.title}\n${job.company}\n${description || ""}`;
  const jobTokens = unique(tokens(jobText));
  const resumeTokens = new Set(tokens(corpus(profile)));
  const matched = jobTokens.filter((word) => resumeTokens.has(word)).slice(0, 24);
  const missing = jobTokens.filter((word) => !resumeTokens.has(word)).slice(0, 16);
  const ranked = allBullets(profile)
    .map((row) => {
      const words = new Set(tokens(row.text));
      const overlap = jobTokens.filter((word) => words.has(word));
      return { ...row, overlap, score: overlap.length };
    })
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Your name";
  const contact = [profile.email, profile.phone, profile.location, profile.linkedin, profile.website]
    .filter(Boolean)
    .join("  ·  ");
  const lines = [name, profile.headline, contact, profile.school && profile.gradDate ? `${profile.school} · ${profile.gradDate}` : profile.school]
    .filter(Boolean);
  if (profile.summary) {
    lines.push("", "Summary", profile.summary.trim());
  }
  const keep = ranked.filter((row) => row.score > 0);
  const shown = (keep.length ? keep : ranked).slice(0, 8);
  const omitted = ranked.filter((row) => !shown.includes(row));
  if (shown.length) {
    lines.push("", "Selected for this role");
    for (const row of shown) lines.push(`• ${row.text} (${row.label})`);
  }
  if (profile.skills?.length) {
    const skills = [...profile.skills].sort((a, b) => {
      const score = (skill) => (jobTokens.includes(skill.toLowerCase()) ? 1 : 0);
      return score(b) - score(a);
    });
    lines.push("", "Skills", skills.join(", "));
  }
  const top = shown[0];
  const coverNote = [
    "Hello,",
    "",
    `I am applying for the ${job.title} role at ${job.company}.`,
    profile.school ? `I am a student at ${profile.school}${profile.gradDate ? `, graduating ${profile.gradDate}` : ""}.` : "",
    top ? `A relevant example from my experience: ${top.text}` : "I can share examples from my resume once a few bullets are filled in.",
    profile.linkedin ? `LinkedIn: ${profile.linkedin}` : "",
    "",
    "Thank you,",
    name,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    plainText: lines.join("\n"),
    shown,
    omitted: omitted.map((row) => row.text),
    matched,
    missing,
    coverNote,
  };
}
