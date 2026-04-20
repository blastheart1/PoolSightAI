// Lean dedup cache for Lightbox zoning lookups (trial).
// Pattern: normalize the raw address (lowercase + trim + collapse whitespace),
// use it as a unique key into `lightbox_zoning_cache`. No abbreviation expansion.
// See wiki/concepts/API Caching Patterns.md for the post-trial 3-table plan.

import { and, eq } from "drizzle-orm";
import { db, lightboxZoningCache } from "@/lib/db";
import type { LightboxZoningResult } from "@/types/lightbox";

export function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[,]\s*/g, ", ");
}

export interface CachedZoningLookup {
  source: "cache" | "api";
  httpStatus: number;
  normalizedAddress: string;
  rawAddressStored: string;
  data: LightboxZoningResult | null;
  fetchedAt: Date;
}

export async function getCachedZoning(
  normalized: string,
): Promise<CachedZoningLookup | null> {
  if (!db) return null;
  const rows = await db
    .select()
    .from(lightboxZoningCache)
    .where(eq(lightboxZoningCache.normalizedAddress, normalized))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    source: "cache",
    httpStatus: row.httpStatus,
    normalizedAddress: row.normalizedAddress,
    rawAddressStored: row.rawAddress,
    data: (row.zoningData as LightboxZoningResult | null) ?? null,
    fetchedAt: row.fetchedAt,
  };
}

export async function upsertCachedZoning(args: {
  rawAddress: string;
  normalizedAddress: string;
  data: LightboxZoningResult | null;
  httpStatus: number;
}): Promise<void> {
  if (!db) return;
  const { rawAddress, normalizedAddress, data, httpStatus } = args;
  await db
    .insert(lightboxZoningCache)
    .values({
      rawAddress,
      normalizedAddress,
      parcelId: data?.parcelId ?? null,
      jurisdiction: data?.jurisdiction ?? null,
      zoningData: data ?? null,
      httpStatus,
    })
    .onConflictDoUpdate({
      target: lightboxZoningCache.normalizedAddress,
      set: {
        rawAddress,
        parcelId: data?.parcelId ?? null,
        jurisdiction: data?.jurisdiction ?? null,
        zoningData: data ?? null,
        httpStatus,
        fetchedAt: new Date(),
      },
    });
}

export async function deleteCachedZoning(
  normalized: string,
): Promise<void> {
  if (!db) return;
  await db
    .delete(lightboxZoningCache)
    .where(
      and(eq(lightboxZoningCache.normalizedAddress, normalized)),
    );
}
