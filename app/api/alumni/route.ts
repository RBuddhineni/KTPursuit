// POST { companies: string[] }
//   locked   → { unlocked: false, total, counts: { [company]: number } }   (no personal info)
//   unlocked → { unlocked: true,  total, byCompany: { [company]: AlumniHit[] } }
// total = unique alumni across all the companies (someone at two companies counts once).
// There is deliberately no way to list all alumni.
import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE, isUnlocked } from "@/lib/alumni/auth";
import { alumniForCompanies } from "@/lib/alumni/store";

const Body = z.object({ companies: z.array(z.string().max(100)).max(25) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  const byCompany = alumniForCompanies([...new Set(parsed.data.companies)]);
  const total = new Set(Object.values(byCompany).flat().map((a) => a.id)).size;
  if (isUnlocked((await cookies()).get(COOKIE)?.value)) {
    return Response.json({ unlocked: true, total, byCompany });
  }
  const counts = Object.fromEntries(Object.entries(byCompany).map(([c, list]) => [c, list.length]));
  return Response.json({ unlocked: false, total, counts });
}
