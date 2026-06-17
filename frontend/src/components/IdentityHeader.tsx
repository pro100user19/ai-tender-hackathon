import type { ReactNode } from "react";

interface IdentityHeaderProps {
  activeTab: "requests" | "all" | "heuristics" | "admin";
  setActiveTab: (tab: "requests" | "all" | "heuristics" | "admin") => void;
  userRequestsCount: number;
  allReviewsCount: number;
}

export function IdentityHeader({
  activeTab,
  setActiveTab,
  userRequestsCount,
  allReviewsCount,
}: IdentityHeaderProps): ReactNode {
  return (
    <header className="identity-header">
      <a className="identity-brand" href="/">
        <span className="brand-mark" aria-hidden="true">pr</span>
        <span>
          <strong>prozorro</strong>
          <small>quality dashboard</small>
        </span>
      </a>
      <div className="header-tabs">
        <button
          className={`header-tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => setActiveTab("requests")}
        >
          Запити користувачів
          <span className="header-tab-badge">{userRequestsCount.toString()}</span>
        </button>
        <button
          className={`header-tab-btn ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          Всі перевірки
          <span className="header-tab-badge">{allReviewsCount.toString()}</span>
        </button>
      </div>
      <nav className="identity-nav" aria-label="Навігація">
        <a href="https://prozorro.gov.ua/en" target="_blank" rel="noreferrer">prozorro.gov.ua</a>
        <a
          href="#heuristics"
          className={activeTab === "heuristics" ? "active-nav-link" : ""}
          onClick={(e) => {
            e.preventDefault();
            setActiveTab("heuristics");
          }}
        >
          автоматичні сигнали
        </a>
        {(activeTab === "admin" || window.location.pathname === "/admin") && (
          <a
            href="/admin"
            className={activeTab === "admin" ? "active-nav-link" : ""}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("admin");
            }}
          >
            адмін-панель
          </a>
        )}
      </nav>
    </header>
  );
}
