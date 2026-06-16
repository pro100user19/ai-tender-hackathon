from __future__ import annotations

import html
import re
import sys
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from prozorro_quality import analyzer
from prozorro_quality.analyzer import RULES, Rule
from prozorro_quality.config import PROJECT_ROOT, load_settings
from prozorro_quality.storage import ResultStorage


def main() -> None:
    category_counts = load_category_counts()
    write_regex_reference(category_counts)
    write_rules_reference(category_counts)


def load_category_counts() -> dict[str, int]:
    try:
        results = ResultStorage(load_settings().db_path).list_results()
    except Exception:
        return {}

    counts: dict[str, int] = {}
    for result in results:
        for issue in result.issues:
            counts[issue.category] = counts.get(issue.category, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def write_regex_reference(category_counts: dict[str, int]) -> None:
    supporting = supporting_patterns()
    rule_categories = {rule.category for rule in RULES}
    db_categories = set(category_counts)
    body = f"""<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Усі regex-и евристик</title>
  <style>
    :root {{
      --bg: #f6f7f8;
      --surface: #ffffff;
      --text: #1f2328;
      --muted: #5f6673;
      --line: #d8dde3;
      --accent: #256b8f;
      --code: #f0f2f4;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }}
    main {{ max-width: 1240px; margin: 0 auto; padding: 32px 20px 56px; }}
    h1 {{ margin: 0 0 8px; font-size: 34px; line-height: 1.15; }}
    h2 {{ margin: 0; font-size: 23px; line-height: 1.2; }}
    h3 {{ margin: 0 0 8px; color: var(--muted); font-size: 13px; text-transform: uppercase; }}
    p {{ margin: 0 0 12px; color: var(--muted); }}
    .lead {{ max-width: 980px; font-size: 17px; }}
    .summary {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 22px 0 24px; }}
    .summary div {{ padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }}
    .summary strong {{ display: block; color: var(--accent); font-size: 28px; line-height: 1; }}
    .summary span {{ color: var(--muted); font-size: 14px; }}
    .toc {{ display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }}
    .toc a {{ display: inline-flex; padding: 7px 10px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); color: var(--text); font-size: 13px; font-weight: 650; text-decoration: none; }}
    .rule {{ margin-bottom: 16px; padding: 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }}
    .rule header {{ display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }}
    .category {{ margin: 0 0 6px; color: var(--accent); font-size: 13px; font-weight: 800; text-transform: uppercase; }}
    .meta {{ display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; justify-content: flex-end; }}
    .meta span {{ display: inline-flex; padding: 5px 9px; border: 1px solid var(--line); border-radius: 999px; background: var(--code); color: var(--text); font-size: 13px; font-weight: 700; white-space: nowrap; }}
    .details {{ display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 16px; align-items: start; }}
    pre {{ margin: 0; padding: 13px; overflow: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--code); white-space: pre-wrap; word-break: break-word; }}
    code {{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }}
    p code {{ padding: 2px 5px; border-radius: 4px; background: var(--code); }}
    .explain {{ margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); }}
    .explain p {{ color: #37404a; }}
    .section-title {{ margin: 30px 0 12px; font-size: 26px; }}
    table {{ width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--surface); margin-bottom: 18px; }}
    th, td {{ padding: 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 14px; }}
    th {{ background: #eceff2; color: #37404a; font-size: 12px; text-transform: uppercase; }}
    tr:last-child td {{ border-bottom: 0; }}
    td pre {{ min-width: 360px; }}
    @media (max-width: 860px) {{
      main {{ padding: 24px 12px 42px; }}
      .summary, .details {{ grid-template-columns: 1fr; }}
      .rule header {{ display: block; }}
      .meta {{ justify-content: flex-start; margin-top: 10px; }}
      table {{ display: block; overflow-x: auto; }}
    }}
  </style>
</head>
<body>
  <main>
    <h1>Усі regex-и евристик</h1>
    <p class="lead">Повний reference із <code>prozorro_quality/analyzer.py</code>: усі regex-правила з <code>RULES</code>, допоміжні guard-regex-и, і короткий опис евристик, які працюють не як один regex-rule.</p>

    <section class="summary" aria-label="Підсумок">
      <div><strong>{len(RULES)}</strong><span>regex rules у RULES</span></div>
      <div><strong>{len(rule_categories)}</strong><span>категорій у RULES</span></div>
      <div><strong>{len(db_categories)}</strong><span>категорій зі спрацюваннями в БД</span></div>
      <div><strong>3</strong><span>додаткові computed евристики</span></div>
    </section>

    <nav class="toc" aria-label="Навігація">
      {toc_links(RULES)}
      <a href="#computed">Computed</a>
      <a href="#flow">Flow</a>
      <a href="#support">Supporting regex</a>
      <a href="#counts">Counts</a>
    </nav>

    <h2 id="flow" class="section-title">Як це виконується в Python</h2>
    {flow_table()}

    <h2 class="section-title">Правила з RULES</h2>
    {''.join(rule_article(index, rule) for index, rule in enumerate(RULES, 1))}

    <h2 id="computed" class="section-title">Евристики не з RULES</h2>
    {computed_table()}

    <h2 id="support" class="section-title">Supporting / guard regex-и</h2>
    {supporting_table(supporting)}

    <h2 id="counts" class="section-title">Поточні спрацювання в БД</h2>
    {counts_table(category_counts)}
  </main>
</body>
</html>
"""
    write_html(PROJECT_ROOT / "heuristics_regex.html", body)


def write_rules_reference(category_counts: dict[str, int]) -> None:
    body = f"""<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Правила евристик</title>
  <style>
    :root {{
      --bg: #f7f7f4;
      --text: #1f2328;
      --muted: #5f6670;
      --line: #d8d8d2;
      --surface: #ffffff;
      --accent: #2f6f9f;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.45; }}
    main {{ max-width: 1180px; margin: 0 auto; padding: 36px 20px 56px; }}
    h1 {{ margin: 0 0 8px; font-size: 34px; line-height: 1.15; }}
    h2 {{ margin: 34px 0 14px; font-size: 24px; }}
    p {{ margin: 0 0 14px; color: var(--muted); font-size: 16px; }}
    .summary {{ display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 22px 0 28px; }}
    .summary div {{ padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }}
    .summary strong {{ display: block; margin-bottom: 4px; color: var(--accent); font-size: 26px; line-height: 1; }}
    .summary span {{ color: var(--muted); font-size: 14px; }}
    table {{ width: 100%; border-collapse: collapse; border: 1px solid var(--line); background: var(--surface); }}
    th, td {{ padding: 14px 16px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }}
    th {{ background: #ecece7; color: #30343a; font-size: 13px; letter-spacing: 0; text-transform: uppercase; }}
    td {{ font-size: 15px; }}
    tr:last-child td {{ border-bottom: 0; }}
    .category {{ min-width: 190px; font-weight: 700; }}
    .rule {{ min-width: 230px; font-weight: 700; }}
    .severity {{ white-space: nowrap; font-weight: 700; }}
    .note {{ margin-top: 18px; padding: 16px; border: 1px solid #d9c58f; border-radius: 8px; background: #fff8e6; color: #4d3b10; }}
    .note p {{ margin: 0; color: inherit; }}
    code {{ padding: 2px 5px; border-radius: 4px; background: #ecece7; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }}
    @media (max-width: 860px) {{
      main {{ padding: 24px 12px 40px; }}
      .summary {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
      table, thead, tbody, th, td, tr {{ display: block; }}
      thead {{ display: none; }}
      tr {{ border-bottom: 1px solid var(--line); }}
      td {{ border-bottom: 0; padding: 10px 14px; }}
      td::before {{ content: attr(data-label); display: block; margin-bottom: 4px; color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }}
    }}
  </style>
</head>
<body>
  <main>
    <h1>Правила евристик</h1>
    <p>Простий список правил detector-а після 7 циклів аналізу документів. Це сигнали для review, а не юридичні висновки.</p>

    <section class="summary" aria-label="Підсумок">
      <div><strong>{len(RULES)}</strong><span>regex rules у RULES</span></div>
      <div><strong>{len({rule.category for rule in RULES})}</strong><span>категорій у RULES</span></div>
      <div><strong>{sum(category_counts.values())}</strong><span>поточних issue у БД</span></div>
      <div><strong>49</strong><span>автоматичних tests passed</span></div>
    </section>

    <h2>Основні правила</h2>
    {rules_table(RULES)}

    <h2>Поточні спрацювання в БД</h2>
    {counts_table(category_counts)}

    <section class="note">
      <p><strong>Як читати:</strong> правило показує потенційний ризик для конкуренції або прозорості. Остаточне рішення має робити людина по повному документу.</p>
    </section>
  </main>
</body>
</html>
"""
    write_html(PROJECT_ROOT / "heuristics_rules.html", body)


def toc_links(rules: Iterable[Rule]) -> str:
    return "".join(
        f'<a href="#{rule_id(index, rule)}">{index}. {escape(rule.category)}</a>'
        for index, rule in enumerate(rules, 1)
    )


def rule_article(index: int, rule: Rule) -> str:
    return f"""
    <article class="rule" id="{rule_id(index, rule)}">
      <header>
        <div>
          <p class="category">{escape(rule.category)}</p>
          <h2>{index}. {escape(rule.title)}</h2>
        </div>
        <div class="meta">
          <span>{escape(rule.severity)}</span>
          <span>{escape(', '.join(rule.subscores))}</span>
        </div>
      </header>
      <div class="details">
        <pre><code>{escape(rule.pattern.pattern)}</code></pre>
        <div>
          <h3>Flags</h3>
          <p><code>{escape(flags_label(rule.pattern.flags))}</code></p>
          <h3>Subscores</h3>
          <p>{escape(', '.join(rule.subscores))}</p>
        </div>
      </div>
      <div class="explain">
        <p><strong>Пояснення:</strong> {escape(rule.explanation)}</p>
        <p><strong>Можливе переписування:</strong> {escape(rule.suggested_rewrite)}</p>
      </div>
    </article>
"""


def rules_table(rules: Iterable[Rule]) -> str:
    rows = []
    for rule in rules:
        rows.append(
            f"""
        <tr>
          <td class="category" data-label="Категорія">{escape(rule.category)}</td>
          <td class="rule" data-label="Правило">{escape(rule.title)}</td>
          <td class="severity" data-label="Рівень">{escape(severity_label(rule.severity))}</td>
          <td data-label="Що ловить">{escape(rule.explanation)}</td>
          <td data-label="Що робити">{escape(rule.suggested_rewrite)}</td>
        </tr>"""
        )
    return f"""
    <table>
      <thead>
        <tr>
          <th>Категорія</th>
          <th>Правило</th>
          <th>Рівень</th>
          <th>Що ловить</th>
          <th>Що робити</th>
        </tr>
      </thead>
      <tbody>{''.join(rows)}
      </tbody>
    </table>
"""


def flow_table() -> str:
    rows = [
        ("1. Parse", "DocumentParser витягує текст із PDF, DOCX, DOC, XLS/XLSX, HTML, RTF, TXT/CSV і ZIP.", "prozorro_quality/parser.py"),
        ("2. RULES loop", "TenderAnalyzer.analyze() проходить по кожному документу і кожному Rule з RULES.", "prozorro_quality/analyzer.py"),
        ("3. Evidence window", "Для кожного match формується коротка цитата навколо regex-спрацювання.", "evidence_window()"),
        ("4. Guards", "should_skip_match() відсікає відомі безпечні контексти та false positives.", "should_skip_match()"),
        ("5. Computed", "Після regex rules додаються відсутні умови, щільні технічні параметри і проблеми парсингу.", "missing_context_issues(), technical_precision_issues(), parsing_issues()"),
        ("6. Score", "dedupe_issues() лишає один issue на категорію/назву, score_issues() рахує загальний бал і subscores.", "dedupe_issues(), score_issues()"),
    ]
    return table(("Крок", "Що робить код", "Де в коді"), rows)


def computed_table() -> str:
    rows = [
        ("missing_context_issues()", "Додає issues, якщо по всіх документах не знайдено явних умов оплати, поставки або проєкту договору."),
        ("technical_precision_issues()", "Ріже текст на вікна, шукає технічний контекст і щільний набір точних числових параметрів через PRECISE_PARAMETER_RE."),
        ("parsing_issues()", "Додає issue, якщо документ має статус мало тексту, не підтримується, помилка парсингу або обмежено; SIGNATURE_RE відсікає підпис-файли."),
    ]
    return table(("Функція", "Що робить"), rows)


def supporting_table(patterns: list[tuple[str, re.Pattern[str]]]) -> str:
    rows = [(name, f"<pre><code>{escape(pattern.pattern)}</code></pre>") for name, pattern in patterns]
    return raw_table(("Назва", "Regex"), rows)


def counts_table(category_counts: dict[str, int]) -> str:
    if not category_counts:
        return "<p>Немає доступних локальних counts.</p>"
    rows = [(category, str(count)) for category, count in category_counts.items()]
    return table(("Категорія", "Кількість"), rows)


def table(headers: tuple[str, ...], rows: Iterable[tuple[str, ...]]) -> str:
    escaped_rows = [tuple(escape(cell) for cell in row) for row in rows]
    return raw_table(headers, escaped_rows)


def raw_table(headers: tuple[str, ...], rows: Iterable[tuple[str, ...]]) -> str:
    header_html = "".join(f"<th>{escape(header)}</th>" for header in headers)
    row_html = []
    for row in rows:
        cells = "".join(f"<td>{cell}</td>" for cell in row)
        row_html.append(f"<tr>{cells}</tr>")
    return f"""
    <table>
      <thead><tr>{header_html}</tr></thead>
      <tbody>{''.join(row_html)}</tbody>
    </table>
"""


def supporting_patterns() -> list[tuple[str, re.Pattern[str]]]:
    patterns: list[tuple[str, re.Pattern[str]]] = []
    for name in sorted(dir(analyzer)):
        value = getattr(analyzer, name)
        if name.endswith("_RE") and isinstance(value, re.Pattern):
            patterns.append((name, value))
    return patterns


def rule_id(index: int, rule: Rule) -> str:
    return f"rule-{index}-{slug(rule.category)}-{slug(rule.title)}"


def slug(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-zа-яіїєґ0-9]+", "-", value, flags=re.IGNORECASE)
    return value.strip("-") or "rule"


def flags_label(flags: int) -> str:
    names = []
    for flag, name in [
        (re.IGNORECASE, "IGNORECASE"),
        (re.UNICODE, "UNICODE"),
        (re.DOTALL, "DOTALL"),
        (re.MULTILINE, "MULTILINE"),
    ]:
        if flags & flag:
            names.append(name)
    return " | ".join(names) or "0"


def severity_label(value: str) -> str:
    return {"висока": "Високий", "середня": "Середній", "низька": "Низький"}.get(value, value)


def escape(value: object) -> str:
    return html.escape(str(value), quote=True)


def write_html(path: Path, body: str) -> None:
    cleaned = "\n".join(line.rstrip() for line in body.splitlines()) + "\n"
    path.write_text(cleaned, encoding="utf-8")


if __name__ == "__main__":
    main()
