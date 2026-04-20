-- AI inference cache for zoning codes lacking explicit dimensional standards.
-- Apply via: npx drizzle-kit push (preferred) or run this SQL manually
CREATE TABLE IF NOT EXISTS zoning_code_inference_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  zoning_code TEXT NOT NULL,
  inference_data JSONB NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zoning_code_inference_cache_unique
  ON zoning_code_inference_cache (jurisdiction, zoning_code);
