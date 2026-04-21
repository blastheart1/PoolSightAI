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

// Zone prefixes that are non-buildable and should be deprioritised when
// a residential/commercial parcel is also present in the result set.
const NON_BUILDABLE_PREFIXES = ["OS", "PF", "GW", "AG", "PB"];

function isNonBuildable(zoning: string | undefined): boolean {
  if (!zoning) return true;
  const prefix = zoning.replace(/^\[.\]/, "").split("-")[0].toUpperCase();
  return NON_BUILDABLE_PREFIXES.includes(prefix);
}

export interface ZimasRawParcel {
  Zoning?: string;
  CATEGORY?: string;
  Shape__Area?: number;
  [key: string]: unknown;
}

async function queryZimasEnvelope(
  proj: { x: number; y: number },
  buffer: number
): Promise<ZimasRawParcel[]> {
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
    outFields: "Zoning,CATEGORY,Shape__Area",
    returnGeometry: "false",
    resultRecordCount: "5",
    f: "json",
  });

  const res = await fetch(`${ZONING_SERVICE_URL}?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];

  const json = await res.json();
  return Array.isArray(json?.features)
    ? (json.features.map((f: { attributes: ZimasRawParcel }) => f.attributes) as ZimasRawParcel[])
    : [];
}

function selectBestParcel(features: ZimasRawParcel[]): ZimasRawParcel | null {
  if (features.length === 0) return null;
  if (features.length === 1) return features[0];

  // Prefer buildable parcels over open space / public facilities
  const buildable = features.filter((f) => !isNonBuildable(f.Zoning));
  const pool = buildable.length > 0 ? buildable : features;

  // Among candidates, pick the smallest polygon — closest match to the
  // actual parcel the geocoded point landed on vs. a large adjacent zone.
  return pool.slice().sort((a, b) => (a.Shape__Area ?? Infinity) - (b.Shape__Area ?? Infinity))[0];
}

/**
 * Query the LA City Zoning FeatureServer for the parcel at a given lat/lon.
 *
 * Strategy:
 * 1. Try a tight 75 ft envelope (covers street-centerline-to-parcel gap).
 * 2. If no features found, retry with a 150 ft envelope as fallback.
 * 3. From up to 5 returned features, prefer buildable zones over OS/PF/GW,
 *    then pick the smallest polygon area (most likely the actual parcel).
 */
export async function fetchZimasParcel(
  lat: number,
  lon: number
): Promise<ZimasRawParcel | null> {
  const proj = await projectToStatePlane(lon, lat);
  if (!proj) return null;

  let features = await queryZimasEnvelope(proj, 75);
  if (features.length === 0) {
    features = await queryZimasEnvelope(proj, 150);
  }

  return selectBestParcel(features);
}
