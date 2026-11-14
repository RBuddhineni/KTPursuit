# Internship desk

Local desk for browsing public **PM** and **SWE** internship listings, tailoring a resume from your own bullets, and drafting reviewed outreach.

## Run

```bash
npm install
npm start
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

## Notes

- Toggle **PM** / **SWE** in the header. Each track caches its own search.
- PM listings pull from public Greenhouse / Ashby / Lever boards plus the Jobright PM list.
- SWE listings use the same boards plus Simplify’s Summer 2027 SWE section (roles aged ≤ 7 days).
- Profile, resume uploads, SMTP secrets, and application drafts stay in the local `data/` folder (gitignored). Nothing is uploaded until you submit or send.
- Apply only works for Greenhouse boards with a public submit API. Other sources open the company listing.

## Privacy

Do not commit `data/`. It can hold your resume, email password, and drafts.
