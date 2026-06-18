import type { ReactNode } from "react";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarClock,
  FileSearch,
  FileText,
  Lightbulb,
  Settings2,
  Tags,
  Wallet,
} from "lucide-react";
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
  const displayProcessedAt = formatDate(result.processed_at);

  return (
    <div className="tender-detail-view">
      <nav className="crumb">
        <a href="/" onClick={(e) => { e.preventDefault(); onClose(); }}>
          <ArrowLeft aria-hidden="true" size={16} />
          {lang === "en" ? "Back to list" : "До списку"}
        </a>
      </nav>

      <section className="detail-overview">
        <div className="detail-overview-main">
          <div className="detail-title-block">
            <p className="eyebrow">{summary.tender_code}</p>
            <h1>{summary.title}</h1>
            <p className="detail-intro">
              {lang === "en"
                ? `${issues.length} automated signals were found. Review the evidence and recommendations before making a decision.`
                : `Знайдено ${issues.length} автоматичних сигналів. Перевірте цитати та рекомендації перед ухваленням рішення.`}
            </p>
          </div>

          <div className="detail-facts" aria-label={lang === "en" ? "Tender details" : "Дані закупівлі"}>
            <DetailFact
              icon={<Building2 aria-hidden="true" size={17} />}
              label={lang === "en" ? "Buyer" : "Замовник"}
              value={summary.buyer_name || (lang === "en" ? "Not specified" : "Не вказано")}
            />
            <DetailFact
              icon={<Wallet aria-hidden="true" size={17} />}
              label={lang === "en" ? "Expected value" : "Очікувана вартість"}
              value={formatUah(summary.value_amount, summary.currency)}
            />
            <DetailFact
              icon={<Tags aria-hidden="true" size={17} />}
              label="CPV"
              value={summary.cpv || (lang === "en" ? "Not specified" : "Не вказано")}
            />
            <DetailFact
              icon={<CalendarClock aria-hidden="true" size={17} />}
              label={lang === "en" ? "Processed" : "Оброблено"}
              value={displayProcessedAt}
            />
          </div>
        </div>

        <aside className={`detail-score-summary priority-${meta.className}`}>
          <span>{t("overallScoreLabel")}</span>
          <strong>{result.overall_score}</strong>
          <div>
            <AlertTriangle aria-hidden="true" size={16} />
            <em>{displayPriority} {t("priorityLevel")}</em>
          </div>
          <small>
            {lang === "en"
              ? `${issues.length} signals require review`
              : `${issues.length} сигналів потребують перевірки`}
          </small>
        </aside>
      </section>

      <section className="detail-quality" aria-label={t("subscoresLabel")}>
        <div className="detail-quality-heading">
          <BarChart3 aria-hidden="true" size={18} />
          <div>
            <h2>{lang === "en" ? "Documentation quality" : "Якість документації"}</h2>
            <p>{lang === "en" ? "Supporting indicators for the overall score" : "Допоміжні показники загальної оцінки"}</p>
          </div>
        </div>
        <div className="subscores">
          {Object.entries(subscores).map(([name, value]) => {
            let displayName = name;
            if (lang === "en") {
              if (name === "повнота") displayName = "Completeness";
              else if (name === "зрозумілість") displayName = "Clarity";
              else if (name === "конкурентність") displayName = "Competitiveness";
              else if (name === "технічна нейтральність") displayName = "Tech Neutrality";
              else if (name === "якість проєкту договору") displayName = "Contract Quality";
            }
            return (
              <div className="subscore" key={name}>
                <div>
                  <span>{displayName}</span>
                  <strong>{value}</strong>
                </div>
                <meter min="0" max="100" value={value}></meter>
              </div>
            );
          })}
        </div>
      </section>

      <div className="detail-tabs-container">
        <div className="detail-tabs-nav">
          <button
            className={`detail-tab-btn ${activeTab === "risks" ? "active" : ""}`}
            onClick={() => setActiveTab("risks")}
          >
            <AlertTriangle aria-hidden="true" size={16} />
            {t("potentialRisksTab")}
          </button>
          <button
            className={`detail-tab-btn ${activeTab === "doc-review" ? "active" : ""}`}
            onClick={() => setActiveTab("doc-review")}
          >
            <FileSearch aria-hidden="true" size={16} />
            {t("requirementsTab")}
          </button>
          <button
            className={`detail-tab-btn ${activeTab === "tech-details" ? "active" : ""}`}
            onClick={() => setActiveTab("tech-details")}
          >
            <Settings2 aria-hidden="true" size={16} />
            {t("techDetailsTab")}
          </button>
        </div>

        {/* Tab 1: Risks */}
        {activeTab === "risks" && (
          <div className="detail-tab-content active" id="tab-risks">
            <section className="issues">
              <div className="section-head detail-section-head">
                <div className="detail-section-title">
                  <h2>{t("detectedSignalsLabel")}</h2>
                  <span className="badge">{issues.length}</span>
                </div>
                
                {/* Role/Owner Selector */}
                {!result.is_private && result.is_user_request && (
                  <label className="toggle detail-owner-toggle">
                    <input
                      type="checkbox"
                      checked={isOwner}
                      onChange={(e) => handleToggleOwner(e.target.checked)}
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
                    <h3>{displayCategory}</h3>
                    {catIssues.map((issue, idx) => {
                      const displaySeverity = lang === "en"
                        ? (issue.severity === "висока" ? "high" : issue.severity === "середня" ? "medium" : issue.severity === "низька" ? "low" : "none")
                        : issue.severity;
                      return (
                        <article className="issue" key={idx}>
                          <header>
                            <div className="issue-title">
                              <FileText aria-hidden="true" size={18} />
                              <div>
                              <h4>{issue.title}</h4>
                              {issue.document_title && <span>{issue.document_title}</span>}
                              </div>
                            </div>
                            <span className={`priority priority-${priorityMeta[issue.severity]?.className || "none"}`}>
                              {displaySeverity}
                            </span>
                          </header>
                          <div className="issue-evidence">
                            <span>{lang === "en" ? "Evidence" : "Цитата з документа"}</span>
                            <blockquote>{issue.evidence_quote}</blockquote>
                          </div>
                          <div className="issue-explanation">
                            <strong>{t("explanationLabel")}</strong>
                            <p>{issue.explanation}</p>
                          </div>
                          {effectiveIsOwner && issue.suggested_rewrite && (
                            <div className="issue-recommendation">
                              <Lightbulb aria-hidden="true" size={18} />
                              <div>
                                <strong>{t("suggestedRewriteLabel")}</strong>
                                <p>{issue.suggested_rewrite}</p>
                              </div>
                            </div>
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

function DetailFact({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}): ReactNode {
  return (
    <div className="detail-fact">
      <span className="detail-fact-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
