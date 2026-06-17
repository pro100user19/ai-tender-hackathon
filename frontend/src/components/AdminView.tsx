import { useEffect, useState } from "react";
import type { ReactNode } from "react";

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
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem("admin_auth");
  });

  const [heuristics, setHeuristics] = useState<AdminHeuristic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"to_review" | "active" | "rejected">("to_review");

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
          setError(err.message || "Помилка завантаження евристик");
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
        throw new Error(errData.detail || "Неправильний логін або пароль");
      }

      const data = await response.json();
      const userToken = data.token;
      sessionStorage.setItem("admin_auth", userToken);
      setToken(userToken);
    } catch (err: any) {
      setLoginError(err.message || "Помилка авторизації");
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
      alert(`Не вдалося змінити статус: ${err.message || err}`);
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
      setMiningStatus({ status: "error", error: err.message || "Не вдалося запустити майнінг" });
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
            <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 6px 0", color: "var(--ink)" }}>
              Вхід до адмін-панелі
            </h2>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              Будь ласка, авторизуйтесь для керування автоматичними сигналами.
            </p>
          </div>

          {loginError && (
            <div className="panel-error" style={{ fontSize: "13px", padding: "8px 12px" }}>
              {loginError}
            </div>
          )}

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>
            Ім'я користувача
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

          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>
            Пароль
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
              fontWeight: 800,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              transition: "opacity 0.2s ease"
            }}
          >
            {loggingIn ? "Вхід..." : "Увійти"}
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
        <h2>Адміністрування евристик</h2>
        <p className="lead">Завантаження панелі адміністрування...</p>
        <div className="skeleton-table">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  return (
    <div className="heuristics-view">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <h2>Панель адміністрування евристик</h2>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                borderRadius: "20px",
                background: "var(--panel-soft)",
                color: "var(--muted)",
                fontWeight: 700,
                padding: "4px 12px",
                border: "1px solid var(--line)",
                cursor: "pointer",
                fontSize: "11px"
              }}
            >
              Вийти
            </button>
          </div>
          <p className="lead">
            Керування правилами аналізу та запуск автоматичного LLM-пошуку нових дискримінаційних умов.
          </p>
        </div>

        {/* LLM Mining Control Panel */}
        <div className="mining-control-card" style={{
          background: "var(--panel-soft)",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          padding: "16px",
          maxWidth: "420px",
          flex: "1 1 300px"
        }}>
          <h3 style={{ fontSize: "14px", fontWeight: 800, margin: "0 0 10px 0", color: "var(--ink)" }}>
            Автоматичний LLM-пошук евристик
          </h3>
          {miningStatus.status === "running" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div className="spinner" style={{
                width: "20px",
                height: "20px",
                border: "3px solid var(--line)",
                borderTopColor: "var(--blue)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }}></div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>
                Аналізуємо тендери та виділяємо нові правила...
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {miningStatus.status === "error" && (
                <div className="panel-error" style={{ fontSize: "12px", padding: "6px 10px" }}>
                  Помилка: {miningStatus.error}
                </div>
              )}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", flex: 1 }}>
                  Кількість тендерів
                  <select
                    value={mineLimit}
                    onChange={(e) => setMineLimit(Number(e.target.value))}
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      borderRadius: "6px",
                      border: "1px solid var(--line)",
                      padding: "6px",
                      fontSize: "13px"
                    }}
                  >
                    <option value="3">3 тендери</option>
                    <option value="5">5 тендерів</option>
                    <option value="10">10 тендерів</option>
                    <option value="20">20 тендерів</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleRunMining}
                  style={{
                    alignSelf: "flex-end",
                    borderRadius: "6px",
                    background: "var(--blue-strong)",
                    color: "#fff",
                    fontWeight: 700,
                    padding: "8px 14px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    height: "35px"
                  }}
                >
                  Запустити пошук
                </button>
              </div>
            </div>
          )}

          {/* Runs History */}
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
            <h4 style={{ fontSize: "12px", fontWeight: 800, margin: "0 0 8px 0", color: "var(--ink)" }}>
              Історія запусків майнінгу
            </h4>
            {historyLoading && miningHistory.length === 0 ? (
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Завантаження історії...</div>
            ) : miningHistory.length === 0 ? (
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Історія пошуків порожня</div>
            ) : (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "180px",
                overflowY: "auto",
                paddingRight: "4px",
                marginBottom: "12px"
              }}>
                {miningHistory.map((run) => (
                  <div key={run.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    padding: "8px",
                    borderRadius: "6px",
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)" }}>
                        {formatDateTime(run.requested_at)}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "10px" }}>
                        Обмеження: {run.tenders_limit} | Знайдено нових: {run.tenders_analyzed}
                      </span>
                      {run.error && (
                        <span style={{ color: "var(--red)", fontSize: "9px", marginTop: "2px" }} title={run.error}>
                          Помилка: {run.error.length > 40 ? run.error.substring(0, 37) + "..." : run.error}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <span style={{ fontWeight: 800, color: "var(--ink)" }}>
                        ${run.total_cost_usd ? run.total_cost_usd.toFixed(4) : "0.0000"}
                      </span>
                      <span className={`status-badge ${run.status}`} style={{
                        fontSize: "9px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        textTransform: "uppercase",
                        background: run.status === "success" ? "var(--green-soft)" : run.status === "running" ? "var(--blue-soft)" : "var(--red-soft)",
                        color: run.status === "success" ? "var(--green-strong)" : run.status === "running" ? "var(--blue-strong)" : "var(--red)"
                      }}>
                        {run.status === "success" ? "Успішно" : run.status === "running" ? "Пошук..." : "Помилка"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Flow LLM Explanations */}
          <div style={{ marginTop: "16px", borderTop: "1px solid var(--line)", paddingTop: "12px" }}>
            <h4 style={{ fontSize: "12px", fontWeight: 800, margin: "0 0 8px 0", color: "var(--ink)" }}>
              Історія LLM-пояснень користувачів
            </h4>
            {userLlmLoading && userLlmHistory.length === 0 ? (
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Завантаження історії...</div>
            ) : userLlmHistory.length === 0 ? (
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Немає запусків LLM від користувачів</div>
            ) : (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "180px",
                overflowY: "auto",
                paddingRight: "4px"
              }}>
                {userLlmHistory.map((run) => (
                  <div key={run.tender_id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    padding: "8px",
                    borderRadius: "6px",
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={run.title}>
                        {run.tender_code}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "10px" }}>
                        {formatDateTime(run.processed_at)}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", marginLeft: "12px" }}>
                      <span style={{ fontWeight: 800, color: "var(--ink)" }}>
                        ${run.total_cost_usd ? run.total_cost_usd.toFixed(4) : "0.0000"}
                      </span>
                      <span style={{ color: "var(--muted)", fontSize: "9px" }}>
                        {run.tokens ? run.tokens.toLocaleString() : "0"} токенів
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="panel-error">{error}</p>}

      {/* Admin Tab Switching */}
      <div className="heuristics-filters" style={{
        display: "flex",
        gap: "10px",
        borderBottom: "1px solid var(--line)",
        paddingBottom: "12px",
        marginTop: "16px"
      }}>
        <button
          type="button"
          onClick={() => setActiveSubTab("to_review")}
          style={{
            background: activeSubTab === "to_review" ? "var(--blue-soft)" : "transparent",
            color: activeSubTab === "to_review" ? "var(--blue-strong)" : "var(--muted)",
            border: "none",
            borderRadius: "6px",
            padding: "8px 16px",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          Потребують модерації
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
            background: activeSubTab === "active" ? "var(--blue-soft)" : "transparent",
            color: activeSubTab === "active" ? "var(--blue-strong)" : "var(--muted)",
            border: "none",
            borderRadius: "6px",
            padding: "8px 16px",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          Активні правила
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
            background: activeSubTab === "rejected" ? "var(--blue-soft)" : "transparent",
            color: activeSubTab === "rejected" ? "var(--blue-strong)" : "var(--muted)",
            border: "none",
            borderRadius: "6px",
            padding: "8px 16px",
            fontWeight: 800,
            cursor: "pointer",
            fontSize: "13px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          Відхилені правила
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
        {currentList.map((rule, idx) => {
          const sevClass = rule.severity === "висока" ? "high" : rule.severity === "середня" ? "medium" : "low";
          const isExpanded = expandedHeuristics.has(rule.id);
          return (
            <div key={rule.id} className="heuristic-rule-card" style={{ borderLeft: "4px solid var(--line)" }}>
              <div className="heuristic-card-header">
                <span className="heuristic-category">{rule.category}</span>
                <span className={`heuristic-severity ${sevClass}`}>{rule.severity}</span>
              </div>
              <h3>{rule.title}</h3>
              <p className="heuristic-explanation">{rule.explanation}</p>
              
              {rule.suggested_rewrite && (
                <div className="heuristic-rewrite">
                  <strong>Рекомендоване редагування:</strong> {rule.suggested_rewrite}
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
                    {isExpanded ? "▲ Сховати вираз" : "▼ Показати вираз"}
                  </button>
                </div>

                {isExpanded && (
                  <div className="heuristic-pattern-box" style={{ margin: 0 }}>
                    <code>{rule.pattern}</code>
                  </div>
                )}

                {/* Moderation Controls */}
                <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                  {rule.status === "to_review" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(rule.id, "active")}
                        style={{
                          flex: 1,
                          background: "var(--green-soft)",
                          color: "var(--green-strong)",
                          border: "1px solid var(--green)",
                          borderRadius: "4px",
                          padding: "6px 8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        ✓ Затвердити
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(rule.id, "rejected")}
                        style={{
                          flex: 1,
                          background: "var(--red-soft)",
                          color: "var(--red)",
                          border: "1px solid var(--red)",
                          borderRadius: "4px",
                          padding: "6px 8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer"
                        }}
                      >
                        ✕ Відхилити
                      </button>
                    </>
                  )}
                  {rule.status === "active" && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(rule.id, "rejected")}
                      style={{
                        width: "100%",
                        background: "var(--red-soft)",
                        color: "var(--red)",
                        border: "1px solid var(--red)",
                        borderRadius: "4px",
                        padding: "6px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      ✕ Деактивувати
                    </button>
                  )}
                  {rule.status === "rejected" && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(rule.id, "active")}
                      style={{
                        width: "100%",
                        background: "var(--green-soft)",
                        color: "var(--green-strong)",
                        border: "1px solid var(--green)",
                        borderRadius: "4px",
                        padding: "6px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      ✓ Активувати
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
          Немає правил у цій категорії.
        </p>
      )}
    </div>
  );
}
