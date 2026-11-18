"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorBox, StepIndicator, UploadDropzone } from "@/components/flow";
import { Button, Card } from "@/components/ui";
import {
  CATEGORIES,
  CLASS_YEARS,
  CLASS_YEAR_LABELS,
  MAX_RESUME_BYTES,
  type Category,
  type ClassYear,
  type RoleType,
} from "@/lib/schemas";
import { saveFlow } from "@/lib/session";

const label = "mb-2 block text-sm font-semibold text-ink";
const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm focus:border-accent";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [otherInterest, setOther] = useState("");
  const [classYear, setClassYear] = useState<ClassYear | "">("");
  const [roleType, setRoleType] = useState<RoleType>("internship");
  const [location, setLocation] = useState("");
  const [remoteOk, setRemoteOk] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (c: Category) =>
    setCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Please upload your resume.");
    if (!classYear) return setError("Please pick your class year.");
    if (categories.length === 0 && !otherInterest.trim()) return setError("Pick at least one role interest.");
    setError(null);
    setLoading(true);
    try {
      const body = new FormData();
      body.append("resume", file);
      const res = await fetch("/api/analyze-resume", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      saveFlow({
        profile: data.profile,
        mock: data.mock,
        matches: undefined,
        prefs: { categories, otherInterest, classYear, roleType, location, remoteOk },
      });
      router.push("/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-4 py-20">
        <StepIndicator active={0} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-navy">Upload your resume</h1>
      <p className="mt-2 text-muted">Tell us what you&apos;re looking for and we&apos;ll do the rest.</p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <UploadDropzone
          file={file}
          maxBytes={MAX_RESUME_BYTES}
          onFile={(f, err) => {
            setFile(f);
            setError(err ?? null);
          }}
        />

        <Card>
          <fieldset>
            <legend className={label}>Roles you&apos;re interested in</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = categories.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    aria-pressed={on}
                    onClick={() => toggle(c)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      on ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:bg-tint"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <label htmlFor="other" className="mt-4 mb-1 block text-sm text-muted">
              Other (optional)
            </label>
            <input id="other" className={field} placeholder="e.g. Hardware, Fintech" value={otherInterest} onChange={(e) => setOther(e.target.value)} />
          </fieldset>
        </Card>

        <Card className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="year" className={label}>Class year</label>
            <select id="year" className={field} value={classYear} onChange={(e) => setClassYear(e.target.value as ClassYear)}>
              <option value="">Select…</option>
              {CLASS_YEARS.map((y) => (
                <option key={y} value={y}>{CLASS_YEAR_LABELS[y]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type" className={label}>Role type</label>
            <select id="type" className={field} value={roleType} onChange={(e) => setRoleType(e.target.value as RoleType)}>
              <option value="internship">Internship</option>
              <option value="full-time">Full-time</option>
              <option value="either">Either</option>
            </select>
          </div>
          <div>
            <label htmlFor="loc" className={label}>Location (optional)</label>
            <input id="loc" className={field} placeholder="e.g. New York" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input type="checkbox" className="h-4 w-4 accent-[var(--ktp-accent)]" checked={remoteOk} onChange={(e) => setRemoteOk(e.target.checked)} />
            Remote is OK
          </label>
        </Card>

        <ErrorBox message={error} />
        <Button type="submit" className="w-full py-3 text-base">Analyze my resume</Button>
      </form>
    </div>
  );
}
