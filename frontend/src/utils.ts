import { severityOrder } from "./constants";
import type { Aggregate, Severity, SortKey, TenderResult, Tone } from "./types";

export function computeAggregate(results: TenderResult[]): Aggregate {
  const total = results.length;
  const issueCount = results.reduce((sum, result) => sum + (result.issues || []).length, 0);
  const highRiskCount = results.reduce(
    (sum, result) => sum + (result.issues || []).filter((issue) => issue.severity === "висока").length,
    0,
  );
  const totalValue = results.reduce((sum, result) => {
    const value = result.summary && Number(result.summary.value_amount);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const scoreSum = results.reduce((sum, result) => sum + Number(result.overall_score || 0), 0);
  const severityCounts: Record<Severity, number> = { "висока": 0, "середня": 0, "низька": 0, "немає": 0 };
  const sectorCounts: Record<string, number> = {};

  results.forEach((result) => {
    const highestSeverity = getHighestSeverity(result);
    severityCounts[highestSeverity] = (severityCounts[highestSeverity] || 0) + 1;
    const sector = result.summary && result.summary.sector;
    if (sector) {
      sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    }
  });

  return {
    averageScore: total ? (Math.round((scoreSum / total) * 10) / 10).toString() : "0",
    highRiskCount,
    issueCount,
    sectors: Object.entries(sectorCounts).sort((left, right) => right[1] - left[1]),
    severityCounts,
    total,
    totalValue,
  };
}

export function getHighestSeverity(result: TenderResult): Severity {
  const issues = result.issues || [];
  if (!issues.length) {
    return "немає";
  }
  return issues.reduce<Severity>((highest, issue) => {
    return (severityOrder[issue.severity] || 0) > (severityOrder[highest] || 0) ? issue.severity : highest;
  }, "немає");
}

export function sortResults(results: TenderResult[], sort: SortKey): TenderResult[] {
  return [...results].sort((left, right) => {
    if (sort === "score_asc") {
      return Number(left.overall_score || 0) - Number(right.overall_score || 0);
    }
    if (sort === "score_desc") {
      return Number(right.overall_score || 0) - Number(left.overall_score || 0);
    }
    if (sort === "priority_desc") {
      return severityOrder[getHighestSeverity(right)] - severityOrder[getHighestSeverity(left)];
    }
    if (sort === "priority_asc") {
      return severityOrder[getHighestSeverity(left)] - severityOrder[getHighestSeverity(right)];
    }
    if (sort === "value_desc") {
      return Number(right.summary.value_amount || 0) - Number(left.summary.value_amount || 0);
    }
    return new Date(right.processed_at || 0).getTime() - new Date(left.processed_at || 0).getTime();
  });
}

export function parseScore(value: string): number | null {
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.min(100, parsed));
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "uk-UA"));
}

export function scoreTone(score: string | number): Tone {
  const numericScore = Number(score || 0);
  if (numericScore >= 85) {
    return "green";
  }
  if (numericScore >= 70) {
    return "amber";
  }
  return "red";
}

export function formatInteger(value: string | number): string {
  return new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function formatUah(value: number | null | undefined | "", currency: string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "не вказано";
  }
  return `${formatInteger(value)} ${currency || "UAH"}`;
}

export function formatCompactUah(value: number): string {
  const amount = Number(value || 0);
  if (amount >= 1000000000) {
    return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(amount / 1000000000)} млрд UAH`;
  }
  if (amount >= 1000000) {
    return `${new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(amount / 1000000)} млн UAH`;
  }
  return formatUah(amount, "UAH");
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "не вказано";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace("T", " ").slice(0, 16);
  }
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
