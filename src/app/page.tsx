import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import TaskBoard from "@/components/TaskBoard";

// Allow time for a Neon serverless cold start (handled by the retry in
// src/lib/prisma.ts) before Vercel times the function out.
export const maxDuration = 30;

export default async function HomePage() {
  // Defense in depth: middleware already guards this route, but we also
  // verify on the server before rendering.
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-slate-900">Task Board</h1>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <TaskBoard />
      </div>
    </main>
  );
}
