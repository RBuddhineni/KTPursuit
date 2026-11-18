"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DevBanner } from "@/components/flow";
import { type AlumniState, JobCard, UnlockForm } from "@/components/results";
import { LinkButton } from "@/components/ui";
import type { Match, Profile } from "@/lib/schemas";
import { loadFlow, useMounted } from "@/lib/session";

export default function ResultsPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  const { matches, profile, mock } = loadFlow();
  if (!matches) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted">No matches yet.</p>
        <LinkButton href="/upload" className="mt-4">Upload your resume</LinkButton>
      </div>
    );
  }
  return <Results matches={matches} profile={profile} mock={mock} />;
}

const select = "rounded-xl border border-line bg-white px-3 py-2 text-sm";

function Results({ matches, profile, mock }: { matches: Match[]; profile?: Profile; mock?: boolean }) {
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [alumni, setAlumni] = useState<AlumniState>({ status: "loading" });

  const companies = useMemo(() => [...new Set(matches.map((m) => m.job.company))], [matches]);
  const categories = useMemo(() => [...new Set(matches.map((m) => m.job.category))], [matches]);

  const loadAlumni = useCallback(async () => {
    try {
      const res = await fetch("/api/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      setAlumni(
        data.unlocked
          ? { status: "unlocked", total: data.total, byCompany: data.byCompany }
          : { status: "locked", total: data.total, counts: data.counts },
      );
    } catch {
      setAlumni({ status: "error" });
    }
  }, [companies]);

  useEffect(() => {
    // Fetch is async; state is set once the response arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAlumni();
  }, [loadAlumni]);

  const totalAlumni = alumni.status === "locked" || alumni.status === "unlocked" ? alumni.total : null;
  const companiesWithAlumni =
    alumni.status === "locked" ? Object.values(alumni.counts).filter((n) => n > 0).length
    : alumni.status === "unlocked" ? Object.values(alumni.byCompany).filter((l) => l.length > 0).length
    : null;

  const shown = matches.filter(
    (m) =>
      (category === "all" || m.job.category === category) &&
      (type === "all" || m.job.type === type) &&
      (!remoteOnly || m.job.remote) &&
      m.score >= minScore,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <DevBanner show={mock} />
      <h1 className="text-3xl font-bold text-navy">Your matches</h1>
      <p className="mt-2 text-muted">
        {matches.length} roles ranked by fit{profile?.name ? ` for ${profile.name}` : ""}.
      </p>

      <section className="mt-6 rounded-2xl bg-navy p-6 text-white shadow-sm" aria-label="Your KTP network">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">Your KTP network</h2>
        {totalAlumni === null ? (
          <p className="mt-2 text-white/80">{alumni.status === "error" ? "Couldn't load alumni." : "Checking the KTP network…"}</p>
        ) : (
          <p className="mt-2 text-2xl font-bold">
            {totalAlumni} {totalAlumni === 1 ? "alum" : "alumni"}{" "}
            <span className="text-base font-normal text-white/80">
              across {companiesWithAlumni} of your {companies.length} matched companies
            </span>
          </p>
        )}
        {alumni.status === "locked" && (
          <>
            <p className="mt-2 text-sm text-white/80">Alumni contact info is for KTP members only. Enter the chapter passcode to view it.</p>
            <UnlockForm onUnlocked={loadAlumni} />
          </>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3" role="group" aria-label="Filters">
        <label className="sr-only" htmlFor="f-cat">Role category</label>
        <select id="f-cat" className={select} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-type">Role type</label>
        <select id="f-type" className={select} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">Internship + full-time</option>
          <option value="internship">Internship</option>
          <option value="full-time">Full-time</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
          Remote only
        </label>
        <label className="flex items-center gap-2 text-sm">
          Min match {minScore}%
          <input type="range" min={0} max={100} step={5} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        {shown.length === 0 && (
          <p className="rounded-2xl border border-line bg-white p-8 text-center text-muted">
            No roles match these filters. Try lowering the minimum match or clearing filters.
          </p>
        )}
        {shown.map((m) => <JobCard key={m.job.id} match={m} alumni={alumni} profile={profile} />)}
      </div>
    </div>
  );
}
