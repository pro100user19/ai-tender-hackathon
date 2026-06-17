import { useState } from "react";
import type { ReactNode } from "react";

interface ActionPanelProps {
  defaultPages: string;
  showBatchForm?: boolean;
  showSingleForm?: boolean;
  isProcessing?: boolean;
  singleError?: string | null;
  onProcessTender?: (tenderIds: string[], useCodex: boolean) => void;
}

export function ActionPanel({
  defaultPages,
  showBatchForm = true,
  showSingleForm = true,
  isProcessing = false,
  singleError = null,
  onProcessTender,
}: ActionPanelProps): ReactNode {
  const [tenderIds, setTenderIds] = useState<string[]>([""]);
  const [useCodex, setUseCodex] = useState(false);

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
            <h2>Обробка партії</h2>
            <span>новити тендери</span>
          </div>
          <div style={{ marginBottom: "6px" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              Кількість
              <input type="number" name="limit" min="1" max="25" defaultValue="5" />
            </label>
          </div>
          <label className="toggle">
            <input type="checkbox" name="use_codex" value="true" />
            <span>LLM пояснення</span>
          </label>
          <button type="submit">Обробити</button>
        </form>
      )}
      {showSingleForm && (
        <form className="action-panel" onSubmit={handleSubmitSingle}>
          <div className="panel-title">
            <h2>Тендери за UUID</h2>
            <span>один або кілька</span>
          </div>
          {singleError && <div className="panel-error" style={{ whiteSpace: "pre-line" }}>{singleError}</div>}
          
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)" }}>
              Prozorro UUID
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
                    title="Видалити"
                  >
                    ✕
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
              + Додати ще один UUID
            </button>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={useCodex}
              onChange={(e) => setUseCodex(e.target.checked)}
              disabled={isProcessing}
            />
            <span>LLM пояснення</span>
          </label>
          <button type="submit" disabled={isProcessing}>
            {isProcessing ? "Опрацювання..." : "Перевірити"}
          </button>
        </form>
      )}
    </section>
  );
}
