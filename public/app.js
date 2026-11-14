const state = { jobs: [], current: null, profile: null, track: "pm" };

const $ = (selector) => document.querySelector(selector);

const TRACK_COPY = {
  pm: {
    title: "PM internship desk",
    lede: "Product manager internships from company boards and Jobright. Ops, analytics, and product-development titles are left out.",
    empty: "No product management internships in the latest search.",
  },
  swe: {
    title: "SWE internship desk",
    lede: "Software engineering internships from company boards plus Simplify’s Summer 2027 list (roles posted in the last 7 days). Keeps core SWE / SDE titles.",
    empty: "No software engineering internships in the latest search.",
  },
};

function applyTrackUi(track) {
  state.track = track === "swe" ? "swe" : "pm";
  const copy = TRACK_COPY[state.track];
  $("#desk-title").textContent = copy.title;
  $("#desk-lede").textContent = copy.lede;
  document.title = copy.title;
  $("#track-pm").setAttribute("aria-pressed", String(state.track === "pm"));
  $("#track-swe").setAttribute("aria-pressed", String(state.track === "swe"));
}

function showTab(name) {
  document.querySelectorAll("nav button").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.tab === name));
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === name);
  });
  if (name === "outreach") loadOutreach();
}

document.querySelectorAll("nav button").forEach((button) => {
  button.addEventListener("click", () => showTab(button.dataset.tab));
});

async function api(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
}

function parseBlocks(text) {
  const blocks = String(text || "")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const header = lines[0] || "";
    const parts = header.split(/\s+—\s+|\s+-\s+/).map((part) => part.trim());
    const bullets = lines.slice(1).map((line) => line.replace(/^•\s*/, ""));
    return { org: parts[1] || "", role: parts[0] || "", dates: parts[2] || "", name: parts[0] || "", bullets };
  });
}

