import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActionPanel } from "./components/ActionPanel";
import { IdentityHeader } from "./components/IdentityHeader";
import { MetricGrid } from "./components/MetricGrid";
import { RiskOverview } from "./components/RiskOverview";
import { SearchDock } from "./components/SearchDock";
import { TenderTable } from "./components/TenderTable";
import { HeuristicsView } from "./components/HeuristicsView";
import { AdminView } from "./components/AdminView";
import { TenderDetail } from "./components/TenderDetail";
import type { SortKey, Status, TenderResult } from "./types";
import { computeAggregate, getHighestSeverity, parseScore, sortResults, uniqueSorted } from "./utils";

interface AppProps {
  apiUrl: string;
  defaultPages: string;
  initialTenderId?: string;
}

export function App({ apiUrl, defaultPages, initialTenderId = "" }: AppProps): ReactNode {
  const [results, setResults] = useState<TenderResult[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sector, setSector] = useState("");
  const [severity, setSeverity] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [sort, setSort] = useState<SortKey>("processed_desc");
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(() => {
    if (initialTenderId) return initialTenderId;
    const path = window.location.pathname;
    if (path.startsWith("/tenders/")) {
      return path.slice("/tenders/".length);
    }
    return null;
  });
  const [activeTab, setActiveTab] = useState<"requests" | "all" | "heuristics" | "admin">(() => {
    if (window.location.pathname === "/heuristics" || window.location.hash === "#heuristics") {
      return "heuristics";
    }
    if (window.location.pathname === "/admin") {
      return "admin";
    }
    return "requests";
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [processingTenderIds, setProcessingTenderIds] = useState<string[]>([]);

  useEffect(() => {
    if (selectedTenderId) {
      const currentPath = `/tenders/${selectedTenderId}`;
      if (window.location.pathname !== currentPath) {
        window.history.pushState({ tab: activeTab, tenderId: selectedTenderId }, "", currentPath);
      }
    } else if (activeTab === "heuristics") {
      if (window.location.pathname !== "/heuristics") {
        window.history.pushState({ tab: "heuristics" }, "", "/heuristics");
      }
    } else if (activeTab === "admin") {
      if (window.location.pathname !== "/admin") {
        window.history.pushState({ tab: "admin" }, "", "/admin");
      }
    } else {
      if (window.location.pathname !== "/") {
        window.history.pushState({ tab: activeTab }, "", "/");
      }
    }
  }, [selectedTenderId, activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith("/tenders/")) {
        setSelectedTenderId(path.slice("/tenders/".length));
      } else {
        setSelectedTenderId(null);
        if (path === "/heuristics") {
          setActiveTab("heuristics");
        } else if (path === "/admin") {
          setActiveTab("admin");
        } else {
          const state = window.history.state;
          if (state && (state.tab === "requests" || state.tab === "all")) {
            setActiveTab(state.tab);
          } else {
            setActiveTab("requests");
          }
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetch(apiUrl, { headers: { Accept: "application/json" } })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        setResults(Array.isArray(payload) ? (payload as TenderResult[]) : []);
        setStatus("ready");
      })
      .catch((fetchError: Error) => {
        if (!active) {
          return;
        }
        setError(fetchError.message || "Помилка завантаження");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [apiUrl]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, query, category, sector, severity, maxScore, sort]);

  const handleProcessTenders = async (tenderIds: string[], useCodex: boolean) => {
    console.log("handleProcessTenders started for UUIDs:", tenderIds, useCodex);
    
    const uuidRegex = /^[0-9a-fA-F]{32}$/;
    const invalidUuids = tenderIds.filter((id) => !uuidRegex.test(id));
    if (invalidUuids.length > 0) {
      setSingleError(
        `Будь ласка, введіть коректні 32-значні Prozorro UUID без дефісів.\nНекоректні значення: ${invalidUuids.join(", ")}`
      );
      return;
    }

    setIsProcessing(true);
    setSingleError(null);
    setProcessingTenderIds(tenderIds);

    const errors: string[] = [];

    // Process all requests in parallel
    await Promise.allSettled(
      tenderIds.map(async (tenderId) => {
        try {
          const formData = new FormData();
          formData.append("tender_id", tenderId);
          if (useCodex) {
            formData.append("use_codex", "true");
          }

          const response = await fetch("/process/tender", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || `Помилка сервера (${response.status})`;
            throw new Error(`${tenderId}: ${errorMessage}`);
          }
        } catch (err: any) {
          console.error(`Error processing ${tenderId}:`, err);
          errors.push(err.message || `Не вдалося обробити ${tenderId}`);
        }
      })
    );

    try {
      // Re-fetch all results to refresh the table lists
      const refreshResponse = await fetch(apiUrl, { headers: { Accept: "application/json" } });
      if (!refreshResponse.ok) {
        throw new Error("Не вдалося оновити список результатів");
      }
      const payload = await refreshResponse.json();
      setResults(Array.isArray(payload) ? (payload as TenderResult[]) : []);
    } catch (refreshErr: any) {
      errors.push(refreshErr.message || "Не вдалося оновити список результатів");
    }
      
    // Reset states
    setProcessingTenderIds([]);
    setIsProcessing(false);
    setStatus("ready");
    
    if (errors.length > 0) {
      setSingleError(errors.join("\n"));
    } else {
      console.log("handleProcessTenders finished successfully!");
    }
  };

  const handleProcessCustom = async (formData: FormData) => {
    setIsProcessing(true);
    setSingleError(null);

    try {
      const response = await fetch("/process/custom", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Помилка сервера (${response.status})`;
        throw new Error(errorMessage);
      }

      const payload = await response.json();
      const newTenderId = payload.result?.summary?.tender_id;

      // Re-fetch all results to refresh the table lists
      const refreshResponse = await fetch(apiUrl, { headers: { Accept: "application/json" } });
      if (!refreshResponse.ok) {
        throw new Error("Не вдалося оновити список результатів");
      }
      const newResults = await refreshResponse.json();
      setResults(Array.isArray(newResults) ? (newResults as TenderResult[]) : []);

      // Select the new tender
      if (newTenderId) {
        setSelectedTenderId(newTenderId);
      }
    } catch (err: any) {
      console.error("Error processing custom draft:", err);
      setSingleError(err.message || "Не вдалося обробити чернетку");
    } finally {
      setIsProcessing(false);
    }
  };

  const tabFilteredResults = useMemo(() => {
    if (activeTab === "requests") {
      return results.filter((result) => result.is_user_request);
    }
    return results;
  }, [results, activeTab]);

  const categories = useMemo(() => {
    return uniqueSorted(
      tabFilteredResults.flatMap((result) => (result.issues || []).map((issue) => issue.category).filter(Boolean)),
    );
  }, [tabFilteredResults]);

  const sectors = useMemo(() => {
    return uniqueSorted(tabFilteredResults.map((result) => result.summary && result.summary.sector).filter(Boolean));
  }, [tabFilteredResults]);

  const aggregate = useMemo(() => computeAggregate(tabFilteredResults), [tabFilteredResults]);

  const userRequestsCount = useMemo(() => results.filter((r) => r.is_user_request).length, [results]);
  const allReviewsCount = results.length;

  const filtered = useMemo(() => {
    return sortResults(
      tabFilteredResults.filter((result) => {
        const summary = result.summary;
        const issues = result.issues || [];
        const haystack = [
          summary.tender_code,
          summary.title,
          summary.buyer_name,
          summary.cpv,
          summary.sector,
          summary.procurement_method_type,
          ...issues.flatMap((issue) => [
            issue.category,
            issue.title,
            issue.evidence_quote,
            issue.document_title,
          ]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("uk-UA");
        const searchTerm = query.trim().toLocaleLowerCase("uk-UA");
        const highestSeverity = getHighestSeverity(result);
        const scoreLimit = parseScore(maxScore);

        return (
          (!searchTerm || haystack.includes(searchTerm)) &&
          (!category || issues.some((issue) => issue.category === category)) &&
          (!sector || summary.sector === sector) &&
          (!severity || highestSeverity === severity) &&
          (scoreLimit === null || Number(result.overall_score || 0) <= scoreLimit)
        );
      }),
      sort,
    );
  }, [tabFilteredResults, query, category, sector, severity, maxScore, sort]);

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setSector("");
    setSeverity("");
    setMaxScore("");
    setSort("processed_desc");
  };

  const selectedTender = useMemo(() => {
    return results.find((r) => r.summary.tender_id === selectedTenderId);
  }, [results, selectedTenderId]);

  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setSelectedTenderId(null);
          }}
        >
          Якість документації Prozorro
        </a>
        <span className="notice">Автоматичні сигнали потребують перевірки людиною</span>
      </header>

      <main className="layout">
        <div className="dashboard-app">
          {selectedTender ? (
            <TenderDetail result={selectedTender} onClose={() => setSelectedTenderId(null)} />
          ) : selectedTenderId ? (
            <section className="empty-state">
              <h2>Тендер завантажується або не знайдено</h2>
              <p>
                Будь ласка, зачекайте або поверніться{" "}
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedTenderId(null);
                  }}
                >
                  до списку
                </a>
                .
              </p>
            </section>
          ) : (
            <>
              <IdentityHeader
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                userRequestsCount={userRequestsCount}
                allReviewsCount={allReviewsCount}
              />
              {activeTab === "heuristics" ? (
                <HeuristicsView />
              ) : activeTab === "admin" ? (
                <AdminView />
              ) : (
                <div className="dashboard-grid">
                  <section className="dashboard-main" aria-label="Огляд якості тендерів">
                    {activeTab === "all" && <MetricGrid aggregate={aggregate} />}
                    <SearchDock
                      categories={categories}
                      category={category}
                      clearFilters={clearFilters}
                      maxScore={maxScore}
                      query={query}
                      sector={sector}
                      sectors={sectors}
                      setCategory={setCategory}
                      setMaxScore={setMaxScore}
                      setQuery={setQuery}
                      setSector={setSector}
                      setSeverity={setSeverity}
                      setSort={setSort}
                      severity={severity}
                      sort={sort}
                    />
                    <TenderTable
                      error={error}
                      results={filtered}
                      status={status}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      processingTenderIds={processingTenderIds}
                      onSelectTender={setSelectedTenderId}
                    />
                  </section>
                  <aside className="dashboard-rail" aria-label="Дії та ризики">
                    <ActionPanel
                      defaultPages={defaultPages}
                      showBatchForm={activeTab === "all"}
                      showSingleForm={true}
                      isProcessing={isProcessing}
                      singleError={singleError}
                      onProcessTender={handleProcessTenders}
                      onProcessCustom={handleProcessCustom}
                    />
                    {activeTab === "all" && (
                      <RiskOverview
                        aggregate={aggregate}
                        results={tabFilteredResults}
                        onSelectTender={setSelectedTenderId}
                      />
                    )}
                  </aside>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
