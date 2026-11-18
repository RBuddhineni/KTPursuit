"use client";
// Results UI: MatchRing, JobCard, AlumniList (with intro message), UnlockForm.
import { useState } from "react";
import { Button, Card, Chip } from "@/components/ui";
import type { AlumniHit } from "@/lib/alumni/store";
import type { Match, Profile } from "@/lib/schemas";

export function MatchRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? "var(--ktp-success)" : score >= 55 ? "var(--ktp-accent)" : "var(--ktp-muted)";
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${score}% match`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--ktp-tint-strong)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-navy">{score}%</span>
    </div>
  );
}

export type AlumniState =
  | { status: "loading" }
  | { status: "locked"; total: number; counts: Record<string, number> }
  | { status: "unlocked"; total: number; byCompany: Record<string, AlumniHit[]> }
  | { status: "error" };

export function JobCard({ match, alumni, profile }: { match: Match; alumni: AlumniState; profile?: Profile }) {
  const { job } = match;
  const count =
    alumni.status === "locked" ? alumni.counts[job.company] ?? 0
    : alumni.status === "unlocked" ? alumni.byCompany[job.company]?.length ?? 0
    : null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <div className="flex gap-4">
        <MatchRing score={match.score} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink">{job.title}</h3>
          <p className="text-sm text-muted">
            {job.company} · {job.location}
            {job.remote && " · Remote OK"} · {job.type === "internship" ? "Internship" : "Full-time"}
          </p>
          {match.reason && <p className="mt-3 text-sm text-ink">{match.reason}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {match.matchedSkills.map((s) => <Chip key={s}>{s}</Chip>)}
            {match.missingSkills.map((s) => <Chip key={s} outlined>{s}</Chip>)}
          </div>
          <a href={job.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
            Find this posting ↗
          </a>
        </div>
      </div>

      <details className="group mt-4 rounded-xl bg-tint/60 px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-navy">
          <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
          KTP alumni at {job.company}
          {count !== null && <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs">{count}</span>}
        </summary>
        <div className="mt-3">
          {alumni.status === "loading" && <p className="text-sm text-muted">Loading…</p>}
          {alumni.status === "error" && <p className="text-sm text-muted">Couldn&apos;t load alumni right now.</p>}
          {alumni.status === "locked" && (
            <p className="text-sm text-muted">Enter the chapter passcode at the top of the page to see names and contact info.</p>
          )}
          {alumni.status === "unlocked" && (
            <AlumniList people={alumni.byCompany[job.company] ?? []} company={job.company} jobTitle={job.title} profile={profile} />
          )}
        </div>
      </details>
    </Card>
  );
}

function introMessage(person: AlumniHit, company: string, jobTitle: string, profile?: Profile) {
  const first = person.name.split(" ")[0];
  const me = profile?.name || "a KTP brother";
  const major = profile?.major ? `, studying ${profile.major}` : "";
  const role = person.roles[0];
  return `Hi ${first},

I'm ${me}${major} and a member of Kappa Theta Pi at Michigan. I saw that you were ${
    role.type === "internship" ? "an intern" : "a"
  } ${role.title} at ${company}, and I'm applying for the ${jobTitle} role there.

Would you be open to a quick 15-minute chat about your experience and any advice for the process? I'd really appreciate it.

Thanks,
${profile?.name || ""}`.trim();
}

export function AlumniList({ people, company, jobTitle, profile }: { people: AlumniHit[]; company: string; jobTitle: string; profile?: Profile }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (people.length === 0) {
    return <p className="text-sm text-muted">No KTP alumni found at {company} yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {people.map((p) => (
        <li key={p.id} className="rounded-xl bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-ink">{p.name}</p>
              <p className="text-xs text-muted">{p.ktpClass} · Class of {p.gradYear}</p>
              {p.roles.map((r, i) => (
                <p key={i} className="mt-1 text-sm text-ink">
                  {r.title}{" "}
                  <span className="rounded-full bg-tint px-2 py-0.5 text-xs text-navy">
                    {r.type === "internship" ? "Intern" : "Full-time"}
                  </span>
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <a className="font-medium text-accent hover:underline" href={p.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
              <a className="font-medium text-accent hover:underline" href={`mailto:${p.email}`}>{p.email}</a>
            </div>
          </div>
          {openId === p.id ? (
            <IntroEditor initial={introMessage(p, company, jobTitle, profile)} onClose={() => setOpenId(null)} />
          ) : (
            <Button variant="secondary" className="mt-3 px-3 py-1.5 text-xs" onClick={() => setOpenId(p.id)}>
              Copy intro message
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function IntroEditor({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3">
      <label className="sr-only" htmlFor="intro">Intro message</label>
      <textarea id="intro" rows={8} className="w-full rounded-xl border border-line p-3 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <Button
          className="px-3 py-1.5 text-xs"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? "Copied ✓" : "Copy to clipboard"}
        </Button>
        <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export function UnlockForm({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch("/api/alumni/unlock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: code }),
        });
        if (res.ok) onUnlocked();
        else setError((await res.json()).error ?? "Couldn't unlock.");
      }}
    >
      <label htmlFor="passcode" className="sr-only">Chapter passcode</label>
      <input
        id="passcode" type="password" placeholder="Chapter passcode" value={code}
        onChange={(e) => setCode(e.target.value)}
        className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink"
      />
      <Button type="submit" className="py-2">Unlock alumni</Button>
      {error && <p role="alert" className="self-center text-sm text-red-200">{error}</p>}
    </form>
  );
}
