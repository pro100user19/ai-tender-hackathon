import type { ReactNode } from "react";
import type { Aggregate, Tone } from "../types";
import { formatInteger, scoreTone } from "../utils";

interface Metric {
  label: string;
  value: string;
  tone: Tone;
}

interface MetricGridProps {
  aggregate: Aggregate;
}

export function MetricGrid({ aggregate }: MetricGridProps): ReactNode {
  const metrics: Metric[] = [
    { label: "Опрацьовано", value: formatInteger(aggregate.total), tone: "blue" },
    { label: "Середній бал", value: aggregate.averageScore, tone: scoreTone(aggregate.averageScore) },
    { label: "Потенційні ризики", value: formatInteger(aggregate.issueCount), tone: "amber" },
    { label: "Високий пріоритет", value: formatInteger(aggregate.highRiskCount), tone: "red" },
  ];

  return (
    <section className="metric-grid" aria-label="Ключові показники">
      {metrics.map((metric) => (
        <article className={`metric-card tone-${metric.tone}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </section>
  );
}
