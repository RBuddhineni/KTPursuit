// Small shared UI building blocks: Button, LinkButton, Card, Chip.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-hover shadow-sm",
  secondary: "bg-white text-navy border border-line hover:bg-tint",
  ghost: "text-accent hover:bg-tint",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/** Solid chip = matched skill, outlined chip = missing skill. */
export function Chip({ children, outlined = false }: { children: ReactNode; outlined?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        outlined ? "border border-dashed border-muted/60 text-muted" : "bg-tint text-navy"
      }`}
    >
      {children}
    </span>
  );
}
