import type { ReactNode } from "react";
import { priorityMeta, sortLabels } from "../constants";
import type { Severity, SortKey, StateSetter } from "../types";

interface SearchDockProps {
  categories: string[];
  category: string;
  clearFilters: () => void;
  maxScore: string;
  query: string;
  sector: string;
  sectors: string[];
  setCategory: StateSetter<string>;
  setMaxScore: StateSetter<string>;
  setQuery: StateSetter<string>;
  setSector: StateSetter<string>;
  setSeverity: StateSetter<string>;
  setSort: StateSetter<SortKey>;
  severity: string;
  sort: SortKey;
}

interface SelectFieldProps<T extends string> {
  emptyLabel: string;
  formatOption?: (value: T) => string;
  label: string;
  onChange: StateSetter<T>;
  options: T[];
  value: T;
}

export function SearchDock(props: SearchDockProps): ReactNode {
  const {
    categories,
    category,
    clearFilters,
    maxScore,
    query,
    sector,
    sectors,
    setCategory,
    setMaxScore,
    setQuery,
    setSector,
    setSeverity,
    setSort,
    severity,
    sort,
  } = props;

  const activeFilterCount = [query, category, sector, severity, maxScore].filter(Boolean).length;

  return (
    <section className="search-dock" aria-label="Пошук і фільтри">
      <label className="searchbox">
        <span>Пошук</span>
        <input
          type="search"
          placeholder="Назва товару, код ДК, ЄДРПОУ компанії, UA-номер або фраза..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="filter-grid">
        <SelectField
          label="Категорія"
          value={category}
          onChange={setCategory}
          options={categories}
          emptyLabel="Усі категорії"
        />
        <SelectField
          label="Сектор"
          value={sector}
          onChange={setSector}
          options={sectors}
          emptyLabel="Усі сектори"
        />
        <SelectField
          label="Пріоритет"
          value={severity}
          onChange={setSeverity}
          options={["висока", "середня", "низька", "немає"]}
          emptyLabel="Усі пріоритети"
          formatOption={(value) => priorityMeta[value as Severity].label}
        />
        <label>
          Максимальний бал
          <input
            type="number"
            min="0"
            max="100"
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
            placeholder="100"
          />
        </label>
        <label>
          Сортування
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
          >
            {(Object.keys(sortLabels) as SortKey[]).map((option) => (
              <option key={option} value={option}>
                {sortLabels[option]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chip-row" aria-label="Активні фільтри">
        <span className="filter-chip">{`${activeFilterCount} фільтрів`}</span>
        {category && <span className="filter-chip is-blue">{category}</span>}
        {sector && <span className="filter-chip is-green">{sector}</span>}
        {severity && (
          <span className="filter-chip is-red">
            {priorityMeta[severity as Severity].label}
          </span>
        )}
        {maxScore && <span className="filter-chip is-amber">{`бал <= ${maxScore}`}</span>}
        <button className="ghost-button" onClick={clearFilters} type="button">
          Скинути
        </button>
      </div>
    </section>
  );
}

function SelectField<T extends string>({
  emptyLabel,
  formatOption,
  label,
  onChange,
  options,
  value,
}: SelectFieldProps<T>): ReactNode {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {emptyLabel !== "" && <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption ? formatOption(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}
