// POST { passcode } → sets the alumni access cookie if correct.
import { cookies } from "next/headers";
import { COOKIE, checkPasscode } from "@/lib/alumni/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const value = checkPasscode(typeof body.passcode === "string" ? body.passcode : "");
  if (!value) {
    return Response.json({ error: "Incorrect chapter passcode." }, { status: 401 });
  }
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return Response.json({ ok: true });
}
