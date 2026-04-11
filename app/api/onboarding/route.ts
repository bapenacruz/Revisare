import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const onboardingSchema = z.object({
  country: z.string().min(1, "Country is required").max(100),
  region: z.string().max(100).optional(),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "nonbinary", ""]).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { country, region, dob, gender } = parsed.data;

    // Validate DOB: must be a valid date and user must be at least 18 years old
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      return NextResponse.json({ error: "Invalid date of birth" }, { status: 400 });
    }
    const minAge = new Date();
    minAge.setFullYear(minAge.getFullYear() - 18);
    if (dobDate > minAge) {
      // Hard-delete the account — underage users cannot register
      await db.user.delete({ where: { id: session.user.id } }).catch(() => null);
      return NextResponse.json({ error: "You must be at least 18 years old to use Revisare. Your account has been removed." }, { status: 403 });
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        country,
        region: region || null,
        dob: dobDate,
        gender: gender || null,
        onboardingComplete: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
