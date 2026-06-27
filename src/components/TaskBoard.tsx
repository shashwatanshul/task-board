"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  STATUSES,
  STATUS_BADGE_CLASSES,
  STATUS_LABELS,
  type Task,
  type TaskStatus,
} from "@/lib/status";

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-slate-500"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("Todo");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/tasks");
        if (!res.ok) throw new Error("Failed to load tasks");
        const data = (await res.json()) as { tasks: Task[] };
        if (active) setTasks(data.tasks);
      } catch {
        if (active) {
          setLoadError("Could not load tasks. Please refresh the page.");
          setTasks([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCreateError(data?.error ?? "Could not create task.");
        return;
      }
      const data = (await res.json()) as { task: Task };
      setTasks((prev) => (prev ? [data.task, ...prev] : [data.task]));
      setTitle("");
      setNewStatus("Todo");
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    const previous = tasks;
    // Optimistic update.
    setTasks((prev) =>
      prev
        ? prev.map((t) => (t.id === taskId ? { ...t, status } : t))
        : prev,
    );
    setUpdatingId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      // Roll back on failure.
      setTasks(previous ?? null);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 sm:flex-row sm:items-start"
      >
        <div className="flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a new task..."
            maxLength={200}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
          />
          {createError && (
            <p className="mt-1 text-sm text-red-600">{createError}</p>
          )}
        </div>
        <label className="sr-only" htmlFor="new-task-status">
          Initial status
        </label>
        <select
          id="new-task-status"
          value={newStatus}
          disabled={creating}
          onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
          className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={creating || title.trim().length === 0}
          className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? "Adding..." : "Add task"}
        </button>
      </form>

      {/* Loading state */}
      {tasks === null && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      )}

      {loadError && tasks !== null && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {/* Empty state */}
      {tasks !== null && tasks.length === 0 && !loadError && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center">
          <p className="text-slate-600">No tasks yet.</p>
          <p className="text-sm text-slate-400">
            Add your first task using the field above.
          </p>
        </div>
      )}

      {/* Task list */}
      {tasks !== null && tasks.length > 0 && (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="group relative flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
                {/* Status and Title row */}
                <div className="flex items-center justify-between gap-3 sm:w-28 sm:flex-shrink-0 sm:justify-start">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide whitespace-nowrap ${STATUS_BADGE_CLASSES[task.status]}`}
                  >
                    {STATUS_LABELS[task.status]}
                  </span>
                  
                  {/* Mobile-only saving spinner */}
                  {updatingId === task.id && (
                    <span
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-500 sm:hidden"
                      role="status"
                    >
                      <Spinner />
                      Saving...
                    </span>
                  )}
                </div>

                {/* Title */}
                <span className="break-words text-sm font-medium text-slate-800 sm:text-base sm:font-normal">
                  {task.title}
                </span>
              </div>

              {/* Action area (Select input) */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 sm:border-t-0 sm:pt-0 sm:justify-end sm:gap-3">
                {/* Desktop-only saving spinner */}
                {updatingId === task.id && (
                  <span
                    className="hidden items-center gap-1.5 text-xs font-medium text-slate-500 sm:flex"
                    role="status"
                  >
                    <Spinner />
                    Saving...
                  </span>
                )}
                
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <label 
                    htmlFor={`status-${task.id}`}
                    className="text-xs font-medium text-slate-500 sm:hidden"
                  >
                    Update status :
                  </label>
                  <select
                    id={`status-${task.id}`}
                    value={task.status}
                    disabled={updatingId === task.id}
                    aria-busy={updatingId === task.id}
                    onChange={(e) =>
                      handleStatusChange(task.id, e.target.value as TaskStatus)
                    }
                    className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all hover:bg-slate-100 hover:border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
