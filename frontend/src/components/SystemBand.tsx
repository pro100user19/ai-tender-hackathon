import type { ReactNode } from "react";

interface CounterProps {
  label: string;
  value: string;
}

function Counter({ label, value }: CounterProps): ReactNode {
  return (
    <p className="counter">
      <strong>{value}</strong>
      <span>{label}</span>
    </p>
  );
}
