from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import os
import secrets
import json
import re

from fastapi import FastAPI, Form, Request, Depends, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .config import Settings, load_settings
from .models import TenderResult, priority_class, priority_label, priority_weight
from .processor import TenderProcessor
from .storage import ResultStorage

import base64

def get_current_admin(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Basic "):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized access - please login via admin panel",
        )
    try:
        encoded_credentials = auth_header.split(" ", 1)[1]
        decoded_credentials = base64.b64decode(encoded_credentials).decode("utf-8")
        username, password = decoded_credentials.split(":", 1)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication headers",
        )
        
    correct_username = os.environ.get("ADMIN_USER", "admin")
    correct_password = os.environ.get("ADMIN_PASSWORD", "admin")
    
    is_correct_username = secrets.compare_digest(username, correct_username)
    is_correct_password = secrets.compare_digest(password, correct_password)
    
    if not (is_correct_username and is_correct_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
        )
    return username

MINING_STATUS = {"status": "idle", "error": None}

def run_heuristics_mining_task(db_path: Path, limit: int, run_id: int):
    global MINING_STATUS
    MINING_STATUS["status"] = "running"
    MINING_STATUS["error"] = None
    
    storage = ResultStorage(db_path)
    analyzed_count = 0
    total_cost = 0.0
    
    try:
        from tools.codex_heuristic_mining import analyze_tenders, synthesize, SYNTHESIS_PATH
        
        # Analyze tenders with a small limit
        analyzed_count, analysis_cost = analyze_tenders(limit=limit, timeout=600)
        total_cost += analysis_cost
        
        # Synthesize mined heuristics
        synthesis_cost = synthesize(timeout=600)
        total_cost += synthesis_cost
        
        # Parse the synthesized heuristics and save them to SQLite
        if SYNTHESIS_PATH.exists():
            payload = json.loads(SYNTHESIS_PATH.read_text(encoding="utf-8"))
            synthesis = payload.get("synthesis", {})
            new_heuristics = synthesis.get("heuristics", [])
            
            added_count = 0
            for h in new_heuristics:
                category = h.get("category", "інші ризики")
                title = h.get("signal_title", "Нова евристика")
                severity = h.get("recommended_severity", "середня")
                explanation = h.get("why_it_matters", "")
                suggested_rewrite = h.get("suggested_rewrite", "")
                pattern = h.get("detection_pattern", "")
                
                # Verify that the regex compiles
                try:
                    re.compile(pattern, re.UNICODE)
                except Exception:
                    continue
                
                # Check if this rule pattern is already in heuristics table
                with storage._connect() as conn:
                    existing = conn.execute(
                        "SELECT id FROM heuristics WHERE pattern = ?", (pattern,)
                    ).fetchone()
                if existing:
                    continue
                
                storage.add_heuristic(
                    category=category,
                    title=title,
                    severity=severity,
                    explanation=explanation,
                    suggested_rewrite=suggested_rewrite,
                    subscores=["конкурентність"],
                    pattern=pattern,
                    status="to_review"
                )
                added_count += 1
            
            print(f"Heuristics mining completed successfully. Added {added_count} new heuristics to review.")
        
        storage.update_mining_run(
            run_id=run_id,
            status="success",
            tenders_analyzed=analyzed_count,
            total_cost_usd=total_cost
        )
        MINING_STATUS["status"] = "idle"
    except Exception as exc:
        print(f"Heuristics mining background task failed: {exc}")
        storage.update_mining_run(
            run_id=run_id,
            status="failed",
            tenders_analyzed=analyzed_count,
            total_cost_usd=total_cost,
            error=str(exc)
        )
        MINING_STATUS["status"] = "error"
        MINING_STATUS["error"] = str(exc)


