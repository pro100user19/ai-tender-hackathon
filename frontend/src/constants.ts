import type { PriorityMeta, Severity, SortKey } from "./types";

export const severityOrder: Record<Severity, number> = {
  "висока": 3,
  "середня": 2,
  "низька": 1,
  "немає": 0,
};

export const priorityMeta: Record<Severity, PriorityMeta> = {
  "висока": { label: "високий", className: "high" },
  "середня": { label: "середній", className: "medium" },
  "низька": { label: "низький", className: "low" },
  "немає": { label: "без сигналів", className: "none" },
};

export const sortLabels: Record<SortKey, string> = {
  processed_desc: "Новіші спочатку",
  score_asc: "Нижчий бал спочатку",
  score_desc: "Вищий бал спочатку",
  priority_desc: "Вищий пріоритет спочатку",
  priority_asc: "Нижчий пріоритет спочатку",
  value_desc: "Більша вартість спочатку",
};
