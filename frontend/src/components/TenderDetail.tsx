import type { ReactNode } from "react";
import { useState } from "react";
import type { TenderResult } from "../types";
import { formatDate, formatUah, getHighestSeverity } from "../utils";
import { priorityMeta } from "../constants";

interface TenderDetailProps {
  result: TenderResult;
  onClose: () => void;
}

export function TenderDetail({ result, onClose }: TenderDetailProps): ReactNode {
  const [activeTab, setActiveTab] = useState<"risks" | "doc-review" | "tech-details">("risks");

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

  return (
    <div className="tender-detail-view">
      <nav className="crumb">
        <a href="/" onClick={(e) => { e.preventDefault(); onClose(); }}>
          ← До списку
        </a>
      </nav>

      <section className="detail-head">
        <div>
          <p className="eyebrow">{summary.tender_code}</p>
          <h1>{summary.title}</h1>
          <p>
            {summary.buyer_name} · {formatUah(summary.value_amount, summary.currency)} · {summary.cpv || "CPV не вказано"}
          </p>
        </div>
        <div className="score-block">
          <span>Загальний бал</span>
          <strong>{result.overall_score}</strong>
          <em>{meta.label} пріоритет</em>
        </div>
      </section>

      <section className="subscores" aria-label="Підбали">
        {Object.entries(subscores).map(([name, value]) => (
          <div className="subscore" key={name} style={{ borderTop: "3px solid var(--blue)" }}>
            <span>{name}</span>
            <meter min="0" max="100" value={value}></meter>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <div className="detail-tabs-container">
        <div className="detail-tabs-nav">
          <button
            className={`detail-tab-btn ${activeTab === "risks" ? "active" : ""}`}
            onClick={() => setActiveTab("risks")}
          >
            Потенційні ризики закупівлі
          </button>
          <button
            className={`detail-tab-btn ${activeTab === "doc-review" ? "active" : ""}`}
            onClick={() => setActiveTab("doc-review")}
          >
            Огляд вимог та дедлайнів
          </button>
          <button
            className={`detail-tab-btn ${activeTab === "tech-details" ? "active" : ""}`}
            onClick={() => setActiveTab("tech-details")}
          >
            Технічні деталі та статистика
          </button>
        </div>

        {/* Tab 1: Risks */}
        {activeTab === "risks" && (
          <div className="detail-tab-content active" id="tab-risks">
            <section className="issues">
              <div className="section-head">
                <h2>Виявлені сигнали</h2>
                <span>{issues.length}</span>
              </div>
              {Object.entries(groupedIssues).map(([category, catIssues]) => (
                <div className="issue-group" key={category}>
                  <h3 style={{ textTransform: "capitalize" }}>{category}</h3>
                  {catIssues.map((issue, idx) => (
                    <article className="issue" key={idx}>
                      <header>
                        <div>
                          <h4>{issue.title}</h4>
                          {issue.document_title && <span>{issue.document_title}</span>}
                        </div>
                        <span className={`priority priority-${priorityMeta[issue.severity]?.className || "none"}`}>
                          {priorityMeta[issue.severity]?.label || issue.severity}
                        </span>
                      </header>
                      <blockquote>{issue.evidence_quote}</blockquote>
                      <p>
                        <strong>Пояснення:</strong> {issue.explanation}
                      </p>
                      <p>
                        <strong>Можливе переписування:</strong> {issue.suggested_rewrite}
                      </p>
                    </article>
                  ))}
                </div>
              ))}
              {issues.length === 0 && (
                <p className="empty">
                  Потенційних ризиків за поточними правилами не знайдено. Це не замінює ручну перевірку документації.
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
                  Ключові вимоги
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
                    <p className="review-empty-state">Інформації про ключові вимоги не знайдено автоматично.</p>
                  )}
                </div>
              </section>

              {/* Deadlines */}
              <section className="review-section-card">
                <h2>
                  Строки та дедлайни
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
                    <p className="review-empty-state">Інформації про строки та дедлайни не знайдено автоматично.</p>
                  )}
                </div>
              </section>

              {/* Qualification criteria */}
              <section className="review-section-card">
                <h2>
                  Кваліфікаційні критерії
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
                    <p className="review-empty-state">Інформації про кваліфікаційні критерії не знайдено автоматично.</p>
                  )}
                </div>
              </section>

              {/* Evaluation rules */}
              <section className="review-section-card">
                <h2>
                  Правила та критерії оцінки
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
                    <p className="review-empty-state">Інформації про правила оцінки не знайдено автоматично.</p>
                  )}
                </div>
              </section>

              {/* Mandatory documents */}
              <section className="review-section-card">
                <h2>
                  Обов'язкові документи
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
                    <p className="review-empty-state">Інформації про обов'язкові документи не знайдено автоматично.</p>
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
                <h2>Обмеження аналізу</h2>
              </div>
              <p>{result.human_review_notice}</p>
              <p>Режим мовної моделі: {result.llm_engine}</p>
              {llmUsage.model ? (
                <p>
                  Витрати LLM: {formatTokens(llmUsage.total_tokens)} токенів,{" "}
                  {formatUsd(llmUsage.total_cost_usd)} за моделлю {llmUsage.model}.
                </p>
              ) : (
                <p>Витрати LLM: не рахувались для цього старого запису.</p>
              )}
              {limitations.length > 0 ? (
                <ul>
                  {limitations.map((limitation, idx) => (
                    <li key={idx}>{limitation}</li>
                  ))}
                </ul>
              ) : (
                <p>Критичних обмежень парсингу не зафіксовано.</p>
              )}
            </section>

            <section className="table-section">
              <div className="section-head">
                <h2>Токени та вартість LLM</h2>
                <span>{llmUsage.source || "codex-cli-usage"}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Модель</th>
                      <th>Input</th>
                      <th>Cached input</th>
                      <th>Output</th>
                      <th>Reasoning output</th>
                      <th>Ставки за 1M</th>
                      <th>Вартість</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{llmUsage.model || "не рахувалось"}</td>
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
                <h2>Документи</h2>
                <span>{documents.length}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Назва</th>
                      <th>Формат</th>
                      <th>Статус</th>
                      <th>Символів</th>
                      <th>Примітка</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.title}</td>
                        <td>{doc.format || "не вказано"}</td>
                        <td>{doc.status}</td>
                        <td>{formatTokens(doc.parsed_chars)}</td>
                        <td>{doc.limitation || "немає"}</td>
                      </tr>
                    ))}
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
