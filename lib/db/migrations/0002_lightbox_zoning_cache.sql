-- Lean cache for Lightbox zoning lookups (trial).
-- Apply via: npx drizzle-kit push (preferred) or run this SQL manually
CREATE TABLE IF NOT EXISTS lightbox_zoning_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  parcel_id TEXT,
  jurisdiction TEXT,
  zoning_data JSONB,
  http_status INTEGER NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lightbox_zoning_cache_normalized_unique
  ON lightbox_zoning_cache (normalized_address);

CREATE INDEX IF NOT EXISTS lightbox_zoning_cache_parcel_id_idx
  ON lightbox_zoning_cache (parcel_id);