PACKAGE_DIR = Path(__file__).resolve().parent


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    storage = ResultStorage(settings.db_path)
    processor = TenderProcessor(settings, storage=storage)

    app = FastAPI(title="Якість тендерної документації Prozorro")

    @app.middleware("http")
    async def ensure_user_id_cookie(request: Request, call_next):
        import uuid
        user_id = request.cookies.get("user_id")
        generated = False
        if not user_id:
            user_id = uuid.uuid4().hex
            generated = True
        request.state.user_id = user_id
        response = await call_next(request)
        if generated:
            response.set_cookie(key="user_id", value=user_id, max_age=63072000, path="/")
        return response

    templates = Jinja2Templates(directory=str(PACKAGE_DIR / "templates"))
    templates.env.filters["uah"] = format_uah
    templates.env.filters["date_ua"] = format_date
    templates.env.filters["priority_label"] = priority_label
    templates.env.filters["priority_class"] = priority_class
    templates.env.filters["tokens"] = format_tokens
    templates.env.filters["usd"] = format_usd
    templates.env.filters["category_label"] = category_label
    templates.env.filters["table_title"] = table_title

    static_dir = PACKAGE_DIR / "static"
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    def serve_dashboard(request: Request, category: str = "", max_score: str = "", sort: str = "processed_desc"):
        results = storage.list_results()
        categories = sorted({issue.category for result in results for issue in result.issues})
        filtered = results
        score_limit = parse_int(max_score)
        if category:
            filtered = [
                result
                for result in filtered
                if any(issue.category == category for issue in result.issues)
            ]
        if score_limit is not None:
            filtered = [result for result in filtered if result.overall_score <= score_limit]
        filtered = sort_results(filtered, sort)
        return templates.TemplateResponse(
            request,
            "index.html",
            {
                "request": request,
                "results": filtered,
                "aggregate": storage.aggregate(),
                "categories": categories,
                "selected_category": category,
                "max_score": score_limit if score_limit is not None else "",
                "selected_sort": sort if sort in SORT_LABELS else "processed_desc",
                "sort_labels": SORT_LABELS,
                "score_sort": next_sort(sort, "score"),
                "score_sort_marker": sort_marker(sort, "score"),
                "priority_sort": next_sort(sort, "priority"),
                "priority_sort_marker": sort_marker(sort, "priority"),
                "settings": settings,
            },
        )

    @app.get("/", response_class=HTMLResponse)
    def index(request: Request, category: str = "", max_score: str = "", sort: str = "processed_desc"):
        return serve_dashboard(request, category, max_score, sort)

    @app.post("/process/batch")
    def process_batch(
        limit: int = Form(default=5),
        max_pages: int = Form(default=12),
        use_codex: bool = Form(default=False),
    ):
        processor.process_batch(
            batch_size=max(1, min(limit, 25)),
            max_pages=max(1, min(max_pages, 50)),
            use_codex=use_codex,
        )
        return RedirectResponse("/", status_code=303)

    @app.post("/process/tender")
    def process_tender(request: Request, tender_id: str = Form(...), use_codex: bool = Form(default=False)):
        tender_id_clean = tender_id.strip()
        try:
            result = processor.process_tender(tender_id_clean, use_codex=use_codex)
            user_id = getattr(request.state, "user_id", None)
            if user_id:
                storage.add_user_request(user_id, result.summary.tender_id)
            return {"success": True, "result": result.to_dict()}
        except Exception as e:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=str(e))

    @app.get("/tenders/{tender_id}", response_class=HTMLResponse)
    def detail(request: Request, tender_id: str):
        result = storage.get(tender_id)
        if result is None:
            return HTMLResponse("Тендер не знайдено", status_code=404)
        return templates.TemplateResponse(
            request,
            "index.html",
            {
                "request": request,
                "initial_tender_id": tender_id,
                "settings": settings,
            },
        )

    @app.get("/api/heuristics")
    def api_heuristics():
        return [
            {
                "category": r.category,
                "title": r.title,
                "severity": r.severity,
                "explanation": r.explanation,
                "suggested_rewrite": r.suggested_rewrite,
                "subscores": list(r.subscores)
            }
            for r in storage.get_active_heuristics()
        ]

    @app.get("/api/results")
    def api_results(request: Request):
        user_id = getattr(request.state, "user_id", None)
        user_request_ids = storage.get_user_request_ids(user_id) if user_id else set()
        results = []
        for result in storage.list_results():
            d = result.to_dict()
            d["is_user_request"] = result.summary.tender_id in user_request_ids
            results.append(d)
        return results

    @app.get("/api/results/{tender_id}")
    def api_result(tender_id: str):
        result = storage.get(tender_id)
        if result is None:
            return {"error": "not_found"}
        return result.to_dict()

    @app.get("/heuristics", response_class=HTMLResponse)
    def serve_heuristics(request: Request, category: str = "", max_score: str = "", sort: str = "processed_desc"):
        return serve_dashboard(request, category, max_score, sort)

    # Admin Panel and APIs
    @app.get("/admin", response_class=HTMLResponse)
    def serve_admin(request: Request):
        return serve_dashboard(request)

    @app.post("/api/admin/login")
    async def api_admin_login(request: Request):
        payload = await request.json()
        username = payload.get("username")
        password = payload.get("password")
        
        correct_username = os.environ.get("ADMIN_USER", "admin")
        correct_password = os.environ.get("ADMIN_PASSWORD", "admin")
        
        is_correct_username = secrets.compare_digest(username or "", correct_username)
        is_correct_password = secrets.compare_digest(password or "", correct_password)
        
        if not (is_correct_username and is_correct_password):
            raise HTTPException(status_code=401, detail="Неправильне ім'я користувача або пароль")
            
        # Generate and return Basic token
        credentials_str = f"{username}:{password}"
        encoded_token = base64.b64encode(credentials_str.encode("utf-8")).decode("utf-8")
        return {"success": True, "token": f"Basic {encoded_token}"}

    @app.get("/api/admin/heuristics")
    def api_admin_heuristics(username: str = Depends(get_current_admin)):
        return storage.list_heuristics()

    @app.post("/api/admin/heuristics/{heuristic_id}/status")
    async def api_admin_update_status(
        heuristic_id: int,
        request: Request,
        username: str = Depends(get_current_admin)
    ):
        payload = await request.json()
        new_status = payload.get("status")
        if new_status not in ("active", "rejected", "to_review"):
            raise HTTPException(status_code=400, detail="Invalid status")
        storage.update_heuristic_status(heuristic_id, new_status)
        return {"success": True}

    @app.post("/api/admin/heuristics/mine")
    async def api_admin_mine(
        background_tasks: BackgroundTasks,
        request: Request,
        username: str = Depends(get_current_admin)
    ):
        global MINING_STATUS
        if MINING_STATUS["status"] == "running":
            raise HTTPException(status_code=400, detail="Mining is already running")
        
        limit = 5
        try:
            payload = await request.json()
            limit = int(payload.get("limit", 5))
        except Exception:
            pass
            
        run_id = storage.start_mining_run(limit)
        background_tasks.add_task(run_heuristics_mining_task, settings.db_path, limit, run_id)
        return {"success": True, "status": "running", "run_id": run_id}

    @app.get("/api/admin/heuristics/mine/status")
    def api_admin_mine_status(username: str = Depends(get_current_admin)):
        global MINING_STATUS
        return MINING_STATUS

    @app.get("/api/admin/heuristics/mine/history")
    def api_admin_mine_history(username: str = Depends(get_current_admin)):
        return storage.list_mining_history()

    @app.get("/api/admin/llm/history")
    def api_admin_llm_history(username: str = Depends(get_current_admin)):
        results = storage.list_results()
        llm_runs = []
        for r in results:
            if r.llm_usage and r.llm_usage.total_cost_usd > 0:
                llm_runs.append({
                    "tender_id": r.summary.tender_id,
                    "tender_code": r.summary.tender_code,
                    "title": r.summary.title,
                    "processed_at": r.processed_at,
                    "total_cost_usd": r.llm_usage.total_cost_usd,
                    "tokens": r.llm_usage.total_tokens
                })
        return llm_runs

    return app


