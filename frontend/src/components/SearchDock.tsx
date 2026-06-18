import type { ReactNode } from "react";
import { priorityMeta } from "../constants";
import type { Severity, SortKey, StateSetter } from "../types";
import { useTranslation, translations } from "../LanguageContext";
import { CustomSelect } from "./CustomSelect";

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

  const { t, lang } = useTranslation();

  const activeFilterCount = [query, category, sector, severity, maxScore].filter(Boolean).length;

  return (
    <section className="search-dock" aria-label={t("search")}>
      <label className="searchbox">
        <span>{t("search")}</span>
        <input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="filter-grid">
        <SelectField
          label={t("category")}
          value={category}
          onChange={setCategory}
          options={categories}
          emptyLabel={t("allCategories")}
        />
        <SelectField
          label={t("sector")}
          value={sector}
          onChange={setSector}
          options={sectors}
          emptyLabel={t("allSectors")}
        />
        <SelectField
          label={t("priority")}
          value={severity}
          onChange={setSeverity}
          options={["висока", "середня", "низька", "немає"]}
          emptyLabel={t("allPriorities")}
          formatOption={(value) => {
            const key = value === "висока" ? "sev_high" : value === "середня" ? "sev_medium" : value === "низька" ? "sev_low" : "sev_none";
            return t(key);
          }}
        />
        <label>
          {t("maxScore")}
          <input
            type="number"
            min="0"
            max="100"
            value={maxScore}
            onChange={(event) => setMaxScore(event.target.value)}
            placeholder="100"
          />
        </label>
        <CustomSelect
          label={t("sorting")}
          value={sort}
          onChange={setSort}
          options={(Object.keys(translations[lang]) as Array<keyof typeof translations.uk>)
            .filter((key) => key.startsWith("sort_"))
            .map((optionKey) => {
              const sortKey = optionKey.slice("sort_".length) as SortKey;
              return {
                label: t(optionKey),
                value: sortKey,
              };
            })}
        />
      </div>
      <div className="chip-row" aria-label={t("activeFilters")}>
        <span className="filter-chip">{`${activeFilterCount} ${t("filtersCount")}`}</span>
        {category && <span className="filter-chip is-blue">{category}</span>}
        {sector && <span className="filter-chip is-green">{sector}</span>}
        {severity && (
          <span className="filter-chip is-red">
            {t(severity === "висока" ? "sev_high" : severity === "середня" ? "sev_medium" : severity === "низька" ? "sev_low" : "sev_none")}
          </span>
        )}
        {maxScore && <span className="filter-chip is-amber">{`${t("scoreLimit")} <= ${maxScore}`}</span>}
        <button className="ghost-button" onClick={clearFilters} type="button">
          {t("reset")}
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
    <CustomSelect
      label={label}
      value={value}
      onChange={onChange}
      options={[
        ...(emptyLabel !== "" ? [{ label: emptyLabel, value: "" as T }] : []),
        ...options.map((option) => ({
          label: formatOption ? formatOption(option) : option,
          value: option,
        })),
      ]}
    />
  );
}
