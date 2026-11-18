# KTPursuit

Built by KTP Alpha Eta pledges (Push2Prod). A student uploads a resume and picks the roles they're interested in. AI extracts their profile and ranks matching internships and full-time roles, each with a match percentage. Each matched company then lists the KTP alumni who worked or interned there, with an editable intro message.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Anthropic API (`@anthropic-ai/sdk`) · zod

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in values (optional, see below)
npm run dev                  # http://localhost:3000
```

Without an API key the app runs in **mock mode**: a keyword scan stands in for AI extraction, and fit scores are estimated. A yellow banner says so.

## Environment variables

| Variable | Needed? | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | For real AI | Resume → profile extraction and job-fit scoring. Missing = mock mode. |
| `CHAPTER_PASSCODE` | **Yes in production** | Shared passcode that unlocks alumni names and contact info. Defaults to `ktp-dev` locally. If it isn't set in production, the alumni section stays locked. |

On Vercel, add both under Project → Settings → Environment Variables.

## How it works

1. **`/upload`**: the resume (PDF or DOCX, ≤ 4.5 MB, which is Vercel's request limit) goes to `POST /api/analyze-resume`. It's converted to text in memory (`unpdf` / `mammoth`), sent to Claude, and discarded. It is never stored.
2. **`/review`**: the student edits the extracted profile. State lives only in the browser's sessionStorage.
3. **`/results`**: `POST /api/match` filters and ranks jobs. See **`lib/matching.ts`** for the score formula (skills 40%, interest 20%, class-year level fit 15%, AI judgment 25%). It uses class year, never age.
4. **Alumni**: `POST /api/alumni` takes a list of company names. Before unlocking it returns only counts. After the passcode is entered (httpOnly signed cookie), it returns the alumni for those companies only. There is no endpoint that lists everyone. Company names are matched through an alias map in `lib/alumni/companies.ts` ("Facebook" → Meta, "Google LLC" → Google, …).

## Where to change things

- **Colors:** CSS variables at the top of `app/globals.css`
- **AI prompts:** `lib/ai/prompts.ts`
- **Scoring weights and rules:** `lib/matching.ts`
- **Jobs:** `data/jobs.json` (85 seeded postings). To use a real API (JSearch, Adzuna), implement the `JobSource` interface in `lib/jobs/index.ts`.
- **Company aliases:** `lib/alumni/companies.ts`

## Importing real alumni data

`data/alumni.json` is **fake sample data**. Real alumni data must never be committed, because this repo is public.

1. Export the alumni database as CSV with one row per job, using these columns:
   `name, ktp_class, grad_year, major, email, linkedin, company, title, type, start_year, end_year`
   (`type` = internship / full-time; `end_year` blank = current role. Rows with the same email are merged.)
2. Run:
   ```bash
   npm run import:alumni -- path/to/export.csv
   ```
   This writes `data/alumni.private.json`, which is gitignored. The app uses it in place of the sample data whenever it exists. Restart `npm run dev` after importing.

**Production note:** because the private file isn't in git, Vercel deployments still use the sample data. Before launch, move the real data to private storage (for example Vercel Blob or a database) and load it in `lib/alumni/store.ts`.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run import:alumni -- file.csv`
