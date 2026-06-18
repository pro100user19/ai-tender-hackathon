import type { ReactNode } from "react";
import { useState } from "react";
import type { TenderResult } from "../types";
import { formatDate, formatUah, getHighestSeverity } from "../utils";
import { priorityMeta } from "../constants";
import { useTranslation } from "../LanguageContext";

interface TenderDetailProps {
  result: TenderResult;
  onClose: () => void;
}

export function TenderDetail({ result, onClose }: TenderDetailProps): ReactNode {
  const { t, lang } = useTranslation();
  const [activeTab, setActiveTab] = useState<"risks" | "doc-review" | "tech-details">("risks");
  const [isOwner, setIsOwner] = useState<boolean>(() => {
    return localStorage.getItem("role_is_owner") === "true";
  });

  const handleToggleOwner = (checked: boolean) => {
    setIsOwner(checked);
    localStorage.setItem("role_is_owner", String(checked));
  };

  const effectiveIsOwner = !!(result.is_private || (isOwner && result.is_user_request));

  const summary = result.summary;
  const highestSeverity = getHighestSeverity(result);
  const meta = priorityMeta[highestSeverity] || priorityMeta["немає"];
  const issues = result.issues || [];
  
  // Group issues by category
  const groupedIssues: Record<string, typeof issues> = {};
  issues.forEach((issue) => {
    const cat = issue.category || "інші ризики";
    if (!groupedIssues[cat]) {
      groupedIssues[cat] = [];
    }
    groupedIssues[cat].push(issue);
  });

  const subscores = result.subscores || {};
  const review = result.document_review || {};
  const documents = result.documents || [];
  const limitations = result.limitations || [];
  const llmUsage = result.llm_usage || {};

  // Formatter for tokens
  const formatTokens = (val: number | undefined) => {
    if (val === undefined) return "0";
    return new Intl.NumberFormat("uk-UA").format(val);
  };

  // Formatter for USD cost
  const formatUsd = (val: number | undefined) => {
    if (val === undefined) return "$0.0000";
    if (val < 0.0001) return `$${val.toFixed(6)}`;
    return `$${val.toFixed(4)}`;
  };

  const displayPriority = lang === "en"
    ? (highestSeverity === "висока" ? "high" : highestSeverity === "середня" ? "medium" : highestSeverity === "низька" ? "low" : "none")
    : meta.label;

  return (
    <div className="tender-detail-view">
      <nav className="crumb">
        <a href="/" onClick={(e) => { e.preventDefault(); onClose(); }}>
          {t("backToList")}
        </a>
      </nav>

      <section className="detail-head">
        <div>
          <p className="eyebrow">{summary.tender_code}</p>
          <h1>{summary.title}</h1>
          <p>
            {summary.buyer_name} · {formatUah(summary.value_amount, summary.currency)} · {summary.cpv || (lang === "en" ? "CPV not specified" : "CPV не вказано")}
          </p>
        </div>
        <div className="score-block">
          <span>{t("overallScoreLabel")}</span>
          <strong>{result.overall_score}</strong>
          <em>{displayPriority} {t("priorityLevel")}</em>
        </div>
      </section>

      <section className="subscores" aria-label={t("subscoresLabel")}>
        {Object.entries(subscores).map(([name, value]) => {
          // Localize subscore names if English
          let displayName = name;
          if (lang === "en") {
            if (name === "повнота") displayName = "Completeness";
            else if (name === "зрозумілість") displayName = "Clarity";
            else if (name === "конкурентність") displayName = "Competitiveness";
            else if (name === "технічна нейтральність") displayName = "Tech Neutrality";
            else if (name === "якість проєкту договору") displayName = "Contract Quality";
          }
          return (
            <div className="subscore" key={name} style={{ borderTop: "3px solid var(--blue)" }}>
              <span>{displayName}</span>
              <meter min="0" max="100" value={value}></meter>
              <strong>{value}</strong>
            </div>
          );
        })}
      </section>

      <div className="detail-tabs-container">
        <div className="detail-tabs-nav">
          <button
            className={`detail-tab-btn ${activeTab === "risks" ? "active" : ""}`}
            onClick={() => setActiveTab("risks")}
          >
            {t("potentialRisksTab")}
          </button>
          <button
            className={`detail-tab-btn ${activeTab === "doc-review" ? "active" : ""}`}
            onClick={() => setActiveTab("doc-review")}
          >
            {t("requirementsTab")}
          </button>
          <button
            className={`detail-tab-btn ${activeTab === "tech-details" ? "active" : ""}`}
            onClick={() => setActiveTab("tech-details")}
          >
            {t("techDetailsTab")}
          </button>
        </div>

        {/* Tab 1: Risks */}
        {activeTab === "risks" && (
          <div className="detail-tab-content active" id="tab-risks">
            <section className="issues">
              <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h2>{t("detectedSignalsLabel")}</h2>
                  <span className="badge" style={{
                    background: "var(--line)",
                    color: "var(--muted)",
                    borderRadius: "999px",
                    padding: "2px 8px",
                    fontSize: "12px",
                    fontWeight: 800
                  }}>{issues.length}</span>
                </div>
                
                {/* Role/Owner Selector */}
                {!result.is_private && result.is_user_request && (
                  <label className="toggle" style={{ margin: 0, fontSize: "13.5px", fontWeight: 700, color: "var(--muted)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={isOwner}
                      onChange={(e) => handleToggleOwner(e.target.checked)}
                      style={{ width: "16px", height: "16px", minHeight: "16px", margin: 0 }}
                    />
                    <span>{t("ownerToggleLabel")}</span>
                  </label>
                )}
              </div>
              {Object.entries(groupedIssues).map(([category, catIssues]) => {
                // Localize issue category header if English
                let displayCategory = category;
                if (lang === "en") {
                  if (category === "умови оплати/поставки") displayCategory = "Payment & Delivery Conditions";
                  else if (category === "проєкт договору") displayCategory = "Draft Contract";
                  else if (category === "сертифікаційні вимоги") displayCategory = "Certification Requirements";
                  else if (category === "приймання / логістика") displayCategory = "Acceptance & Logistics";
                  else if (category === "інші ризики") displayCategory = "Other Risks";
                }
                return (
                  <div className="issue-group" key={category}>
                    <h3 style={{ textTransform: "capitalize" }}>{displayCategory}</h3>
                    {catIssues.map((issue, idx) => {
                      const displaySeverity = lang === "en"
                        ? (issue.severity === "висока" ? "high" : issue.severity === "середня" ? "medium" : issue.severity === "низька" ? "low" : "none")
                        : issue.severity;
                      return (
                        <article className="issue" key={idx}>
                          <header>
                            <div>
                              <h4>{issue.title}</h4>
                              {issue.document_title && <span>{issue.document_title}</span>}
                            </div>
                            <span className={`priority priority-${priorityMeta[issue.severity]?.className || "none"}`}>
                              {displaySeverity}
                            </span>
                          </header>
                          <blockquote>{issue.evidence_quote}</blockquote>
                          <p>
                            <strong>{t("explanationLabel")}</strong> {issue.explanation}
                          </p>
                          {effectiveIsOwner && issue.suggested_rewrite && (
                            <p>
                              <strong>{t("suggestedRewriteLabel")}</strong> {issue.suggested_rewrite}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                );
              })}
              {issues.length === 0 && (
                <p className="empty">
                  {t("noRisksFound")}
                </p>
              )}
            </section>
          </div>
        )}

        {/* Tab 2: Document Review */}
        {activeTab === "doc-review" && (
          <div className="detail-tab-content active" id="tab-doc-review">
            <div className="document-review-grid">
              {/* Requirements */}
              <section className="review-section-card">
                <h2>
                  {lang === "en" ? "Key Requirements" : "Ключові вимоги"}
                  {review.requirements && review.requirements.length > 0 && (
                    <span className="badge">{review.requirements.length}</span>
                  )}
                </h2>
                <div className="review-items-list">
                  {review.requirements && review.requirements.length > 0 ? (
                    review.requirements.map((item, idx) => (
                      <div className="review-item-card" key={idx}>
                        <p className="review-item-quote">«{item.quote}»</p>
                        <div className="review-item-meta">
                          <span className="review-doc-pill">{item.document_title}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="review-empty-state">
                      {lang === "en"
                        ? "No key requirements automatically found."
                        : "Інформації про ключові вимоги не знайдено автоматично."}
                    </p>
                  )}
                </div>
              </section>

              {/* Deadlines */}
              <section className="review-section-card">
                <h2>
                  {lang === "en" ? "Deadlines & Timelines" : "Строки та дедлайни"}
                  {review.deadlines && review.deadlines.length > 0 && (
                    <span className="badge">{review.deadlines.length}</span>
                  )}
                </h2>
                <div className="review-items-list">
                  {review.deadlines && review.deadlines.length > 0 ? (
                    review.deadlines.map((item, idx) => (
                      <div className="review-item-card" key={idx}>
                        <p className="review-item-quote">«{item.quote}»</p>
                        <div className="review-item-meta">
                          <span className="review-doc-pill">{item.document_title}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="review-empty-state">
                      {lang === "en"
                        ? "No deadlines automatically found."
                        : "Інформації про строки та дедлайни не знайдено автоматично."}
                    </p>
                  )}
                </div>
              </section>

              {/* Qualification criteria */}
              <section className="review-section-card">
                <h2>
                  {lang === "en" ? "Qualification Criteria" : "Кваліфікаційні критерії"}
                  {review.qualification && review.qualification.length > 0 && (
                    <span className="badge">{review.qualification.length}</span>
                  )}
                </h2>
                <div className="review-items-list">
                  {review.qualification && review.qualification.length > 0 ? (
                    review.qualification.map((item, idx) => (
                      <div className="review-item-card" key={idx}>
                        <p className="review-item-quote">«{item.quote}»</p>
                        <div className="review-item-meta">
                          <span className="review-doc-pill">{item.document_title}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="review-empty-state">
                      {lang === "en"
                        ? "No qualification criteria automatically found."
                        : "Інформації про кваліфікаційні критерії не знайдено автоматично."}
                    </p>
                  )}
                </div>
              </section>

              {/* Evaluation rules */}
              <section className="review-section-card">
                <h2>
                  {lang === "en" ? "Evaluation Rules & Criteria" : "Правила та критерії оцінки"}
                  {review.evaluation && review.evaluation.length > 0 && (
                    <span className="badge">{review.evaluation.length}</span>
                  )}
                </h2>
                <div className="review-items-list">
                  {review.evaluation && review.evaluation.length > 0 ? (
                    review.evaluation.map((item, idx) => (
                      <div className="review-item-card" key={idx}>
                        <p className="review-item-quote">«{item.quote}»</p>
                        <div className="review-item-meta">
                          <span className="review-doc-pill">{item.document_title}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="review-empty-state">
                      {lang === "en"
                        ? "No evaluation rules automatically found."
                        : "Інформації про правила оцінки не знайдено автоматично."}
                    </p>
                  )}
                </div>
              </section>

              {/* Mandatory documents */}
              <section className="review-section-card">
                <h2>
                  {lang === "en" ? "Mandatory Documents" : "Обов'язкові документи"}
                  {review.documents && review.documents.length > 0 && (
                    <span className="badge">{review.documents.length}</span>
                  )}
                </h2>
                <div className="review-items-list">
                  {review.documents && review.documents.length > 0 ? (
                    review.documents.map((item, idx) => (
                      <div className="review-item-card" key={idx}>
                        <p className="review-item-quote">«{item.quote}»</p>
                        <div className="review-item-meta">
                          <span className="review-doc-pill">{item.document_title}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="review-empty-state">
                      {lang === "en"
                        ? "No mandatory documents automatically found."
                        : "Інформації про обов'язкові документи не знайдено автоматично."}
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Tab 3: Technical Details */}
        {activeTab === "tech-details" && (
          <div className="detail-tab-content active" id="tab-tech-details">
            <section className="notice-panel">
              <div className="section-head">
                <h2>{t("analysisLimitationsLabel")}</h2>
              </div>
              <p>{result.human_review_notice}</p>
              <p>
                {lang === "en" ? "LLM Engine Mode: " : "Режим мовної моделі: "}
                {result.llm_engine}
              </p>
              {llmUsage.model ? (
                <p>
                  {lang === "en"
                    ? `LLM Costs: ${formatTokens(llmUsage.total_tokens)} tokens, ${formatUsd(llmUsage.total_cost_usd)} with model ${llmUsage.model}.`
                    : `Витрати LLM: ${formatTokens(llmUsage.total_tokens)} токенів, ${formatUsd(llmUsage.total_cost_usd)} за моделлю ${llmUsage.model}.`}
                </p>
              ) : (
                <p>
                  {lang === "en"
                    ? "LLM cost was not calculated for this old record."
                    : "Витрати LLM: не рахувались для цього старого запису."}
                </p>
              )}
              {limitations.length > 0 ? (
                <ul>
                  {limitations.map((limitation, idx) => (
                    <li key={idx}>{limitation}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  {lang === "en"
                    ? "No critical parsing limitations recorded."
                    : "Критичних обмежень парсингу не зафіксовано."}
                </p>
              )}
            </section>

            <section className="table-section">
              <div className="section-head">
                <h2>{lang === "en" ? "LLM Tokens & Costs" : "Токени та вартість LLM"}</h2>
                <span>{llmUsage.source || "codex-cli-usage"}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{lang === "en" ? "Model" : "Модель"}</th>
                      <th>Input</th>
                      <th>Cached input</th>
                      <th>Output</th>
                      <th>Reasoning output</th>
                      <th>{lang === "en" ? "Rates per 1M" : "Ставки за 1M"}</th>
                      <th>{lang === "en" ? "Cost" : "Вартість"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{llmUsage.model || t("notCalculated")}</td>
                      <td>{formatTokens(llmUsage.input_tokens)}</td>
                      <td>{formatTokens(llmUsage.cached_input_tokens)}</td>
                      <td>{formatTokens(llmUsage.output_tokens)}</td>
                      <td>{formatTokens(llmUsage.reasoning_output_tokens)}</td>
                      <td>
                        input {formatUsd(llmUsage.input_usd_per_million)} · cached{" "}
                        {formatUsd(llmUsage.cached_input_usd_per_million)} · output{" "}
                        {formatUsd(llmUsage.output_usd_per_million)}
                      </td>
                      <td>{formatUsd(llmUsage.total_cost_usd)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="table-section">
              <div className="section-head">
                <h2>{lang === "en" ? "Documents" : "Документи"}</h2>
                <span>{documents.length}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{lang === "en" ? "Title" : "Назва"}</th>
                      <th>{lang === "en" ? "Format" : "Формат"}</th>
                      <th>{lang === "en" ? "Status" : "Статус"}</th>
                      <th>{lang === "en" ? "Chars" : "Символів"}</th>
                      <th>{lang === "en" ? "Note" : "Примітка"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => {
                      const docStatus = lang === "en"
                        ? (doc.status === "опрацьовано" ? "processed" : doc.status === "підпис, пропущено" ? "signature, skipped" : doc.status)
                        : doc.status;
                      return (
                        <tr key={doc.id}>
                          <td>{doc.title}</td>
                          <td>{doc.format || (lang === "en" ? "not specified" : "не вказано")}</td>
                          <td>{docStatus}</td>
                          <td>{formatTokens(doc.parsed_chars)}</td>
                          <td>{doc.limitation || (lang === "en" ? "none" : "немає")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
