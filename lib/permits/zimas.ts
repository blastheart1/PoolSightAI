const CENSUS_GEOCODER_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

interface GeocodeResult {
  lat: number;
  lon: number;
  matchedAddress: string;
}

/**
 * Geocode an LA address via US Census Bureau API.
 * Returns lat/lon (WGS84) or null when not found.
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

  const res = await fetch(`${CENSUS_GEOCODER_URL}?${params}`, {
    cache: "no-store",
  });
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

/**
 * Project WGS84 lon/lat to California State Plane Zone 5 (EPSG:2229 / WKID 102645)
 * using ESRI's public geometry service. Required for LA City GeoHub ArcGIS layers.
 */
async function projectToStatePlane(
  lon: number,
  lat: number
): Promise<{ x: number; y: number } | null> {
  const geometries = encodeURIComponent(
    JSON.stringify({
      geometryType: "esriGeometryPoint",
      geometries: [{ x: lon, y: lat }],
    })
  );

  const res = await fetch(
    `https://sampleserver6.arcgisonline.com/arcgis/rest/services/Utilities/Geometry/GeometryServer/project?inSR=4326&outSR=102645&geometries=${geometries}&f=json`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;

  const json = await res.json();
  const geom = json?.geometries?.[0];
  if (!geom) return null;

  return { x: geom.x, y: geom.y };
}

// LA City GeoHub — Zoning FeatureServer (layer 15)
const ZONING_SERVICE_URL =
  "https://services5.arcgis.com/7nsPwEMP38bSkCjy/arcgis/rest/services/Zoning/FeatureServer/15/query";

export interface ZimasRawParcel {
  Zoning?: string;
  CATEGORY?: string;
  [key: string]: unknown;
}

/**
 * Query the LA City Zoning FeatureServer for the parcel at a given lat/lon.
 * Uses a small envelope (50 ft buffer) around the projected point because
 * strict point-in-polygon queries against this layer are unreliable.
 */
export async function fetchZimasParcel(
  lat: number,
  lon: number
): Promise<ZimasRawParcel | null> {
  const proj = await projectToStatePlane(lon, lat);
  if (!proj) return null;

  const buffer = 150; // feet in State Plane units — needed because Census geocoder places points on street centerlines
  const envelope = {
    xmin: proj.x - buffer,
    ymin: proj.y - buffer,
    xmax: proj.x + buffer,
    ymax: proj.y + buffer,
  };

  const params = new URLSearchParams({
    geometry: JSON.stringify(envelope),
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "Zoning,CATEGORY",
    returnGeometry: "false",
    resultRecordCount: "1",
    f: "json",
  });

  const res = await fetch(`${ZONING_SERVICE_URL}?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const json = await res.json();
  const features = json?.features;
  if (!Array.isArray(features) || features.length === 0) return null;

  return features[0].attributes as ZimasRawParcel;
}
