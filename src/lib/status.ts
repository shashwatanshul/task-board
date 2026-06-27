// Client-safe task status definitions. These string values must match the
// `Status` enum in prisma/schema.prisma exactly.

export const STATUSES = ["Todo", "InProgress", "Done"] as const;

export type TaskStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  Todo: "Todo",
  InProgress: "In Progress",
  Done: "Done",
};

export const STATUS_BADGE_CLASSES: Record<TaskStatus, string> = {
  Todo: "bg-slate-100 text-slate-700",
  InProgress: "bg-amber-100 text-amber-800",
  Done: "bg-emerald-100 text-emerald-800",
};

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
};
