import { useState } from "react";
import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { useTranslation } from "../LanguageContext";

interface ActionPanelProps {
  defaultPages: string;
  showBatchForm?: boolean;
  showSingleForm?: boolean;
  isProcessing?: boolean;
  singleError?: string | null;
  onProcessTender?: (tenderIds: string[], useCodex: boolean) => void;
  onProcessCustom?: (formData: FormData) => void;
}

const SECTORS = [
  "інші галузі",
  "Сільське господарство та продукти",
  "Нафтопродукти, паливо, електроенергія",
  "Харчові продукти",
  "Одяг та взуття",
  "Друкована продукція",
  "Хімічна продукція",
  "Офісна та комп'ютерна техніка",
  "Електричні машини",
  "Радіо-, теле-, комунікаційне обладнання",
  "Медичне обладнання та фармацевтика",
  "Транспортне обладнання",
  "Охоронне та пожежне обладнання",
  "Музичні інструменти, спорттовари та ігри",
  "Меблі та побутова продукція",
  "Промислова техніка",
  "Будівельні матеріали",
  "Будівельні роботи",
  "Програмне забезпечення",
  "Ремонт і технічне обслуговування",
  "Послуги зі встановлення",
  "Готельні та ресторанні послуги",
  "Транспортні послуги",
  "Допоміжні транспортні послуги",
  "Поштові та телекомунікаційні послуги",
  "Комунальні послуги",
  "Фінансові та страхові послуги",
  "Нерухомість",
  "Архітектурні та інженерні послуги",
  "ІТ-послуги",
  "Дослідження та розробки",
  "Адміністративні послуги",
  "Сільськогосподарські та лісові послуги",
  "Ділові послуги",
  "Освітні послуги",
  "Охорона здоров'я та соціальні послуги",
  "Екологічні послуги",
  "Культурні та спортивні послуги",
  "Інші послуги",
];

