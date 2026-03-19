/**
 * Shared reconciliation response types for API and DB jsonb.
 * Used by app/api/analyze and ai_analysis_results.
 */

export type RecoStatus = "advance" | "hold" | "verify" | "ok";
export type PhotoSupported = "yes" | "no" | "partial" | "unclear";

export type RecoRow = {
  line_item: string;
  current_percent: string;
  suggested_percent: string;
  suggested_percent_range?: string;
  status: RecoStatus;
  photo_supported?: PhotoSupported;
  notes: string;
};

export type RecoSection = {
  id: string;
  title: string;
  rows: RecoRow[];
};

export type KeyActionPriority =
  | "immediate"
  | "this_week"
  | "verify"
  | "next_cycle";

export type KeyAction = {
  priority: KeyActionPriority;
  label: string;
  action: string;
};

export type ReconciliationResponse = {
  project: string;
  as_of_date: string;
  overall_progress: number | null;
  confidence: string;
  image_coverage_note?: string;
  rendering_relation_note?: string;
  summary?: string;
  sections: RecoSection[];
  key_actions: KeyAction[];
};
