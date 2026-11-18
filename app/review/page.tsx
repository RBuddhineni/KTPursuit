"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DevBanner, ErrorBox, StepIndicator } from "@/components/flow";
import { Button, Card, LinkButton } from "@/components/ui";
import type { Preferences, Profile } from "@/lib/schemas";
import { loadFlow, saveFlow, useMounted } from "@/lib/session";

export default function ReviewPage() {
  const mounted = useMounted();
  if (!mounted) return null;
  const { profile, prefs, mock } = loadFlow();
  if (!profile || !prefs) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted">No resume analyzed yet.</p>
        <LinkButton href="/upload" className="mt-4">Upload your resume</LinkButton>
      </div>
    );
  }
  return <ReviewForm initial={profile} prefs={prefs} mock={mock} />;
}

const label = "mb-1 block text-sm font-semibold text-ink";
const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:border-accent";

function ReviewForm({ initial, prefs, mock }: { initial: Profile; prefs: Preferences; mock?: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [step, setStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((cur) => ({ ...cur, [k]: v }));

  async function findMatches() {
    const profile = { ...p, skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean) };
    saveFlow({ profile });
    setError(null);
    setStep(1);
    // Advance to "Checking KTP network" after a moment so the indicator feels alive.
    const timer = setTimeout(() => setStep(2), 2500);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, prefs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Matching failed.");
      saveFlow({ matches: data.matches, mock: data.mock });
      router.push("/results");
    } catch (err) {
      clearTimeout(timer);
      setStep(null);
      setError(err instanceof Error ? err.message : "Matching failed.");
    }
  }

  if (step !== null) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <StepIndicator active={step} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <DevBanner show={mock} />
      <h1 className="text-3xl font-bold text-navy">Review your profile</h1>
      <p className="mt-2 text-muted">Here&apos;s what we pulled from your resume. Fix anything that looks off.</p>

      <Card className="mt-8 grid gap-4 sm:grid-cols-2">
        {(
          [
            ["name", "Name"],
            ["major", "Major"],
            ["school", "School"],
            ["gradYear", "Grad year"],
          ] as const
        ).map(([k, l]) => (
          <div key={k}>
            <label htmlFor={k} className={label}>{l}</label>
            <input id={k} className={field} value={p[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label htmlFor="level" className={label}>Experience level</label>
          <select id="level" className={field} value={p.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value as Profile["experienceLevel"])}>
            <option value="beginner">Beginner: coursework and projects</option>
            <option value="intermediate">Intermediate: 1–2 internships or major projects</option>
            <option value="advanced">Advanced: multiple internships or full-time</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="skills" className={label}>Skills (comma-separated)</label>
          <textarea id="skills" rows={3} className={field} value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">Experience</h2>
        {p.experiences.length === 0 && <p className="text-sm text-muted">No experience entries found.</p>}
        <ul className="space-y-4">
          {p.experiences.map((x, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-2">
              <input aria-label="Title" className={field} value={x.title} onChange={(e) => set("experiences", p.experiences.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} />
              <input aria-label="Company" className={field} value={x.company} onChange={(e) => set("experiences", p.experiences.map((y, j) => (j === i ? { ...y, company: e.target.value } : y)))} />
              <p className="text-xs text-muted sm:col-span-2">{x.dates} {x.summary && `· ${x.summary}`}</p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 space-y-3">
        <ErrorBox message={error} />
        <Button onClick={findMatches} className="w-full py-3 text-base">Find my matches</Button>
      </div>
    </div>
  );
}
