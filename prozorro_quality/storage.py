from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Iterable

from .models import LlmUsage, TenderResult


LLM_USAGE_SUM_FIELDS = (
    "input_tokens",
    "cached_input_tokens",
    "billable_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
    "input_cost_usd",
    "cached_input_cost_usd",
    "output_cost_usd",
    "total_cost_usd",
)


class ResultStorage:
    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS processed_tenders (
                    tender_id TEXT PRIMARY KEY,
                    tender_code TEXT NOT NULL,
                    title TEXT NOT NULL,
                    buyer_name TEXT,
                    value_amount REAL,
                    currency TEXT,
                    cpv TEXT,
                    sector TEXT,
                    procurement_method_type TEXT,
                    date_modified TEXT,
                    processed_at TEXT NOT NULL,
                    overall_score INTEGER NOT NULL,
                    issue_count INTEGER NOT NULL,
                    highest_severity TEXT NOT NULL,
                    result_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_requests (
                    user_id TEXT NOT NULL,
                    tender_id TEXT NOT NULL,
                    PRIMARY KEY (user_id, tender_id)
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS heuristics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    title TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    explanation TEXT NOT NULL,
                    suggested_rewrite TEXT NOT NULL,
                    subscores TEXT NOT NULL,
                    pattern TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active'
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS mining_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    requested_at TEXT NOT NULL,
                    tenders_limit INTEGER NOT NULL,
                    tenders_analyzed INTEGER DEFAULT 0,
                    total_cost_usd REAL DEFAULT 0.0,
                    status TEXT NOT NULL,
                    error TEXT
                )
                """
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_tenders(processed_at DESC)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_score ON processed_tenders(overall_score)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_user_requests ON user_requests(user_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_heuristics_status ON heuristics(status)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_mining_history_requested ON mining_history(requested_at DESC)"
            )

            # Migration: add is_private column if not exists
            try:
                conn.execute("ALTER TABLE processed_tenders ADD COLUMN is_private INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            cursor = conn.execute("SELECT COUNT(*) as cnt FROM heuristics")
            row = cursor.fetchone()
            if row["cnt"] == 0:
                from .analyzer import RULES
                for r in RULES:
                    conn.execute(
                        """
                        INSERT INTO heuristics (category, title, severity, explanation, suggested_rewrite, subscores, pattern, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
                        """,
                        (
                            r.category,
                            r.title,
                            r.severity,
                            r.explanation,
                            r.suggested_rewrite,
                            json.dumps(list(r.subscores), ensure_ascii=False),
                            r.pattern.pattern,
                        ),
                    )



    def has_tender(self, tender_id: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT tender_id FROM processed_tenders WHERE tender_id = ?",
                (tender_id,),
            ).fetchone()
        return row is not None

    def processed_ids(self) -> set[str]:
        with self._connect() as conn:
            rows = conn.execute("SELECT tender_id FROM processed_tenders").fetchall()
        return {row["tender_id"] for row in rows}

    def save(self, result: TenderResult) -> None:
        existing = self.get(result.summary.tender_id)
        if existing is not None:
            result.llm_usage = merge_llm_usage(existing.llm_usage, result.llm_usage)
        payload = json.dumps(result.to_dict(), ensure_ascii=False, indent=2)
        summary = result.summary
        is_private = 1 if result.is_private else 0
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO processed_tenders (
                    tender_id, tender_code, title, buyer_name, value_amount, currency, cpv,
                    sector, procurement_method_type, date_modified, processed_at,
                    overall_score, issue_count, highest_severity, result_json, is_private
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(tender_id) DO UPDATE SET
                    tender_code = excluded.tender_code,
                    title = excluded.title,
                    buyer_name = excluded.buyer_name,
                    value_amount = excluded.value_amount,
                    currency = excluded.currency,
                    cpv = excluded.cpv,
                    sector = excluded.sector,
                    procurement_method_type = excluded.procurement_method_type,
                    date_modified = excluded.date_modified,
                    processed_at = excluded.processed_at,
                    overall_score = excluded.overall_score,
                    issue_count = excluded.issue_count,
                    highest_severity = excluded.highest_severity,
                    result_json = excluded.result_json,
                    is_private = excluded.is_private
                """,
                (
                    summary.tender_id,
                    summary.tender_code,
                    summary.title,
                    summary.buyer_name,
                    summary.value_amount,
                    summary.currency,
                    summary.cpv,
                    summary.sector,
                    summary.procurement_method_type,
                    summary.date_modified,
                    result.processed_at,
                    result.overall_score,
                    len(result.issues),
                    result.highest_severity,
                    payload,
                    is_private,
                ),
            )

    def get(self, tender_id: str) -> TenderResult | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT result_json FROM processed_tenders WHERE tender_id = ?",
                (tender_id,),
            ).fetchone()
        if row is None:
            return None
        return TenderResult.from_dict(json.loads(row["result_json"]))

    def list_results(self, user_id: str | None = None) -> list[TenderResult]:
        if user_id:
            query = """
                SELECT pt.result_json 
                FROM processed_tenders pt
                LEFT JOIN user_requests ur ON pt.tender_id = ur.tender_id AND ur.user_id = ?
                WHERE COALESCE(pt.is_private, 0) = 0 OR ur.user_id IS NOT NULL
                ORDER BY pt.processed_at DESC
            """
            params = (user_id,)
        else:
            query = """
                SELECT result_json 
                FROM processed_tenders 
                WHERE COALESCE(is_private, 0) = 0 
                ORDER BY processed_at DESC
            """
            params = ()
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        return [TenderResult.from_dict(json.loads(row["result_json"])) for row in rows]

    def aggregate(self, user_id: str | None = None) -> dict[str, object]:
        results = self.list_results(user_id=user_id)
        total = len(results)
        if not results:
            return {
                "total": 0,
                "average_score": 0,
                "issue_count": 0,
                "high_risk_count": 0,
                "total_llm_cost": 0,
                "total_llm_tokens": 0,
                "sectors": [],
            }
        issue_count = sum(len(result.issues) for result in results)
        high_risk_count = sum(
            1 for result in results for issue in result.issues if issue.severity == "висока"
        )
        total_llm_cost = sum(result.llm_usage.total_cost_usd for result in results)
        total_llm_tokens = sum(result.llm_usage.total_tokens for result in results)
        sector_counts: dict[str, int] = {}
        for result in results:
            sector_counts[result.summary.sector] = sector_counts.get(result.summary.sector, 0) + 1
        return {
            "total": total,
            "average_score": round(sum(result.overall_score for result in results) / total, 1),
            "issue_count": issue_count,
            "high_risk_count": high_risk_count,
            "total_llm_cost": total_llm_cost,
            "total_llm_tokens": total_llm_tokens,
            "sectors": sorted(sector_counts.items(), key=lambda item: item[1], reverse=True),
        }

    def add_user_request(self, user_id: str, tender_id: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO user_requests (user_id, tender_id) VALUES (?, ?)",
                (user_id, tender_id),
            )

    def get_user_request_ids(self, user_id: str) -> set[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT tender_id FROM user_requests WHERE user_id = ?",
                (user_id,),
            ).fetchall()
        return {row["tender_id"] for row in rows}

    def get_active_heuristics(self) -> list[Any]:
        from .analyzer import Rule
        import re
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT category, title, severity, explanation, suggested_rewrite, subscores, pattern FROM heuristics WHERE status = 'active'"
            ).fetchall()
        rules = []
        for row in rows:
            try:
                subscores = tuple(json.loads(row["subscores"]))
            except Exception:
                subscores = ()
            try:
                pattern = re.compile(row["pattern"], re.UNICODE)
            except Exception:
                continue
            rules.append(
                Rule(
                    category=row["category"],
                    title=row["title"],
                    severity=row["severity"],
                    explanation=row["explanation"],
                    suggested_rewrite=row["suggested_rewrite"],
                    subscores=subscores,
                    pattern=pattern,
                )
            )
        return rules

    def list_heuristics(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, category, title, severity, explanation, suggested_rewrite, subscores, pattern, status FROM heuristics ORDER BY id DESC"
            ).fetchall()
        res = []
        for row in rows:
            try:
                subscores = json.loads(row["subscores"])
            except Exception:
                subscores = []
            res.append({
                "id": row["id"],
                "category": row["category"],
                "title": row["title"],
                "severity": row["severity"],
                "explanation": row["explanation"],
                "suggested_rewrite": row["suggested_rewrite"],
                "subscores": subscores,
                "pattern": row["pattern"],
                "status": row["status"],
            })
        return res

    def update_heuristic_status(self, heuristic_id: int, status: str) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE heuristics SET status = ? WHERE id = ?",
                (status, heuristic_id),
            )

    def add_heuristic(self, category: str, title: str, severity: str, explanation: str, suggested_rewrite: str, subscores: list[str], pattern: str, status: str = 'to_review') -> int:
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO heuristics (category, title, severity, explanation, suggested_rewrite, subscores, pattern, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (category, title, severity, explanation, suggested_rewrite, json.dumps(subscores, ensure_ascii=False), pattern, status),
            )
            return cursor.lastrowid

    def start_mining_run(self, limit: int) -> int:
        import datetime
        requested_at = datetime.datetime.utcnow().isoformat()
        with self._connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO mining_history (requested_at, tenders_limit, tenders_analyzed, total_cost_usd, status, error)
                VALUES (?, ?, 0, 0.0, 'running', NULL)
                """,
                (requested_at, limit),
            )
            return cursor.lastrowid

    def update_mining_run(
        self,
        run_id: int,
        status: str,
        tenders_analyzed: int = 0,
        total_cost_usd: float = 0.0,
        error: str | None = None,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE mining_history
                SET status = ?, tenders_analyzed = ?, total_cost_usd = ?, error = ?
                WHERE id = ?
                """,
                (status, tenders_analyzed, total_cost_usd, error, run_id),
            )

    def list_mining_history(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, requested_at, tenders_limit, tenders_analyzed, total_cost_usd, status, error FROM mining_history ORDER BY requested_at DESC"
            ).fetchall()
        from typing import Any
        return [
            {
                "id": row["id"],
                "requested_at": row["requested_at"],
                "tenders_limit": row["tenders_limit"],
                "tenders_analyzed": row["tenders_analyzed"],
                "total_cost_usd": row["total_cost_usd"],
                "status": row["status"],
                "error": row["error"],
            }
            for row in rows
        ]


class MemoryProcessedSet:
    def __init__(self, ids: Iterable[str] = ()):
        self.ids = set(ids)

    def has_tender(self, tender_id: str) -> bool:
        return tender_id in self.ids


def merge_llm_usage(previous: LlmUsage, current: LlmUsage) -> LlmUsage:
    if not has_billable_usage(previous):
        return current
    if not has_billable_usage(current):
        return previous

    merged = LlmUsage(
        model=current.model or previous.model,
        input_usd_per_million=current.input_usd_per_million or previous.input_usd_per_million,
        cached_input_usd_per_million=(
            current.cached_input_usd_per_million or previous.cached_input_usd_per_million
        ),
        output_usd_per_million=current.output_usd_per_million or previous.output_usd_per_million,
        source=current.source or previous.source,
    )
    for field_name in LLM_USAGE_SUM_FIELDS:
        setattr(merged, field_name, getattr(previous, field_name) + getattr(current, field_name))
    return merged


def has_billable_usage(usage: LlmUsage) -> bool:
    return any(getattr(usage, field_name) for field_name in LLM_USAGE_SUM_FIELDS)
