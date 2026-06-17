from types import SimpleNamespace

from fastapi.testclient import TestClient

from prozorro_quality.config import Settings
from prozorro_quality.models import Issue, TenderResult, TenderSummary
from prozorro_quality.storage import ResultStorage
from prozorro_quality.models import priority_label
from prozorro_quality.web import (
    create_app,
    category_label,
    format_tokens,
    format_usd,
    next_sort,
    parse_int,
    sort_marker,
    sort_results,
    table_title,
)


def sample_result() -> TenderResult:
    return TenderResult(
        summary=TenderSummary(
            tender_id="abc",
            tender_code="UA-TEST",
            title="Тестовий тендер",
            buyer_name="Замовник",
            value_amount=1_500_000,
            currency="UAH",
            cpv="30200000-1",
            sector="Офісна та комп'ютерна техніка",
            procurement_method_type="aboveThreshold",
            date_modified="2026-06-09T00:00:00+03:00",
        ),
        processed_at="2026-06-09T01:00:00+00:00",
        overall_score=82,
        subscores={
            "повнота": 90,
            "зрозумілість": 90,
            "конкурентність": 80,
            "технічна нейтральність": 70,
            "якість проєкту договору": 90,
        },
        issues=[
            Issue(
                category="бренд/модель",
                title="Можлива прив'язка",
                severity="висока",
                evidence_quote="Lenovo",
                explanation="Потенційний ризик.",
                suggested_rewrite="Додайте або еквівалент.",
            )
        ],
    )


def result(code: str, score: int, priority: str):
    return SimpleNamespace(
        summary=SimpleNamespace(tender_code=code),
        overall_score=score,
        highest_severity=priority,
    )


def codes(results):
    return [item.summary.tender_code for item in results]


def test_priority_labels_use_masculine_forms_for_dashboard_priority():
    assert priority_label("висока") == "високий"
    assert priority_label("середня") == "середній"
    assert priority_label("низька") == "низький"
    assert priority_label("немає") == "без сигналів"


def test_dashboard_and_detail_routes_render_templates(tmp_path):
    settings = Settings(data_dir=tmp_path)
    storage = ResultStorage(settings.db_path)
    storage.save(sample_result())
    client = TestClient(create_app(settings))

    dashboard = client.get("/")
    detail = client.get("/tenders/abc")

    assert dashboard.status_code == 200
    assert 'id="dashboard-root"' in dashboard.text
    assert "dashboard/dashboard.js" in dashboard.text
    assert detail.status_code == 200
    assert 'data-initial-tender-id="abc"' in detail.text


def test_sort_results_by_score_and_priority():
    results = [
        result("A", 95, "немає"),
        result("B", 80, "середня"),
        result("C", 90, "висока"),
        result("D", 70, "низька"),
    ]

    assert codes(sort_results(results, "score_asc")) == ["D", "B", "C", "A"]
    assert codes(sort_results(results, "score_desc")) == ["A", "C", "B", "D"]
    assert codes(sort_results(results, "priority_desc")) == ["C", "B", "D", "A"]
    assert codes(sort_results(results, "priority_asc")) == ["A", "D", "B", "C"]


def test_parse_int_tolerates_empty_filter_value():
    assert parse_int("") is None
    assert parse_int(None) is None
    assert parse_int("90") == 90


def test_table_header_sort_toggles_and_markers():
    assert next_sort("processed_desc", "score") == "score_asc"
    assert next_sort("score_asc", "score") == "score_desc"
    assert next_sort("priority_desc", "priority") == "priority_asc"
    assert sort_marker("processed_desc", "score") == "↕"
    assert sort_marker("score_asc", "score") == "↑"
    assert sort_marker("priority_desc", "priority") == "↓"


def test_cost_formatters():
    assert format_tokens(12345) == "12 345"
    assert format_usd(0) == "$0.0000"
    assert format_usd(0.012345) == "$0.0123"


def test_category_label_capitalizes_detail_issue_groups():
    assert category_label("складність документів") == "Складність документів"
    assert category_label("документальні вимоги") == "Документальні вимоги"
    assert category_label("географічне обмеження") == "Географічне обмеження"
    assert category_label("лист виробника") == "Лист виробника"


def test_table_title_keeps_normal_titles_and_truncates_extreme_ones():
    normal = (
        "код ДК 021:2015 - 33190000-8 - Медичне обладнання та вироби медичного "
        "призначення різні (Автоматичний ендоскопічний репроцесор; Шафа для "
        "сушіння та зберігання ендоскопів)"
    )
    long_title = " ".join(["Реагенти для лабораторії"] * 40)

    assert table_title(normal) == normal
    assert len(table_title(long_title)) <= 365
    assert table_title(long_title).endswith("...")
