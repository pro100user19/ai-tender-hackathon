import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, LogOut, Play, X } from "lucide-react";
import { useTranslation } from "../LanguageContext";
import { CustomSelect } from "./CustomSelect";

interface AdminHeuristic {
  id: number;
  category: string;
  title: string;
  severity: string;
  explanation: string;
  suggested_rewrite: string;
  subscores: string[];
  pattern: string;
  status: "active" | "rejected" | "to_review";
}

interface MiningStatus {
  status: "idle" | "running" | "error";
  error: string | null;
}

interface MiningRun {
  id: number;
  requested_at: string;
  tenders_limit: number;
  tenders_analyzed: number;
  total_cost_usd: number;
  status: "running" | "success" | "failed";
  error: string | null;
}

interface UserLlmRun {
  tender_id: string;
  tender_code: string;
  title: string;
  processed_at: string;
  total_cost_usd: number;
  tokens: number;
}

export function AdminView(): ReactNode {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem("admin_auth");
  });

  const [heuristics, setHeuristics] = useState<AdminHeuristic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"to_review" | "active" | "rejected">("to_review");
  const [activeAdminTab, setActiveAdminTab] = useState<"moderation" | "mining" | "user_llm">("moderation");

  // Login form states
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // Mining states
  const [mineLimit, setMineLimit] = useState(5);
  const [miningStatus, setMiningStatus] = useState<MiningStatus>({ status: "idle", error: null });
  const [expandedHeuristics, setExpandedHeuristics] = useState<Set<number>>(new Set());
  const [miningHistory, setMiningHistory] = useState<MiningRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [userLlmHistory, setUserLlmHistory] = useState<UserLlmRun[]>([]);
  const [userLlmLoading, setUserLlmLoading] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = {
      "Accept": "application/json",
    };
    if (token) {
      headers["Authorization"] = token;
    }
    return headers;
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_auth");
    setToken(null);
    setHeuristics([]);
    setError("");
  };

  const checkAuthFailure = (status: number) => {
    if (status === 401) {
      handleLogout();
    }
  };

  const fetchHeuristics = (authToken: string) => {
    setLoading(true);
    fetch("/api/admin/heuristics", {
      headers: {
        "Accept": "application/json",
        "Authorization": authToken,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          handleLogout();
          throw new Error("Unauthorized");
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<AdminHeuristic[]>;
      })
      .then((data) => {
        setHeuristics(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.message !== "Unauthorized") {
          setError(err.message || t("errorLoadingHeuristics"));
        }
        setLoading(false);
      });
  };

  const formatDateTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr + "Z");
      if (isNaN(date.getTime())) return isoStr;
      
      const pad = (n: number) => n.toString().padStart(2, "0");
      const day = pad(date.getDate());
      const month = pad(date.getMonth() + 1);
      const year = date.getFullYear();
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    } catch {
      return isoStr;
    }
  };

  const fetchMiningHistory = (authToken: string) => {
    setHistoryLoading(true);
    fetch("/api/admin/heuristics/mine/history", {
      headers: {
        "Accept": "application/json",
        "Authorization": authToken,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          handleLogout();
          throw new Error("Unauthorized");
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<MiningRun[]>;
      })
      .then((data) => {
        setMiningHistory(data);
        setHistoryLoading(false);
      })
      .catch(() => {
        setHistoryLoading(false);
      });
  };

  const fetchUserLlmHistory = (authToken: string) => {
    setUserLlmLoading(true);
    fetch("/api/admin/llm/history", {
      headers: {
        "Accept": "application/json",
        "Authorization": authToken,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          handleLogout();
          throw new Error("Unauthorized");
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json() as Promise<UserLlmRun[]>;
      })
      .then((data) => {
        setUserLlmHistory(data);
        setUserLlmLoading(false);
      })
      .catch(() => {
        setUserLlmLoading(false);
      });
  };

  const fetchMiningStatus = (authToken: string) => {
    fetch("/api/admin/heuristics/mine/status", {
      headers: {
        "Accept": "application/json",
        "Authorization": authToken,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          handleLogout();
          return;
        }
        return res.json() as Promise<MiningStatus>;
      })
      .then((data) => {
        if (!data) return;
        setMiningStatus(data);
        if (data.status === "running") {
          setTimeout(() => fetchMiningStatus(authToken), 2000);
        } else {
          fetchHeuristics(authToken);
          fetchMiningHistory(authToken);
          fetchUserLlmHistory(authToken);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (token) {
      fetchHeuristics(token);
      fetchMiningStatus(token);
      fetchMiningHistory(token);
      fetchUserLlmHistory(token);
    }
  }, [token]);

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || t("invalidLoginError"));
      }

      const data = await response.json();
      const userToken = data.token;
      sessionStorage.setItem("admin_auth", userToken);
      setToken(userToken);
    } catch (err: any) {
      setLoginError(err.message || t("authError"));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: "active" | "rejected" | "to_review") => {
    try {
      const response = await fetch(`/api/admin/heuristics/${id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token || "",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      checkAuthFailure(response.status);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      // Optimistic update
      setHeuristics((prev) =>
        prev.map((h) => (h.id === id ? { ...h, status: newStatus } : h))
      );
    } catch (err: any) {
      alert(`${t("errorStatusChange")}: ${err.message || err}`);
    }
  };

  const handleRunMining = async () => {
    try {
      setMiningStatus({ status: "running", error: null });
      const response = await fetch("/api/admin/heuristics/mine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token || "",
        },
        body: JSON.stringify({ limit: mineLimit }),
      });
      checkAuthFailure(response.status);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${response.status}`);
      }
      if (token) {
        fetchMiningHistory(token);
        setTimeout(() => fetchMiningStatus(token), 1500);
      }
    } catch (err: any) {
      setMiningStatus({ status: "error", error: err.message || t("errorFailedToStartMining") });
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedHeuristics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Render Login Panel
  if (!token) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "450px",
        padding: "20px"
      }}>
        <form onSubmit={handleLoginSubmit} className="action-panel" style={{
          maxWidth: "400px",
          width: "100%",
          padding: "24px",
          background: "var(--panel)",
          borderRadius: "8px",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow)",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 6px 0", color: "var(--ink)" }}>
              {t("adminLoginTitle")}
            </h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {t("adminLoginSubtitle")}
            </p>
          </div>

          {loginError && (
            <div className="panel-error" style={{ fontSize: "13px", padding: "8px 12px" }}>
              {loginError}
            </div>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 500, color: "var(--muted)" }}>
            {t("usernameLabel")}
            <input
              type="text"
              placeholder="admin"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              required
              disabled={loggingIn}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                fontSize: "14px",
                color: "var(--ink)",
                background: "var(--panel)"
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 500, color: "var(--muted)" }}>
            {t("passwordLabel")}
            <input
              type="password"
              placeholder="••••••••"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
              disabled={loggingIn}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--line)",
                fontSize: "14px",
                color: "var(--ink)",
                background: "var(--panel)"
              }}
            />
          </label>

          <button
            type="submit"
            disabled={loggingIn}
            style={{
              marginTop: "8px",
              padding: "10px",
              borderRadius: "6px",
              background: "var(--blue-strong)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              transition: "opacity 0.2s ease"
            }}
          >
            {loggingIn ? t("loggingInBtn") : t("loginBtn")}
          </button>
        </form>
      </div>
    );
  }

  // Groups
  const toReviewList = heuristics.filter((h) => h.status === "to_review");
  const activeList = heuristics.filter((h) => h.status === "active");
  const rejectedList = heuristics.filter((h) => h.status === "rejected");

  const currentList =
    activeSubTab === "to_review"
      ? toReviewList
      : activeSubTab === "active"
      ? activeList
      : rejectedList;

  if (loading && heuristics.length === 0) {
    return (
      <div className="heuristics-view">
        <h2>{t("adminTitle")}</h2>
        <p className="lead">{t("loading")}</p>
        <div className="skeleton-table">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="heuristics-view admin-view">
      {/* Header section with logout */}
      <div className="admin-heading">
        <div>
          <h2 style={{ margin: 0, fontSize: "22px" }}>{t("adminTitle")}</h2>
          <p className="lead" style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--muted)" }}>
            {t("adminSubtitle")}
          </p>
        </div>
        <button
          type="button"
          className="admin-logout-btn"
          onClick={handleLogout}
        >
          <LogOut aria-hidden="true" size={15} />
          {t("logoutBtn")}
        </button>
      </div>

      {/* Main Admin Tab Switcher */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeAdminTab === "moderation" ? "active" : ""}`}
          onClick={() => setActiveAdminTab("moderation")}
        >
          {t("moderationTab")}
        </button>
        <button
          type="button"
          className={`admin-tab ${activeAdminTab === "mining" ? "active" : ""}`}
          onClick={() => setActiveAdminTab("mining")}
        >
          {t("miningTab")}
        </button>
        <button
          type="button"
          className={`admin-tab ${activeAdminTab === "user_llm" ? "active" : ""}`}
          onClick={() => setActiveAdminTab("user_llm")}
        >
          {t("userLlmTab")}
        </button>
      </div>

      {error && <p className="panel-error">{error}</p>}

      {/* Render content based on activeAdminTab */}
      {activeAdminTab === "moderation" && (
        <>
          {/* LLM Mining Trigger Panel at the top of Moderation */}
          <div className="admin-mining-panel">
            <div style={{ flex: "1 1 400px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 4px 0", color: "var(--ink)" }}>
                {t("autoLlmSearchTitle")}
              </h3>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: 0 }}>
                {t("autoLlmSearchDesc")}
              </p>
            </div>
            {miningStatus.status === "running" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--blue-soft)", padding: "8px 12px", borderRadius: "6px" }}>
                <div className="spinner" style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid var(--line)",
                  borderTopColor: "var(--blue)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}></div>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--blue-strong)" }}>
                  {t("miningInProgress")}
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                {miningStatus.status === "error" && (
                  <span style={{ fontSize: "12px", color: "var(--red)", fontWeight: 500, marginRight: "8px" }}>
                    {t("statusFailed")}: {miningStatus.error}
                  </span>
                )}
                <CustomSelect
                  value={mineLimit.toString()}
                  onChange={(value) => setMineLimit(Number(value))}
                  options={[
                    { label: t("tenders3"), value: "3" },
                    { label: t("tenders5"), value: "5" },
                    { label: t("tenders10"), value: "10" },
                    { label: t("tenders20"), value: "20" },
                  ]}
                />
                <button
                  type="button"
                  className="admin-run-btn"
                  onClick={handleRunMining}
                >
                  <Play aria-hidden="true" size={15} />
                  {t("mineBtn")}
                </button>
              </div>
            )}
          </div>

          {/* Admin Sub Tab Switching */}
          <div className="admin-subtabs">
            <button
              type="button"
              onClick={() => setActiveSubTab("to_review")}
              style={{
                color: activeSubTab === "to_review" ? "var(--blue-strong)" : "var(--muted)"
              }}
              className={`admin-subtab ${activeSubTab === "to_review" ? "active" : ""}`}
            >
              {t("needModeration")}
              <span style={{
                background: toReviewList.length > 0 ? "var(--red)" : "var(--line)",
                color: toReviewList.length > 0 ? "#fff" : "var(--muted)",
                borderRadius: "999px",
                padding: "2px 6px",
                fontSize: "10px"
              }}>
                {toReviewList.length.toString()}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("active")}
              style={{
                color: activeSubTab === "active" ? "var(--blue-strong)" : "var(--muted)"
              }}
              className={`admin-subtab ${activeSubTab === "active" ? "active" : ""}`}
            >
              {t("activeRules")}
              <span style={{
                background: "var(--line)",
                color: "var(--muted)",
                borderRadius: "999px",
                padding: "2px 6px",
                fontSize: "10px"
              }}>
                {activeList.length.toString()}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab("rejected")}
              style={{
                color: activeSubTab === "rejected" ? "var(--blue-strong)" : "var(--muted)"
              }}
              className={`admin-subtab ${activeSubTab === "rejected" ? "active" : ""}`}
            >
              {t("rejectedRules")}
              <span style={{
                background: "var(--line)",
                color: "var(--muted)",
                borderRadius: "999px",
                padding: "2px 6px",
                fontSize: "10px"
              }}>
                {rejectedList.length.toString()}
              </span>
            </button>
          </div>

          {/* Rules Grid */}
          <div className="heuristics-grid">
            {currentList.map((rule) => {
              const sevClass = rule.severity === "висока" ? "high" : rule.severity === "середня" ? "medium" : "low";
              const isExpanded = expandedHeuristics.has(rule.id);
              return (
                <div key={rule.id} className="heuristic-rule-card admin-rule-card">
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
                    <div className="heuristic-subscores" style={{ marginBottom: "8px" }}>
                      {rule.subscores.map((sub, sIdx) => (
                        <span key={sIdx} className="heuristic-subscore-tag">
                          {sub}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <button
                        type="button"
                        className="heuristic-pattern-toggle"
                        onClick={() => toggleExpand(rule.id)}
                        style={{ fontSize: "11px" }}
                      >
                        {isExpanded
                          ? <ChevronUp aria-hidden="true" size={14} />
                          : <ChevronDown aria-hidden="true" size={14} />}
                        {isExpanded ? t("hidePattern") : t("showPattern")}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="heuristic-pattern-box" style={{ margin: 0 }}>
                        <code>{rule.pattern}</code>
                      </div>
                    )}

                    {/* Moderation Controls */}
                    <div className="moderation-actions" style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                      {rule.status === "to_review" && (
                        <>
                          <button
                            type="button"
                            className="moderation-btn is-success"
                            onClick={() => handleUpdateStatus(rule.id, "active")}
                            style={{
                              flex: 1,
                              background: "var(--green-soft)",
                              color: "var(--green-strong)",
                              border: "1px solid var(--green)",
                              borderRadius: "4px",
                              padding: "6px 8px",
                              fontSize: "11px",
                              fontWeight: 500,
                              cursor: "pointer"
                            }}
                          >
                            <Check aria-hidden="true" size={14} />
                            {t("approveBtn")}
                          </button>
                          <button
                            type="button"
                            className="moderation-btn is-danger"
                            onClick={() => handleUpdateStatus(rule.id, "rejected")}
                            style={{
                              flex: 1,
                              background: "var(--red-soft)",
                              color: "var(--red)",
                              border: "1px solid var(--red)",
                              borderRadius: "4px",
                              padding: "6px 8px",
                              fontSize: "11px",
                              fontWeight: 500,
                              cursor: "pointer"
                            }}
                          >
                            <X aria-hidden="true" size={14} />
                            {t("rejectBtn")}
                          </button>
                        </>
                      )}
                      {rule.status === "active" && (
                        <button
                          type="button"
                          className="moderation-btn is-danger"
                          onClick={() => handleUpdateStatus(rule.id, "rejected")}
                          style={{
                            width: "100%",
                            background: "var(--red-soft)",
                            color: "var(--red)",
                            border: "1px solid var(--red)",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            fontSize: "11px",
                            fontWeight: 500,
                            cursor: "pointer"
                          }}
                        >
                          <X aria-hidden="true" size={14} />
                          {t("deactivateBtn")}
                        </button>
                      )}
                      {rule.status === "rejected" && (
                        <button
                          type="button"
                          className="moderation-btn is-success"
                          onClick={() => handleUpdateStatus(rule.id, "active")}
                          style={{
                            width: "100%",
                            background: "var(--green-soft)",
                            color: "var(--green-strong)",
                            border: "1px solid var(--green)",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            fontSize: "11px",
                            fontWeight: 500,
                            cursor: "pointer"
                          }}
                        >
                          <Check aria-hidden="true" size={14} />
                          {t("activateBtn")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {currentList.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--muted)", padding: "40px 20px" }}>
              {t("emptyCategoryRules")}
            </p>
          )}
        </>
      )}

      {activeAdminTab === "mining" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Runs History Table */}
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "8px", padding: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 16px 0", color: "var(--ink)" }}>
              {t("miningHistoryTitle")}
            </h3>
            
            {historyLoading && miningHistory.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
                {t("loadingHistory")}
              </div>
            ) : miningHistory.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontStyle: "italic" }}>
                {t("historyEmpty")}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="results-table" style={{ minWidth: "100%", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>{t("thStartTime")}</th>
                      <th style={{ width: "15%" }}>{t("thTendersCount")}</th>
                      <th style={{ width: "25%" }}>{t("thResultsNewRules")}</th>
                      <th style={{ width: "15%" }}>{t("thStatus")}</th>
                      <th style={{ width: "25%", textAlign: "right" }}>{t("thRequestCost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {miningHistory.map((run) => (
                      <tr key={run.id}>
                        <td>
                          <strong>{formatDateTime(run.requested_at)}</strong>
                        </td>
                        <td>{run.tenders_limit}</td>
                        <td>
                          <div>{t("foundCount")}{run.tenders_analyzed}</div>
                          {run.error && (
                            <div style={{ color: "var(--red)", fontSize: "11px", marginTop: "4px", maxWidth: "300px" }} title={run.error}>
                              {t("statusFailed")}: {run.error}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${run.status}`} style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                            background: run.status === "success" ? "var(--green-soft)" : run.status === "running" ? "var(--blue-soft)" : "var(--red-soft)",
                            color: run.status === "success" ? "var(--green-strong)" : run.status === "running" ? "var(--blue-strong)" : "var(--red)"
                          }}>
                            {run.status === "success" ? t("statusSuccess") : run.status === "running" ? t("statusMining") : t("statusFailed")}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 800 }}>
                          ${run.total_cost_usd ? run.total_cost_usd.toFixed(4) : "0.0000"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeAdminTab === "user_llm" && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "8px", padding: "20px" }}>
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 4px 0", color: "var(--ink)" }}>
              {t("userLlmHistoryTitle")}
            </h3>
            <p style={{ fontSize: "13.5px", color: "var(--muted)", margin: 0 }}>
              {t("userLlmHistoryDesc")}
            </p>
          </div>

          {userLlmLoading && userLlmHistory.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)" }}>
              {t("loadingHistory")}
            </div>
          ) : userLlmHistory.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted)", fontStyle: "italic" }}>
              {t("noUserLlmRequests")}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="results-table" style={{ minWidth: "100%", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={{ width: "20%" }}>{t("thTenderCode")}</th>
                    <th style={{ width: "40%" }}>{t("thProcurementTitle")}</th>
                    <th style={{ width: "15%" }}>{t("thRequestTime")}</th>
                    <th style={{ width: "12%" }}>{t("thTokensUsed")}</th>
                    <th style={{ width: "13%", textAlign: "right" }}>{t("thCostUSD")}</th>
                  </tr>
                </thead>
                <tbody>
                  {userLlmHistory.map((run) => (
                    <tr key={run.tender_id}>
                      <td>
                        <a
                          href={`/tenders/${run.tender_id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            window.history.pushState({ tab: "requests", tenderId: run.tender_id }, "", `/tenders/${run.tender_id}`);
                            window.dispatchEvent(new PopStateEvent("popstate"));
                          }}
                          style={{ fontWeight: 800, color: "var(--blue-strong)", textDecoration: "underline" }}
                        >
                          {run.tender_code}
                        </a>
                      </td>
                      <td style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={run.title}>
                        {run.title}
                      </td>
                      <td>{formatDateTime(run.processed_at)}</td>
                      <td>{run.tokens ? run.tokens.toLocaleString() : "0"}</td>
                      <td style={{ textAlign: "right", fontWeight: 800 }}>
                        ${run.total_cost_usd ? run.total_cost_usd.toFixed(4) : "0.0000"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
