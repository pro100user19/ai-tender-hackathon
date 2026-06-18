import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "../LanguageContext";
import { CustomSelect } from "./CustomSelect";

interface Heuristic {
  category: string;
  title: string;
  severity: string;
  explanation: string;
  suggested_rewrite: string;
  subscores: string[];
  pattern: string;
}

export function HeuristicsView(): ReactNode {
  const { t } = useTranslation();
  const [heuristics, setHeuristics] = useState<Heuristic[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | "висока" | "середня" | "низька">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  useEffect(() => {
    fetch("/api/heuristics")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<Heuristic[]>;
      })
      .then((data) => {
        setHeuristics(data);
        setStatus("ready");
      })
      .catch((err: Error) => {
        setError(err.message || t("errorLoadingHeuristics"));
        setStatus("error");
      });
  }, []);

  const categories = Array.from(new Set(heuristics.map((h) => h.category))).sort();

  const filtered = heuristics.filter((h) => {
    const haystack = [h.category, h.title, h.explanation, h.suggested_rewrite]
      .join(" ")
      .toLocaleLowerCase("uk-UA");
    const matchesSearch = haystack.includes(search.trim().toLocaleLowerCase("uk-UA"));
    const matchesSeverity = selectedSeverity === "all" || h.severity === selectedSeverity;
    const matchesCategory = !selectedCategory || h.category === selectedCategory;

    return matchesSearch && matchesSeverity && matchesCategory;
  });

  if (status === "loading") {
    return (
      <div className="heuristics-view">
        <h2>{t("heuristicsTitle")}</h2>
        <p className="lead">{t("loadingRules")}</p>
        <div className="skeleton-table">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="heuristics-view">
        <h2>{t("errorLoadingHeuristics")}</h2>
        <p className="panel-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="heuristics-view">
      <div>
        <h2>{t("heuristicsTitle")}</h2>
        <p className="lead">
          {t("heuristicsDescription")}
        </p>
      </div>

      {/* Summary Metrics Grid */}
      <section className="metric-grid" aria-label="Статистика евристик" style={{ marginBottom: "8px" }}>
        <article className="metric-card tone-blue">
          <span>{t("totalHeuristics")}</span>
          <strong>{heuristics.length.toString()}</strong>
        </article>
        <article className="metric-card tone-red">
          <span>{t("highSeverity")}</span>
          <strong>{heuristics.filter((h) => h.severity === "висока").length.toString()}</strong>
        </article>
        <article className="metric-card tone-amber">
          <span>{t("mediumSeverity")}</span>
          <strong>{heuristics.filter((h) => h.severity === "середня").length.toString()}</strong>
        </article>
        <article className="metric-card tone-blue">
          <span>{t("lowSeverity")}</span>
          <strong>{heuristics.filter((h) => h.severity === "низька").length.toString()}</strong>
        </article>
      </section>

      {/* Advanced Filter Bar */}
      <div className="heuristics-filters" style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center",
        background: "var(--panel-soft)",
        padding: "16px",
        borderRadius: "8px",
        border: "1px solid var(--line)"
      }}>
        <div style={{ flex: "1 1 300px" }}>
          <input
            type="search"
            placeholder={t("searchHeuristicsPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ borderRadius: "20px", paddingLeft: "16px", margin: 0, width: "100%" }}
          />
        </div>

        <div style={{ minWidth: "240px" }}>
          <CustomSelect
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={[
              { label: `${t("allCategories")} (${categories.length.toString()})`, value: "" },
              ...categories.map((cat) => ({ label: cat, value: cat })),
            ]}
          />
        </div>

        <div className="severity-pills" style={{ display: "flex", gap: "6px" }}>
          {(["all", "висока", "середня", "низька"] as const).map((sev) => {
            const label = sev === "all" ? t("allPill") : t(`severity_${sev}`);
            const isActive = selectedSeverity === sev;
            return (
              <button
                key={sev}
                type="button"
                className={`pill-btn ${isActive ? "active" : ""}`}
                onClick={() => setSelectedSeverity(sev)}
                style={{
                  borderRadius: "20px",
                  padding: "8px 16px",
                  border: "1px solid var(--line)",
                  background: isActive ? "var(--navy)" : "var(--panel)",
                  color: isActive ? "#fff" : "var(--ink)",
                  fontWeight: isActive ? 600 : 400,
                  fontSize: "13px",
                  cursor: "pointer",
                  height: "38px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease"
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="heuristics-grid">
        {filtered.map((rule, idx) => {
          const sevClass = rule.severity === "висока" ? "high" : rule.severity === "середня" ? "medium" : "low";
          return (
            <div key={idx} className="heuristic-rule-card">
              <div className="heuristic-card-header">
                <span className="heuristic-category">{rule.category}</span>
                <span className={`heuristic-severity ${sevClass}`}>{t(`severity_${rule.severity}` as any)}</span>
              </div>
              <h3>{rule.title}</h3>
              <p className="heuristic-explanation">{rule.explanation}</p>
              {rule.suggested_rewrite && (
                <div className="heuristic-rewrite">
                  <strong>{t("recommendedEdit")}</strong> {rule.suggested_rewrite}
                </div>
              )}
              {rule.subscores && rule.subscores.length > 0 && (
                <div className="heuristic-subscores">
                  {rule.subscores.map((sub, sIdx) => (
                    <span key={sIdx} className="heuristic-subscore-tag">
                      {sub}
                    </span>
                  ))}
                </div>
              )}
              

            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p style={{ textAlign: "center", color: "var(--muted)", padding: "20px" }}>
          {t("noRulesFound")}
        </p>
      )}
    </div>
  );
}
