import { useMemo } from "react";
import type { ReactNode } from "react";
import { priorityMeta, severityOrder } from "../constants";
import type { Aggregate, Severity, TenderResult } from "../types";
import { getHighestSeverity } from "../utils";
import { useTranslation } from "../LanguageContext";

interface RiskOverviewProps {
  aggregate: Aggregate;
  results: TenderResult[];
  onSelectTender: (tenderId: string) => void;
}

export function RiskOverview({ aggregate, results, onSelectTender }: RiskOverviewProps): ReactNode {
  const { t, lang } = useTranslation();

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
    <section className="risk-panel" aria-label={lang === "en" ? "Risks" : "Ризики"}>
      <div className="panel-title">
        <h2>{lang === "en" ? "Risk Radar" : "Радар ризиків"}</h2>
        <span>{t("autoSignals")}</span>
      </div>
      <div className="severity-bars">
        {(["висока", "середня", "низька", "немає"] as Severity[]).map((severityKey) => {
          const count = aggregate.severityCounts[severityKey] || 0;
          const width = aggregate.total ? Math.max(5, (count / aggregate.total) * 100) : 0;
          const displaySeverityLabel = lang === "en"
            ? t(severityKey === "висока" ? "sev_high" : severityKey === "середня" ? "sev_medium" : severityKey === "низька" ? "sev_low" : "sev_none")
            : priorityMeta[severityKey].label;
          return (
            <div className="severity-row" key={severityKey}>
              <span>{displaySeverityLabel}</span>
              <div className="bar-track">
                <i className={`bar-${priorityMeta[severityKey].className}`} style={{ width: `${width}%` }} />
              </div>
              <strong>{count}</strong>
            </div>
          );
        })}
      </div>
      <div className="sector-list">
        <h3>{lang === "en" ? "Sectors" : "Сектори"}</h3>
        {aggregate.sectors.slice(0, 5).map(([sectorName, count]) => {
          // Localize sector name if English
          let displaySector = sectorName;
          if (lang === "en") {
            if (sectorName === "Сільське господарство та продукти") displaySector = "Agriculture & Products";
            else if (sectorName === "Нафтопродукти, паливо, електроенергія") displaySector = "Fuel & Energy";
            else if (sectorName === "Харчові продукти") displaySector = "Food Products";
            else if (sectorName === "Одяг та взуття") displaySector = "Clothing & Footwear";
            else if (sectorName === "Друкована продукція") displaySector = "Printed Matter";
            else if (sectorName === "Хімічна продукція") displaySector = "Chemical Products";
            else if (sectorName === "Офісна та комп'ютерна техніка") displaySector = "Office & IT Equipment";
            else if (sectorName === "Електричні машини") displaySector = "Electrical Machinery";
            else if (sectorName === "Радіо-, теле-, комунікаційне обладнання") displaySector = "Radio & Telecom Equipment";
            else if (sectorName === "Медичне обладнання та фармацевтика") displaySector = "Medical & Pharma";
            else if (sectorName === "Транспортне обладнання") displaySector = "Transport Equipment";
            else if (sectorName === "Охоронне та пожежне обладнання") displaySector = "Security & Fire Equipment";
            else if (sectorName === "Музичні інструменти, спорттовари та ігри") displaySector = "Music, Sports & Games";
            else if (sectorName === "Меблі та побутова продукція") displaySector = "Furniture & Appliances";
            else if (sectorName === "Промислова техніка") displaySector = "Industrial Machinery";
            else if (sectorName === "Будівельні матеріали") displaySector = "Construction Materials";
            else if (sectorName === "Будівельні роботи") displaySector = "Construction Works";
            else if (sectorName === "Програмне забезпечення") displaySector = "Software";
            else if (sectorName === "Ремонт і технічне обслуговування") displaySector = "Maintenance & Repair";
            else if (sectorName === "Послуги зі встановлення") displaySector = "Installation Services";
            else if (sectorName === "Готельні та ресторанні послуги") displaySector = "Hotel & Restaurant Services";
            else if (sectorName === "Транспортні послуги") displaySector = "Transport Services";
            else if (sectorName === "Допоміжні транспортні послуги") displaySector = "Auxiliary Transport Services";
            else if (sectorName === "Поштові та телекомунікаційні послуги") displaySector = "Postal & Telecom Services";
            else if (sectorName === "Комунальні послуги") displaySector = "Utilities";
            else if (sectorName === "Фінансові та страхові послуги") displaySector = "Financial & Insurance";
            else if (sectorName === "Нерухомість") displaySector = "Real Estate";
            else if (sectorName === "Архітектурні та інженерні послуги") displaySector = "Engineering & Architectural";
            else if (sectorName === "ІТ-послуги") displaySector = "IT Services";
            else if (sectorName === "Дослідження та розробки") displaySector = "Research & Development";
            else if (sectorName === "Адміністративні послуги") displaySector = "Administrative Services";
            else if (sectorName === "Сільськогосподарські та лісові послуги") displaySector = "Agricultural & Forestry";
            else if (sectorName === "Ділові послуги") displaySector = "Business Services";
            else if (sectorName === "Освітні послуги") displaySector = "Educational Services";
            else if (sectorName === "Охорона здоров'я та соціальні послуги") displaySector = "Health & Social Services";
            else if (sectorName === "Екологічні послуги") displaySector = "Environmental Services";
            else if (sectorName === "Культурні та спортивні послуги") displaySector = "Recreational & Cultural";
            else if (sectorName === "Інші послуги") displaySector = "Other Services";
            else if (sectorName === "інші галузі") displaySector = "other sectors";
          }
          return (
            <p key={sectorName}>
              <span>{displaySector}</span>
              <strong>{count}</strong>
            </p>
          );
        })}
      </div>
      <div className="watch-list">
        <h3>{lang === "en" ? "Highest Priority" : "Найвищий пріоритет"}</h3>
        {risky.map((result) => {
          const summary = result.summary;
          const highestSeverity = getHighestSeverity(result);
          const meta = priorityMeta[highestSeverity] || priorityMeta["немає"];
          const displayMetaLabel = lang === "en"
            ? t(highestSeverity === "висока" ? "sev_high" : highestSeverity === "середня" ? "sev_medium" : highestSeverity === "низька" ? "sev_low" : "sev_none")
            : meta.label;
          return (
            <a
              href={`/tenders/${summary.tender_id}`}
              key={summary.tender_id}
              onClick={(e) => {
                e.preventDefault();
                onSelectTender(summary.tender_id);
              }}
            >
              <strong>{summary.tender_code || (lang === "en" ? "No number" : "Без номера")}</strong>
              <span>{lang === "en" ? `${result.overall_score || 0} points · ${displayMetaLabel}` : `${result.overall_score || 0} балів · ${displayMetaLabel}`}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
