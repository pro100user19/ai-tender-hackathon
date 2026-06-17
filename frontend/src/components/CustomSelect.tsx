import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface CustomSelectOption<T extends string> {
  label: string;
  value: T;
}

interface CustomSelectProps<T extends string> {
  label?: string;
  onChange: (value: T) => void;
  options: CustomSelectOption<T>[];
  value: T;
}

export function CustomSelect<T extends string>({
  label,
  onChange,
  options,
  value,
}: CustomSelectProps<T>): ReactNode {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();
  const selectedOption = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="custom-select-field" ref={rootRef}>
      {label && (
        <span className="custom-select-label" id={labelId}>
          {label}
        </span>
      )}
      <div className={`custom-select ${isOpen ? "is-open" : ""}`}>
        <button
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={label ? labelId : undefined}
          className="custom-select-trigger"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span>{selectedOption?.label || ""}</span>
          <span className="custom-select-chevron" aria-hidden="true" />
        </button>
        {isOpen && (
          <div className="custom-select-menu" role="listbox">
            {options.map((option) => (
              <button
                aria-selected={option.value === value}
                className={`custom-select-option ${option.value === value ? "is-selected" : ""}`}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
