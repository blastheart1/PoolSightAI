CREATE TABLE IF NOT EXISTS "project_sensitivity_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "media_type" varchar(10) NOT NULL,
  "file_name" text NOT NULL,
  "transcript" text NOT NULL,
  "segments" jsonb NOT NULL,
  "flags" jsonb NOT NULL,
  "flag_count" integer NOT NULL,
  "word_count" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "project_sensitivity_reports_project_media_idx"
  ON "project_sensitivity_reports" ("project_id", "media_type", "created_at");
