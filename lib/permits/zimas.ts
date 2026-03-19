const LA_GEOHUB_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

interface GeocodeResult {
  lat: number;
  lon: number;
  matchedAddress: string;
}

/**
 * Geocode an LA address via Census Bureau API.
 * Returns lat/lon or null when not found.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    format: "json",
  });

  const res = await fetch(`${LA_GEOHUB_URL}?${params}`, { cache: "no-store" });
  if (!res.ok) return null;

  const json = await res.json();
  const matches = json?.result?.addressMatches;
  if (!Array.isArray(matches) || matches.length === 0) return null;

  const match = matches[0];
  return {
    lat: Number(match.coordinates?.y ?? 0),
    lon: Number(match.coordinates?.x ?? 0),
    matchedAddress: match.matchedAddress ?? address,
  };
}

const ZIMAS_REST_URL =
  "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/ZIMAS_Parcels/FeatureServer/0/query";

interface ZimasRawParcel {
  PARCEL_ID?: string;
  APN?: string;
  ZONE_CLASS?: string;
  ZONE_SMRY?: string;
  GEN_PLAN?: string;
  HEIGHT_DISTRICT?: string;
  LOT_SIZE?: string | number;
  OVERLAY?: string;
  SPEC_PLAN?: string;
  [key: string]: unknown;
}

/**
 * Query the LA ZIMAS ArcGIS FeatureServer by lat/lon.
 * Returns raw parcel attributes or null.
 */
export async function fetchZimasParcel(
  lat: number,
  lon: number
): Promise<ZimasRawParcel | null> {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: "esriGeometryPoint",
    spatialRel: "esriSpatialRelIntersects",
    inSR: "4326",
    outFields: "*",
    returnGeometry: "false",
    f: "json",
  });

  const res = await fetch(`${ZIMAS_REST_URL}?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = await res.json();
  const features = json?.features;
  if (!Array.isArray(features) || features.length === 0) return null;

  return features[0].attributes as ZimasRawParcel;
}
