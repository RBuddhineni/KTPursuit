// POST multipart/form-data { resume: File } → { profile, mock }
// The file is read into memory, converted to text, sent to the AI, then discarded.
import { extractProfile, isMockMode } from "@/lib/ai/client";
import { ResumeError, extractResumeText } from "@/lib/resume/extract";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("resume");
    if (!(file instanceof File)) {
      return Response.json({ error: "No resume file uploaded." }, { status: 400 });
    }
    const text = await extractResumeText(file);
    const profile = await extractProfile(text);
    return Response.json({ profile, mock: isMockMode() });
  } catch (err) {
    if (err instanceof ResumeError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("analyze-resume failed", err);
    return Response.json({ error: "Something went wrong reading your resume. Please try again." }, { status: 500 });
  }
}