export function ActionPanel({
  defaultPages,
  showBatchForm = true,
  showSingleForm = true,
  isProcessing = false,
  singleError = null,
  onProcessTender,
  onProcessCustom,
}: ActionPanelProps): ReactNode {
  const { t, lang } = useTranslation();
  const [tenderIds, setTenderIds] = useState<string[]>([""]);
  const [useCodex, setUseCodex] = useState(false);

  // Custom draft states
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customBudget, setCustomBudget] = useState("");
  const [customCpv, setCustomCpv] = useState("");
  const [customSector, setCustomSector] = useState("інші галузі");
  const [customFiles, setCustomFiles] = useState<FileList | null>(null);
  const [customUseCodex, setCustomUseCodex] = useState(false);

  const handleSubmitCustom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onProcessCustom) {
      const formData = new FormData();
      formData.append("title", customTitle.trim());
      formData.append("description", customDesc.trim());
      if (customBudget.trim()) {
        formData.append("value_amount", customBudget.trim());
      }
      formData.append("sector", customSector);
      formData.append("cpv", customCpv.trim());
      if (customUseCodex) {
        formData.append("use_codex", "true");
      }
      if (customFiles) {
        for (let i = 0; i < customFiles.length; i++) {
          const file = customFiles[i];
          if (file) {
            formData.append("files", file);
          }
        }
      }
      onProcessCustom(formData);
      // Reset form fields
      setCustomTitle("");
      setCustomDesc("");
      setCustomBudget("");
      setCustomCpv("");
      setCustomSector("інші галузі");
      setCustomFiles(null);
      // Reset input element value to clear file selection
      const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    }
  };

  const handleSubmitSingle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("handleSubmitSingle: Form submitted", { hasCallback: !!onProcessTender });
    if (onProcessTender) {
      const cleaned = tenderIds.map((id) => id.trim()).filter(Boolean);
      console.log("handleSubmitSingle: Inputs read", { cleaned, useCodex });
      if (cleaned.length > 0) {
        onProcessTender(cleaned, useCodex);
      }
    }
  };

  return (
    <section className="action-stack" aria-label="Обробка тендерів">
      {showBatchForm && (
        <form className="action-panel" method="post" action="/process/batch">
          <div className="panel-title">
            <h2>{t("batchTitle")}</h2>
            <span>{t("batchSubtitle")}</span>
          </div>
          <div style={{ marginBottom: "6px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {t("limit")}
              <input type="number" name="limit" min="1" max="25" defaultValue="5" />
            </label>
          </div>
          <label className="toggle">
            <input type="checkbox" name="use_codex" value="true" />
            <span>{t("llmExpl")}</span>
          </label>
          <button type="submit">{t("processBtn")}</button>
        </form>
      )}
      {showSingleForm && (
        <form className="action-panel" onSubmit={handleSubmitSingle}>
          <div className="panel-title">
            <h2>{t("uuidTitle")}</h2>
            <span>{t("uuidSubtitle")}</span>
          </div>
          {singleError && <div className="panel-error" style={{ whiteSpace: "pre-line" }}>{singleError}</div>}
          
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>
              {t("uuidInputLabel")}
            </span>
            
            {tenderIds.map((id, index) => (
              <div key={index} className="uuid-input-row">
                <input
                  type="text"
                  placeholder="73e491ce38214a5da0589d0564408609"
                  value={id}
                  onChange={(e) => {
                    const newIds = [...tenderIds];
                    newIds[index] = e.target.value;
                    setTenderIds(newIds);
                  }}
                  disabled={isProcessing}
                  required
                />
                {tenderIds.length > 1 && (
                  <button
                    type="button"
                    className="remove-uuid-btn"
                    onClick={() => {
                      setTenderIds(tenderIds.filter((_, i) => i !== index));
                    }}
                    disabled={isProcessing}
                    title={lang === "en" ? "Remove" : "Видалити"}
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                )}
              </div>
            ))}
            
            <button
              type="button"
              className="add-uuid-btn"
              onClick={() => setTenderIds([...tenderIds, ""])}
              disabled={isProcessing}
            >
              <Plus aria-hidden="true" size={16} />
              {t("addMoreUuid")}
            </button>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={useCodex}
              onChange={(e) => setUseCodex(e.target.checked)}
              disabled={isProcessing}
            />
            <span>{t("llmExpl")}</span>
          </label>
          <button type="submit" disabled={isProcessing}>
            {isProcessing ? t("processing") : t("checkBtn")}
          </button>
        </form>
      )}
      {onProcessCustom && (
        <form className="action-panel" onSubmit={handleSubmitCustom}>
          <div className="panel-title">
            <h2>{t("draftTitle")}</h2>
            <span>{t("draftSubtitle")}</span>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label>
              {t("customTitleLabel")}
              <input
                type="text"
                placeholder={t("customTitlePlaceholder")}
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                disabled={isProcessing}
                required
              />
            </label>

            <label>
              {t("customDescLabel")}
              <textarea
                placeholder={t("customDescPlaceholder")}
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                disabled={isProcessing}
                style={{ minHeight: "80px" }}
              />
            </label>

            <label>
              {t("customCpvLabel")}
              <input
                type="text"
                placeholder={t("customCpvPlaceholder")}
                value={customCpv}
                onChange={(e) => setCustomCpv(e.target.value)}
                disabled={isProcessing}
              />
            </label>

            <div className="mini-grid">
              <label>
                {t("customBudgetLabel")}
                <input
                  type="number"
                  placeholder="100000"
                  value={customBudget}
                  onChange={(e) => setCustomBudget(e.target.value)}
                  disabled={isProcessing}
                  min="0"
                  step="0.01"
                />
              </label>

              <label>
                {t("customSectorLabel")}
                <select
                  value={customSector}
                  onChange={(e) => setCustomSector(e.target.value)}
                  disabled={isProcessing}
                >
                  {SECTORS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              {t("customFilesLabel")}
              <input
                type="file"
                multiple
                onChange={(e) => setCustomFiles(e.target.files)}
                disabled={isProcessing}
                style={{ padding: "6px 10px", height: "auto" }}
              />
            </label>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={customUseCodex}
              onChange={(e) => setCustomUseCodex(e.target.checked)}
              disabled={isProcessing}
            />
            <span>{t("llmExpl")}</span>
          </label>

          <button type="submit" disabled={isProcessing}>
            {isProcessing ? t("processing") : t("checkDraftBtn")}
          </button>
        </form>
      )}
    </section>
  );
}
