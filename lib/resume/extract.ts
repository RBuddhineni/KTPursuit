// Turn an uploaded resume into plain text, entirely in memory. Nothing is written to disk.
import { extractText } from "unpdf";
import mammoth from "mammoth";

import { MAX_RESUME_BYTES } from "@/lib/schemas";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class ResumeError extends Error {}

export async function extractResumeText(file: File): Promise<string> {
  if (file.size > MAX_RESUME_BYTES) throw new ResumeError("File is larger than 4.5 MB.");
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  let text: string;
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const result = await extractText(bytes, { mergePages: true });
    text = result.text;
  } else if (file.type === DOCX_MIME || name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    text = result.value;
  } else {
    throw new ResumeError("Please upload a PDF or DOCX file.");
  }

  text = text.replace(/\s+\n/g, "\n").trim();
  if (text.length < 50) {
    throw new ResumeError("Couldn't read text from that file. Is it a scanned image? Try a text-based PDF.");
  }
  return text;
}
