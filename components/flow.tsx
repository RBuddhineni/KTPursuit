"use client";
// Flow-specific components: UploadDropzone, StepIndicator, DevBanner, ErrorBox.
import { useRef, useState } from "react";

export function UploadDropzone({
  file,
  onFile,
  maxBytes,
}: {
  file: File | null;
  onFile: (f: File | null, error?: string) => void;
  maxBytes: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(f: File | undefined) {
    if (!f) return;
    const ok = /\.(pdf|docx)$/i.test(f.name);
    if (!ok) return onFile(null, "Please choose a PDF or DOCX file.");
    if (f.size > maxBytes) return onFile(null, "That file is over 4.5 MB.");
    onFile(f);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload resume: drop a file or press Enter to browse"
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => (e.preventDefault(), setDragging(true))}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files[0]);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragging ? "border-accent bg-tint" : "border-line bg-white hover:border-accent hover:bg-tint/50"
      }`}
    >
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <svg aria-hidden className="mb-3 h-10 w-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      {file ? (
        <p className="font-medium text-navy">{file.name}</p>
      ) : (
        <p className="font-medium text-ink">
          Drag your resume here, or <span className="text-accent underline">browse</span>
        </p>
      )}
      <p className="mt-1 text-xs text-muted">PDF or DOCX, up to 4.5 MB. Processed in memory, never stored.</p>
    </div>
  );
}

export const STEPS = ["Reading resume", "Finding roles", "Checking KTP network"];

export function StepIndicator({ active }: { active: number }) {
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <ol className="space-y-3">
        {STEPS.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  done ? "bg-success text-white" : current ? "bg-accent text-white" : "bg-tint text-muted"
                }`}
              >
                {done ? "✓" : current ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : i + 1}
              </span>
              <span className={current ? "font-semibold text-navy" : done ? "text-ink" : "text-muted"}>
                {label}
                {current && "…"}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function DevBanner({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <p className="mb-6 rounded-xl border border-warn/30 bg-amber-50 px-4 py-2 text-sm text-warn">
      Dev mode: no ANTHROPIC_API_KEY set, so profiles and fit scores are mock data.
    </p>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}
