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

interface TenderCardProps {
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
      <div className="tender-card-list">
        {hasProcessing && currentPage === 1 && (
          processingTenderIds.map((tid) => (
            <TenderProcessingCard key={tid} tenderId={tid} lang={lang} />
          ))
        )}
        {paginated.length ? (
          paginated.map((result) => (
            <TenderCard key={result.summary.tender_id} result={result} onSelectTender={onSelectTender} lang={lang} />
          ))
        ) : (
          !hasProcessing && (
            <div className="empty tender-card-empty">
              {lang === "en"
                ? "No tenders match the current filters."
                : "Немає тендерів для поточних фільтрів."}
            </div>
          )
        )}
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

function TenderProcessingCard({ tenderId, lang }: { tenderId: string; lang: string }): ReactNode {
  return (
    <article className="tender-card processing-row">
      <div className="tender-card-main">
        <span className="row-title processing-title">
          {lang === "en" ? "Request queued..." : "Запит у черзі..."}
        </span>
        <span className="row-description">{tenderId}</span>
      </div>
      <div className="tender-card-meta">
        <TenderMetaItem
          label={lang === "en" ? "Status" : "Стан"}
          value={lang === "en" ? "Fetching data" : "Отримання даних"}
        />
        <TenderMetaItem
          label={lang === "en" ? "Updated" : "Оновлено"}
          value={lang === "en" ? "now" : "зараз"}
        />
      </div>
      <div className="tender-card-status">
        <span className="score score-blue loading-pulse">...</span>
        <span className="spinner-inline" />
        <span className="priority priority-none loading-pulse">
          {lang === "en" ? "Analyzing" : "Аналіз"}
        </span>
      </div>
    </article>
  );
}

function TenderCard({ result, onSelectTender, lang }: TenderCardProps & { lang: string }): ReactNode {
  const summary = result.summary;
  const highestSeverity = getHighestSeverity(result);
  const meta = priorityMeta[highestSeverity] || priorityMeta["немає"];
  const issues = result.issues || [];

  const displayPriority = lang === "en"
    ? (highestSeverity === "висока" ? "high" : highestSeverity === "середня" ? "medium" : highestSeverity === "низька" ? "low" : "none")
    : meta.label;

  return (
    <article className="tender-card">
      <div className="tender-card-main">
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
      </div>
      <div className="tender-card-meta" aria-label={lang === "en" ? "Tender data" : "Дані тендера"}>
        <TenderMetaItem
          label={lang === "en" ? "Buyer" : "Замовник"}
          value={summary.buyer_name || (lang === "en" ? "not specified" : "не вказано")}
        />
        <TenderMetaItem
          label={lang === "en" ? "Budget" : "Вартість"}
          value={formatUah(summary.value_amount, summary.currency)}
        />
        <TenderMetaItem
          label={lang === "en" ? "Sector" : "Сектор"}
          value={summary.cpv || (lang === "en" ? "CPV not specified" : "CPV не вказано")}
          detail={summary.sector || (lang === "en" ? "no sector" : "без сектору")}
        />
        <TenderMetaItem
          label={lang === "en" ? "Updated" : "Оновлено"}
          value={formatDate(summary.date_modified || result.processed_at)}
        />
      </div>
      <div className="tender-card-status" aria-label={lang === "en" ? "Score" : "Оцінка"}>
        <span className={`score score-${scoreTone(result.overall_score)}`}>
          {result.overall_score || 0}
        </span>
        <span className="tender-signal-count">
          <span>{issues.length.toString()}</span>
          <small>{lang === "en" ? "signals" : "сигнали"}</small>
        </span>
        <span className={`priority priority-${meta.className}`}>{displayPriority}</span>
      </div>
    </article>
  );
}

function TenderMetaItem({
  detail,
  label,
  value,
}: {
  detail?: string;
  label: string;
  value: string;
}): ReactNode {
  return (
    <div className="tender-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