def format_uah(amount: float | None, currency: str | None = "UAH") -> str:
    if amount is None:
        return "не вказано"
    return f"{amount:,.0f} {currency or ''}".replace(",", " ")


def format_date(value: str | None) -> str:
    if not value:
        return "не вказано"
    return value.replace("T", " ")[:19]


def format_tokens(value: int | None) -> str:
    if not value:
        return "0"
    return f"{int(value):,}".replace(",", " ")


def format_usd(value: float | None) -> str:
    if not value:
        return "$0.0000"
    if value < 0.0001:
        return f"${value:.6f}"
    return f"${value:.4f}"


def category_label(category: str | None) -> str:
    if not category:
        return ""
    category = category.strip()
    return f"{category[:1].upper()}{category[1:]}"


def table_title(value: str | None, limit: int = 365) -> str:
    if not value:
        return ""
    text = " ".join(value.split())
    if len(text) <= limit:
        return text
    truncated = text[:limit].rstrip()
    if " " in truncated:
        truncated = truncated.rsplit(" ", 1)[0]
    return f"{truncated}..."


SORT_LABELS = {
    "processed_desc": "Новіші спочатку",
    "score_asc": "Нижчий бал спочатку",
    "score_desc": "Вищий бал спочатку",
    "priority_desc": "Вищий пріоритет спочатку",
    "priority_asc": "Нижчий пріоритет спочатку",
}


def parse_int(value: str | int | None) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def sort_results(results: list[TenderResult], sort: str) -> list[TenderResult]:
    if sort == "score_asc":
        return sorted(results, key=lambda result: (result.overall_score, -priority_weight(result.highest_severity)))
    if sort == "score_desc":
        return sorted(results, key=lambda result: (result.overall_score, priority_weight(result.highest_severity)), reverse=True)
    if sort == "priority_desc":
        return sorted(results, key=lambda result: (priority_weight(result.highest_severity), -result.overall_score), reverse=True)
    if sort == "priority_asc":
        return sorted(results, key=lambda result: (priority_weight(result.highest_severity), result.overall_score))
    return results


def next_sort(current_sort: str, column: str) -> str:
    if column == "score":
        return "score_desc" if current_sort == "score_asc" else "score_asc"
    if column == "priority":
        return "priority_asc" if current_sort == "priority_desc" else "priority_desc"
    return "processed_desc"


def sort_marker(current_sort: str, column: str) -> str:
    if column == "score":
        if current_sort == "score_asc":
            return "↑"
        if current_sort == "score_desc":
            return "↓"
    if column == "priority":
        if current_sort == "priority_asc":
            return "↑"
        if current_sort == "priority_desc":
            return "↓"
    return "↕"
