import type { ReactNode } from "react";
import { priorityMeta } from "../constants";
import type { Status, TenderResult } from "../types";
import { formatDate, formatUah, getHighestSeverity, scoreTone } from "../utils";
import { useTranslation } from "../LanguageContext";

interface TenderTableProps {
  error: string;
  results: TenderResult[];
  status: Status;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage?: number;
  processingTenderIds?: string[];
  onSelectTender: (tenderId: string) => void;
}

interface TenderRowProps {
  result: TenderResult;
  onSelectTender: (tenderId: string) => void;
}

export function TenderTable({
  error,
  results,
  status,
  currentPage,
  setCurrentPage,
  itemsPerPage = 10,
  processingTenderIds = [],
  onSelectTender,
}: TenderTableProps): ReactNode {
  const { t, lang } = useTranslation();
  const hasProcessing = processingTenderIds && processingTenderIds.length > 0;

  if (status === "loading") {
    return (
      <section className="table-section">
        <div className="section-title">
          <h2>{t("recentTenders")}</h2>
          <span>{hasProcessing ? t("processing") : t("loading")}</span>
        </div>
        {hasProcessing && (
          <div className="processing-alert">
            <span className="spinner" />
            <p>
              {lang === "en"
                ? "Collecting and analyzing documents from Prozorro API. Please wait... (takes up to 1 min)"
                : "Триває збір та аналіз документів через Prozorro API. Будь ласка, зачекайте... (це може зайняти до 1 хв)"}
            </p>
          </div>
        )}
        <div className="skeleton-table">
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="empty-state">
        <h2>{lang === "en" ? "Failed to load data" : "Не вдалося завантажити дані"}</h2>
        <p>{error}</p>
      </section>
    );
  }

  const totalItems = results.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginated = results.slice(startIndex, startIndex + itemsPerPage);

  const pageNumbers = [];
  const maxPageButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
  if (endPage - startPage < maxPageButtons - 1) {
    startPage = Math.max(1, endPage - maxPageButtons + 1);
  }
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <section className="table-section">
      <div className="section-title">
        <h2>{t("recentTenders")}</h2>
        <span>
          {lang === "en"
            ? `${results.length} in current list`
            : `${results.length} у поточному списку`}
        </span>
      </div>
      <div className="table-wrap tender-table-wrap">
        <table className="results-table dashboard-table">
          <thead>
            <tr>
              <th>{t("tenderCode")}</th>
              <th>{t("buyer")}</th>
              <th>{lang === "en" ? "Budget" : "Вартість"}</th>
              <th>{t("sector")}</th>
              <th>{lang === "en" ? "Updated" : "Оновлено"}</th>
              <th>{t("score")}</th>
              <th>{lang === "en" ? "Signals" : "Сигнали"}</th>
              <th>{t("riskPriority")}</th>
            </tr>
          </thead>
          <tbody>
            {hasProcessing && currentPage === 1 && (
              processingTenderIds.map((tid) => (
                <TenderProcessingRow key={tid} tenderId={tid} lang={lang} />
              ))
            )}
            {paginated.length ? (
              paginated.map((result) => (
                <TenderRow key={result.summary.tender_id} result={result} onSelectTender={onSelectTender} lang={lang} />
              ))
            ) : (
              !hasProcessing && (
                <tr>
                  <td colSpan={8} className="empty">
                    {lang === "en"
                      ? "No tenders match the current filters."
                      : "Немає тендерів для поточних фільтрів."}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {totalItems > 0 && (
        <div className="pagination-container">
          <span className="pagination-info">
            {lang === "en"
              ? `Showing ${startIndex + 1}–${endIndex} of ${totalItems}`
              : `Показано ${startIndex + 1}–${endIndex} з ${totalItems}`}
          </span>
          {totalPages > 1 && (
            <div className="pagination-buttons">
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                {lang === "en" ? "Previous" : "Попередня"}
              </button>
              {pageNumbers.map((page) => (
                <button
                   key={page}
                  className={`pagination-btn ${currentPage === page ? "active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page.toString()}
                </button>
              ))}
              <button
                className="pagination-btn"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                {lang === "en" ? "Next" : "Наступна"}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TenderProcessingRow({ tenderId, lang }: { tenderId: string; lang: string }): ReactNode {
  return (
    <tr className="processing-row">
      <td>
        <span className="row-title processing-title">
          {lang === "en" ? "Request queued..." : "Запит у черзі..."}
        </span>
        <span className="row-description">{tenderId}</span>
      </td>
      <td>
        <span className="text-muted-loading">
          {lang === "en" ? "Fetching data" : "Отримання даних"}
        </span>
      </td>
      <td>—</td>
      <td>
        <span>—</span>
      </td>
      <td>{lang === "en" ? "now" : "зараз"}</td>
      <td>
        <span className="score score-blue loading-pulse">...</span>
      </td>
      <td>
        <span className="spinner-inline" />
      </td>
      <td>
        <span className="priority priority-none loading-pulse">
          {lang === "en" ? "Analyzing" : "Аналіз"}
        </span>
      </td>
    </tr>
  );
}

function TenderRow({ result, onSelectTender, lang }: TenderRowProps & { lang: string }): ReactNode {
  const summary = result.summary;
  const highestSeverity = getHighestSeverity(result);
  const meta = priorityMeta[highestSeverity] || priorityMeta["немає"];
  const issues = result.issues || [];

  const displayPriority = lang === "en"
    ? (highestSeverity === "висока" ? "high" : highestSeverity === "середня" ? "medium" : highestSeverity === "низька" ? "low" : "none")
    : meta.label;

  return (
    <tr>
      <td>
        <a
          className="row-title"
          href={`/tenders/${summary.tender_id}`}
          onClick={(e) => {
            e.preventDefault();
            onSelectTender(summary.tender_id);
          }}
        >
          {summary.tender_code || (lang === "en" ? "No number" : "Без номера")}
        </a>
        <span className="row-description" title={summary.title || ""}>
          {summary.title || (lang === "en" ? "No title" : "Без назви")}
        </span>
      </td>
      <td>{summary.buyer_name || (lang === "en" ? "not specified" : "не вказано")}</td>
      <td>{formatUah(summary.value_amount, summary.currency)}</td>
      <td>
        <span>{summary.cpv || (lang === "en" ? "CPV not specified" : "CPV не вказано")}</span>
        <small>{summary.sector || (lang === "en" ? "no sector" : "без сектору")}</small>
      </td>
      <td>{formatDate(summary.date_modified || result.processed_at)}</td>
      <td>
        <span className={`score score-${scoreTone(result.overall_score)}`}>
          {result.overall_score || 0}
        </span>
      </td>
      <td>{issues.length}</td>
      <td>
        <span className={`priority priority-${meta.className}`}>{displayPriority}</span>
      </td>
    </tr>
  );
}
