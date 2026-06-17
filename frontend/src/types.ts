export type StateSetter<T> = (value: T | ((previous: T) => T)) => void;

export type Severity = "висока" | "середня" | "низька" | "немає";
export type PriorityClass = "high" | "medium" | "low" | "none";
export type Tone = "blue" | "green" | "amber" | "red";
export type Status = "loading" | "ready" | "error";
export type SortKey =
  | "processed_desc"
  | "score_asc"
  | "score_desc"
  | "priority_desc"
  | "priority_asc"
  | "value_desc";

export interface PriorityMeta {
  label: string;
  className: PriorityClass;
}

export interface TenderSummary {
  tender_id: string;
  tender_code: string;
  title: string;
  buyer_name: string;
  value_amount: number | null;
  currency: string | null;
  cpv: string | null;
  sector: string;
  procurement_method_type: string | null;
  date_modified: string | null;
}

export interface Issue {
  category: string;
  title: string;
  severity: Severity;
  evidence_quote: string;
  explanation: string;
  suggested_rewrite: string;
  document_title?: string | null;
  document_id?: string | null;
  source?: string;
}

export interface DocumentResult {
  id: string;
  title: string;
  format: string;
  url: string;
  status: string;
  parsed_chars: number;
  limitation?: string | null;
}

export interface LlmUsage {
  model?: string;
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
  total_cost_usd?: number;
  input_usd_per_million?: number;
  cached_input_usd_per_million?: number;
  output_usd_per_million?: number;
  source?: string;
}

export interface DocumentReviewItem {
  quote: string;
  document_title: string;
  document_id: string;
}

export interface TenderResult {
  summary: TenderSummary;
  processed_at: string;
  overall_score: number;
  subscores: Record<string, number>;
  issues?: Issue[];
  is_user_request?: boolean;
  documents?: DocumentResult[];
  limitations?: string[];
  human_review_notice?: string;
  llm_engine?: string;
  llm_usage?: LlmUsage;
  document_review?: Record<string, DocumentReviewItem[]>;
}

export interface Aggregate {
  averageScore: string;
  highRiskCount: number;
  issueCount: number;
  sectors: Array<[string, number]>;
  severityCounts: Record<Severity, number>;
  total: number;
  totalValue: number;
}
