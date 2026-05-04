/** A single segment returned by Whisper verbose_json */
export interface TranscriptSegment {
  id: number;
  start: number; // seconds
  end: number;   // seconds
  text: string;
}

export type SensitivityCategory =
  | "safety_concern"
  | "schedule_issue"
  | "cost_overrun"
  | "internal_dispute"
  | "pm_venting"
  | "client_complaint"
  | "quality_issue";

export interface FlaggedSegment {
  segmentId: number;
  start: number;
  end: number;
  text: string;
  category: SensitivityCategory;
  reason: string;
}

export interface SensitivityCheckResponse {
  flaggedSegments: FlaggedSegment[];
}
