/** Claude tool definition for sensitivity analysis. Single source of truth. */
export const SENSITIVITY_TOOL = {
  name: "flag_sensitive_segments",
  description:
    "Identify transcript segments that contain content a client should not hear in a shared daily report. Only flag genuinely problematic content — normal construction progress updates, standard delays with professional framing, and routine issue mentions should NOT be flagged.",
  input_schema: {
    type: "object" as const,
    properties: {
      flaggedSegments: {
        type: "array",
        description: "Segments that contain client-sensitive content. Empty array if nothing is flagged.",
        items: {
          type: "object",
          properties: {
            segmentId: {
              type: "number",
              description: "The id field of the original TranscriptSegment",
            },
            start: {
              type: "number",
              description: "Start time in seconds (copied from segment)",
            },
            end: {
              type: "number",
              description: "End time in seconds (copied from segment)",
            },
            text: {
              type: "string",
              description: "The verbatim segment text",
            },
            category: {
              type: "string",
              enum: [
                "safety_concern",
                "schedule_issue",
                "cost_overrun",
                "internal_dispute",
                "pm_venting",
                "client_complaint",
                "quality_issue",
              ],
              description: "The primary sensitivity category",
            },
            reason: {
              type: "string",
              description:
                "One concise sentence explaining why this segment is sensitive and could negatively affect the client relationship if heard.",
            },
          },
          required: ["segmentId", "start", "end", "text", "category", "reason"],
        },
      },
    },
    required: ["flaggedSegments"],
  },
} as const;
