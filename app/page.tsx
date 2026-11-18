import { Card, LinkButton } from "@/components/ui";

const steps = [
  {
    title: "Upload your resume",
    body: "PDF or DOCX. We read it in memory and never store it.",
  },
  {
    title: "Get matched roles",
    body: "AI scores roles in the fields you pick against your skills and class year.",
  },
  {
    title: "Reach out to KTP alumni",
    body: "See brothers who worked or interned at each company, with a ready-to-send intro.",
  },
];

export default function Home() {
  return (
    <>
      <section className="bg-gradient-to-b from-tint to-page">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="mb-4 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent shadow-sm">
            Kappa Theta Pi · Alpha Eta
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-navy sm:text-5xl">
            Find roles that fit you, and the KTP alumni who can get you there.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            KTPursuit reads your resume, recommends internships and full-time roles matched to your
            skills and level, then connects you to the KTP network at each company.
          </p>
          <div className="mt-8 flex justify-center">
            <LinkButton href="/upload" className="px-7 py-3 text-base">
              Upload your resume
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="mb-8 text-center text-2xl font-bold text-navy">How it works</h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
