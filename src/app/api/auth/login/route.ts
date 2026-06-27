import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, verifyPassword } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

// Allow time for a Neon serverless cold start (handled by the retry in
// src/lib/prisma.ts) before Vercel times the function out.
export const maxDuration = 30;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Use the same error for "no user" and "wrong password" to avoid leaking
  // which emails are registered.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  await setAuthCookie({ userId: user.id, email: user.email });

  return NextResponse.json(
    { user: { id: user.id, email: user.email } },
    { status: 200 },
  );
}
