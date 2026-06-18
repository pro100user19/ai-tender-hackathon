import type { ReactNode } from "react";
import type { Aggregate, Tone } from "../types";
import { formatInteger, scoreTone } from "../utils";
import { useTranslation } from "../LanguageContext";

interface Metric {
  label: string;
  value: string;
  tone: Tone;
}

interface MetricGridProps {
  aggregate: Aggregate;
}

export function MetricGrid({ aggregate }: MetricGridProps): ReactNode {
  const { lang } = useTranslation();
  const metrics: Metric[] = [
    { label: lang === "en" ? "Processed" : "Опрацьовано", value: formatInteger(aggregate.total), tone: "blue" },
    { label: lang === "en" ? "Avg Score" : "Середній бал", value: aggregate.averageScore, tone: scoreTone(aggregate.averageScore) },
    { label: lang === "en" ? "Potential Risks" : "Потенційні ризики", value: formatInteger(aggregate.issueCount), tone: "amber" },
    { label: lang === "en" ? "High Priority" : "Високий пріоритет", value: formatInteger(aggregate.highRiskCount), tone: "red" },
  ];

  return (
    <section className="metric-grid" aria-label={lang === "en" ? "Key Metrics" : "Ключові показники"}>
      {metrics.map((metric) => (
        <article className={`metric-card tone-${metric.tone}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </section>
  );
}
