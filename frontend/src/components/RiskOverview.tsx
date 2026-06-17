import { useMemo } from "react";
import type { ReactNode } from "react";
import { priorityMeta, severityOrder } from "../constants";
import type { Aggregate, Severity, TenderResult } from "../types";
import { getHighestSeverity } from "../utils";

interface RiskOverviewProps {
  aggregate: Aggregate;
  results: TenderResult[];
  onSelectTender: (tenderId: string) => void;
}

export function RiskOverview({ aggregate, results, onSelectTender }: RiskOverviewProps): ReactNode {
  const risky = useMemo(() => {
    return [...results]
      .sort((left, right) => {
        const priorityDelta = severityOrder[getHighestSeverity(right)] - severityOrder[getHighestSeverity(left)];
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return Number(left.overall_score || 0) - Number(right.overall_score || 0);
      })
      .slice(0, 4);
  }, [results]);

  return (
    <section className="risk-panel" aria-label="Ризики">
      <div className="panel-title">
        <h2>Радар ризиків</h2>
        <span>сигнали</span>
      </div>
      <div className="severity-bars">
        {(["висока", "середня", "низька", "немає"] as Severity[]).map((severityKey) => {
          const count = aggregate.severityCounts[severityKey] || 0;
          const width = aggregate.total ? Math.max(5, (count / aggregate.total) * 100) : 0;
          return (
            <div className="severity-row" key={severityKey}>
              <span>{priorityMeta[severityKey].label}</span>
              <div className="bar-track">
                <i className={`bar-${priorityMeta[severityKey].className}`} style={{ width: `${width}%` }} />
              </div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
      <div className="sector-list">
        <h3>Сектори</h3>
        {aggregate.sectors.slice(0, 5).map(([sectorName, count]) => (
          <p key={sectorName}>
            <span>{sectorName}</span>
            <strong>{count}</strong>
          </p>
        ))}
      </div>
      <div className="watch-list">
        <h3>Найвищий пріоритет</h3>
        {risky.map((result) => {
          const summary = result.summary;
          const highestSeverity = getHighestSeverity(result);
          const meta = priorityMeta[highestSeverity] || priorityMeta["немає"];
          return (
            <a
              href={`/tenders/${summary.tender_id}`}
              key={summary.tender_id}
              onClick={(e) => {
                e.preventDefault();
                onSelectTender(summary.tender_id);
              }}
            >
              <strong>{summary.tender_code || "Без номера"}</strong>
              <span>{`${result.overall_score || 0} балів · ${meta.label}`}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