function blocksToText(items, project) {
  return (items || [])
    .map((item) => {
      const header = project
        ? item.name || ""
        : [item.role, item.org, item.dates].filter(Boolean).join(" — ");
      const bullets = (item.bullets || []).filter(Boolean).map((bullet) => `• ${bullet}`);
      return [header, ...bullets].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function fillProfile(profile) {
  state.profile = profile;
  const form = $("#profile-form");
  for (const key of ["firstName", "lastName", "preferredName", "email", "phone", "school", "gradDate", "location", "linkedin", "website", "headline", "summary"]) {
    form.elements[key].value = profile[key] || "";
  }
  form.elements.experienceText.value = blocksToText(profile.experiences, false);
  form.elements.projectText.value = blocksToText(profile.projects, true);
  form.elements.skills.value = (profile.skills || []).join(", ");
  if (profile.resumeFilename) $("#profile-status").textContent = `Saved resume file: ${profile.resumeFilename}`;
}

$("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#profile-status");
  status.textContent = "Saving…";
  const payload = {
    firstName: form.firstName.value.trim(),
    lastName: form.lastName.value.trim(),
    preferredName: form.preferredName.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    school: form.school.value.trim(),
    gradDate: form.gradDate.value.trim(),
    location: form.location.value.trim(),
    linkedin: form.linkedin.value.trim(),
    website: form.website.value.trim(),
    headline: form.headline.value.trim(),
    summary: form.summary.value.trim(),
    experiences: parseBlocks(form.experienceText.value),
    projects: parseBlocks(form.projectText.value).map((item) => ({ name: item.name, bullets: item.bullets })),
    skills: form.skills.value.split(",").map((skill) => skill.trim()).filter(Boolean),
  };
  const file = form.resumeFile.files[0];
  if (file) {
    payload.resume = { filename: file.name, data: await fileToBase64(file) };
  }
  try {
    fillProfile(await api("/api/profile", { method: "PUT", body: JSON.stringify(payload) }));
    status.textContent = "Saved on this computer.";
  } catch (error) {
    status.textContent = error.message;
    status.className = "meta error";
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function visibleJobs() {
  const query = $("#filter").value.trim().toLowerCase();
  return state.jobs
    .filter((job) => {
      const hay = `${job.company} ${job.title} ${job.location}`.toLowerCase();
      return !query || hay.includes(query);
    })
    .sort((a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
}

function renderJobs() {
  const jobs = visibleJobs();
  const note = state.fetchNote ? ` · ${state.fetchNote}` : "";
  $("#job-meta").textContent = `${jobs.length} roles` + note;
  $("#job-list").innerHTML = jobs
    .map(
      (job) => `<button type="button" class="job${state.current?.job?.id === job.id ? " active" : ""}" data-id="${job.id}">
        <strong>${escapeHtml(job.title)}</strong>
        <small>${escapeHtml(job.company)} · ${escapeHtml(job.location || "Location on listing")}</small>
      </button>`,
    )
    .join("") || `<p class="meta" style="padding:12px;">${TRACK_COPY[state.track].empty}</p>`;
  $("#job-list").querySelectorAll(".job").forEach((button) => {
    button.addEventListener("click", () => openJob(button.dataset.id));
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadJobs(refresh) {
  $("#job-meta").textContent = refresh ? "Checking career boards…" : "Loading saved search…";
  const data = await api(`/api/jobs${refresh ? "?refresh=1" : ""}`);
  if (data.track) applyTrackUi(data.track);
  state.jobs = data.jobs || [];
  state.current = null;
  $("#job-detail").innerHTML =
    `<p class="meta">Open a role. The description, a resume built from your bullets, and the company’s application questions show up here.</p>`;
  const when = data.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : "";
  const failed = (data.failures || []).map((item) => item.board).join(", ");
  state.fetchNote = failed ? `Could not read ${failed}. ${when}` : when;
  renderJobs();
}

async function setTrack(track) {
  if (track === state.track) return;
  applyTrackUi(track);
  $("#job-meta").textContent = "Switching track…";
  await api("/api/settings", { method: "PUT", body: JSON.stringify({ track }) });
  await loadJobs(false);
}

$("#refresh").addEventListener("click", () => loadJobs(true).catch((error) => {
  $("#job-meta").textContent = error.message;
}));
$("#filter").addEventListener("input", renderJobs);
$("#track-pm").addEventListener("click", () => setTrack("pm").catch((error) => {
  $("#job-meta").textContent = error.message;
}));
$("#track-swe").addEventListener("click", () => setTrack("swe").catch((error) => {
  $("#job-meta").textContent = error.message;
}));

async function openJob(id) {
  const detail = $("#job-detail");
  detail.innerHTML = `<p class="meta">Opening listing…</p>`;
  const data = await api(`/api/jobs/${encodeURIComponent(id)}`);
  state.current = data;
  renderJobs();
  const emails = data.emails || [];
  const questions = data.questions || [];
  detail.innerHTML = `
    <h2>${escapeHtml(data.job.title)}</h2>
    <p class="meta">${escapeHtml(data.job.company)} · ${escapeHtml(data.job.location || "See listing")} · ${escapeHtml(data.job.source)}</p>
    <p><a href="${escapeHtml(data.job.url)}" target="_blank" rel="noreferrer">Open the company listing</a></p>
    ${data.applied ? `<p class="ok">Already submitted from this desk.</p>` : ""}
    <h3>Resume for this role</h3>
    <p class="meta">Bullets are reordered from your resume. Nothing new is invented. Words in the posting that your resume does not contain yet:</p>
    <div class="chips">${(data.tailored.missing || []).map((word) => `<span class="chip warn">${escapeHtml(word)}</span>`).join("") || `<span class="chip">No extra keywords to flag</span>`}</div>
    <pre>${escapeHtml(data.tailored.plainText || "Add resume bullets first.")}</pre>
    <h3>Recruiter note</h3>
    <p class="meta">${emails.length ? `Public emails on this posting: ${emails.map(escapeHtml).join(", ")}` : "This posting does not publish an email."} <a href="${escapeHtml(data.recruiterSearch)}" target="_blank" rel="noreferrer">Search LinkedIn for a recruiter</a></p>
    <form id="mail-form" class="stack" style="padding:0; border:0; background:transparent; display:grid; gap:8px;">
      <label>To <input name="to" value="${escapeHtml(emails[0] || "")}" placeholder="recruiter@company.com"></label>
      <label>Subject <input name="subject" value="${escapeHtml(`${data.job.title} at ${data.job.company}`)}"></label>
      <label>Note <textarea name="body">${escapeHtml(data.tailored.coverNote || "")}</textarea></label>
      <button class="action" type="submit">Save email draft</button>
      <span class="meta" id="mail-status"></span>
    </form>
    <h3>Description</h3>
    <pre class="description">${escapeHtml(data.description || "No description on this board.")}</pre>
    ${questions.length ? applicationForm(data) : `<p class="meta">Apply on the company site. Ashby, Lever, Jobright, and Simplify listings do not use the submit button.</p>`}
  `;
  $("#mail-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    $("#mail-status").textContent = "Saving draft…";
    try {
      await api("/api/outreach", {
        method: "POST",
        body: JSON.stringify({
          jobId: data.job.id,
          to: form.to.value,
          subject: form.subject.value,
          body: form.body.value,
        }),
      });
      $("#mail-status").textContent = "Draft saved. Send it from Outreach after you read it.";
    } catch (error) {
      $("#mail-status").textContent = error.message;
    }
  });
  const apply = $("#apply-form");
  if (apply) {
    apply.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = $("#apply-status");
      if (!apply.confirm.checked) {
        status.textContent = "Check the box once you have read every answer.";
        return;
      }
      status.textContent = "Submitting to the company…";
      try {
        const answers = {};
        const files = [];
        for (const element of apply.elements) {
          if (!element.name || element.name === "confirm") continue;
          if (element.type === "file") {
            if (element.files[0]) {
              files.push({
                field: element.name,
                filename: element.files[0].name,
                data: await fileToBase64(element.files[0]),
              });
            }
            continue;
          }
          if (element.type === "checkbox") {
            answers[element.name] = answers[element.name] || [];
            if (element.checked) answers[element.name].push(element.value);
            continue;
          }
          answers[element.name] = element.value;
        }
        await api("/api/apply", {
          method: "POST",
          body: JSON.stringify({ jobId: data.job.id, answers, files }),
        });
        status.textContent = "Submitted.";
        openJob(data.job.id);
      } catch (error) {
        status.textContent = error.message;
      }
    });
  }
}

function applicationForm(data) {
  const fields = data.questions
    .map((question) => {
      const value = data.prefill?.[question.name];
      const common = `name="${escapeHtml(question.name)}"`;
      let control = `<input ${common} value="${escapeHtml(value || "")}">`;
      if (question.type === "textarea") control = `<textarea ${common}>${escapeHtml(value || "")}</textarea>`;
      if (question.type === "input_file") control = `<input ${common} type="file">`;
      if (question.type === "multi_value_single_select") {
        const options = question.values
          .map((option) => `<option value="${escapeHtml(option.value)}"${String(value) === String(option.value) ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
          .join("");
        control = `<select ${common}><option value="">Choose</option>${options}</select>`;
      }
      if (question.type === "multi_value_multi_select") {
        control = question.values
          .map((option) => `<label><input type="checkbox" name="${escapeHtml(question.name)}" value="${escapeHtml(option.value)}"> ${escapeHtml(option.label)}</label>`)
          .join("");
      }
      const title = `${escapeHtml(question.label)}${question.required ? " *" : ""}`;
      if (question.type === "multi_value_multi_select") {
        return `<fieldset class="question"><legend>${title}</legend>${control}</fieldset>`;
      }
      return `<div class="question"><label>${title} ${control}</label></div>`;
    })
    .join("");
  return `<h3>Application</h3>
    <p class="meta">Name, email, phone, LinkedIn, and website are filled from your resume. Work authorization, GPA, and location stay blank until you choose them. A required transcript still needs a file.</p>
    <form id="apply-form">${fields}
      <label><input type="checkbox" name="confirm"> I reviewed these answers and want to submit them as myself.</label>
      <div class="row"><button class="action" type="submit">Submit application</button><span class="meta" id="apply-status"></span></div>
    </form>`;
}

async function loadOutreach() {
  const [drafts, apps, smtp] = await Promise.all([
    api("/api/outreach"),
    api("/api/applications"),
    api("/api/smtp"),
  ]);
  $("#drafts").innerHTML = drafts.length
    ? drafts.map((draft) => `<article class="card">
        <strong>${escapeHtml(draft.subject)}</strong>
        <p class="meta">${escapeHtml(draft.to)} · ${escapeHtml(draft.status)}</p>
        <pre>${escapeHtml(draft.body)}</pre>
        ${draft.status === "sent" ? "" : `<button class="action" type="button" data-send="${draft.id}">Send</button>`}
      </article>`).join("")
    : `<p class="meta">No drafts yet. Open a listing and save a recruiter note.</p>`;
  $("#drafts").querySelectorAll("[data-send]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api(`/api/outreach/${button.dataset.send}/send`, { method: "POST", body: "{}" });
        await loadOutreach();
      } catch (error) {
        button.disabled = false;
        button.insertAdjacentHTML("afterend", `<p class="error">${escapeHtml(error.message)}</p>`);
      }
    });
  });
  $("#applications").innerHTML = apps.length
    ? apps.map((item) => `<article class="card"><strong>${escapeHtml(item.title)}</strong><p class="meta">${escapeHtml(item.company)} · ${escapeHtml(item.submittedAt)}</p></article>`).join("")
    : `<p class="meta">Nothing submitted yet.</p>`;
  const form = $("#smtp-form");
  form.host.value = smtp.host || "";
  form.port.value = smtp.port || 587;
  form.user.value = smtp.user || "";
  form.from.value = smtp.from || "";
  $("#smtp-status").textContent = smtp.configured ? "Mail server saved." : "Not configured.";
}

$("#smtp-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const saved = await api("/api/smtp", {
    method: "PUT",
    body: JSON.stringify({
      host: form.host.value.trim(),
      port: Number(form.port.value),
      user: form.user.value.trim(),
      pass: form.pass.value,
      from: form.from.value.trim(),
    }),
  });
  $("#smtp-status").textContent = saved.configured ? "Mail server saved." : "Host, username, and password are all required.";
});

api("/api/settings")
  .then((settings) => applyTrackUi(settings.track || "pm"))
  .catch(() => applyTrackUi("pm"))
  .finally(() => {
    loadJobs(false).catch((error) => {
      $("#job-meta").textContent = error.message;
    });
  });
api("/api/profile").then(fillProfile).catch(() => {});
