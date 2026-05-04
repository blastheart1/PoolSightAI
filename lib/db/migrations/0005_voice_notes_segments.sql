-- Add segments column to project_voice_notes for Whisper verbose_json output.
-- Stores TranscriptSegment[] (id, start, end, text) used by sensitivity analysis.
-- Nullable: existing rows and manual-typed notes have no segments.
ALTER TABLE project_voice_notes ADD COLUMN IF NOT EXISTS segments jsonb;
