import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { updateTaskSchema } from "@/lib/validation";

// Allow time for a Neon serverless cold start (handled by the retry in
// src/lib/prisma.ts) before Vercel times the function out.
export const maxDuration = 30;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Scope the update to the current user so users can only modify their own
  // tasks. updateMany returns a count we can use to detect "not found".
  const result = await prisma.task.updateMany({
    where: { id, userId: user.userId },
    data: { status: parsed.data.status },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, title: true, status: true, createdAt: true },
  });

  return NextResponse.json({ task }, { status: 200 });
}
