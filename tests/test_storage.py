from prozorro_quality.models import Issue, LlmUsage, TenderResult, TenderSummary
from prozorro_quality.storage import ResultStorage


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


def test_storage_roundtrip(tmp_path):
    storage = ResultStorage(tmp_path / "db.sqlite3")
    result = sample_result()

    storage.save(result)
    loaded = storage.get("abc")

    assert loaded is not None
    assert loaded.summary.tender_code == "UA-TEST"
    assert loaded.highest_severity == "висока"
    assert storage.has_tender("abc")
    assert storage.aggregate()["total"] == 1


def test_storage_preserves_llm_usage_when_reprocessed_without_llm(tmp_path):
    storage = ResultStorage(tmp_path / "db.sqlite3")
    result = sample_result()
    result.llm_usage = LlmUsage(
        model="gpt-5.5",
        total_tokens=1200,
        input_tokens=900,
        output_tokens=300,
        total_cost_usd=0.012,
        input_cost_usd=0.006,
        output_cost_usd=0.006,
    )
    storage.save(result)

    reprocessed = sample_result()
    reprocessed.overall_score = 91
    storage.save(reprocessed)

    loaded = storage.get("abc")
    assert loaded is not None
    assert loaded.overall_score == 91
    assert loaded.llm_usage.total_tokens == 1200
    assert loaded.llm_usage.total_cost_usd == 0.012
    assert loaded.llm_usage.model == "gpt-5.5"


def test_storage_accumulates_llm_usage_on_repeated_llm_runs(tmp_path):
    storage = ResultStorage(tmp_path / "db.sqlite3")
    first = sample_result()
    first.llm_usage = LlmUsage(
        model="gpt-5.5",
        total_tokens=100,
        input_tokens=70,
        output_tokens=30,
        total_cost_usd=0.01,
        input_cost_usd=0.004,
        output_cost_usd=0.006,
    )
    storage.save(first)

    second = sample_result()
    second.llm_usage = LlmUsage(
        model="gpt-5.5",
        total_tokens=50,
        input_tokens=40,
        output_tokens=10,
        total_cost_usd=0.02,
        input_cost_usd=0.012,
        output_cost_usd=0.008,
    )
    storage.save(second)

    loaded = storage.get("abc")
    assert loaded is not None
    assert loaded.llm_usage.total_tokens == 150
    assert loaded.llm_usage.input_tokens == 110
    assert loaded.llm_usage.output_tokens == 40
    assert loaded.llm_usage.total_cost_usd == 0.03
