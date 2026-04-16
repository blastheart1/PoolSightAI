// ---------------------------------------------------------------------------
// Lightbox RE API client — shared fetch helpers (Trial)
// ---------------------------------------------------------------------------

const BASE = "https://api.lightboxre.com/v1";

const SQM_TO_SQFT = 10.7639;
const M_TO_FT = 3.28084;

function getApiKey(): string {
  const key = process.env.LIGHTBOX_API_KEY;
  if (!key) throw new Error("LIGHTBOX_API_KEY not configured");
  return key;
}

async function lbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { "x-api-key": getApiKey() },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lightbox ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function sqmToSqft(sqm: number | null | undefined): number | null {
  return sqm != null ? Math.round(sqm * SQM_TO_SQFT) : null;
}

function mToFt(m: number | null | undefined): number | null {
  return m != null ? Math.round(m * M_TO_FT * 100) / 100 : null;
}

function val<T>(v: T | null | undefined): T | null {
  return v ?? null;
}

// ---------------------------------------------------------------------------
// Zoning
// ---------------------------------------------------------------------------

import type {
  LightboxZoningResult,
  LightboxParcelResult,
  LightboxAssessmentResult,
  LightboxStructureResult,
} from "@/types/lightbox";

interface LbZoningRaw {
  zonings?: Array<{
    parcel?: { id?: string };
    jurisdiction?: { name?: string };
    code?: { value?: string };
    category?: string;
    subcategory?: string;
    description?: { value?: string };
    summary?: { value?: string };
    permittedUse?: string | null;
    frontSetback?: { distance?: string | number | null; description?: string | null };
    sideSetback?: { distance?: string | number | null; description?: string | null };
    rearSetback?: { distance?: string | number | null; description?: string | null };
    maximumBuildingHeight?: {
      height?: string | number | null;
      maxStories?: string | number | null;
      description?: string | null;
    };
    maximumSiteCoverage?: { percent?: string | number | null; description?: string | null };
    minimumLotArea?: { perLot?: string | number | null; description?: string | null };
    densityFloorArea?: { value?: string | number | null; description?: string | null };
    $metadata?: {
      ordinanceUrl?: string | null;
      vintage?: { zoning?: string | null };
    };
  }>;
}

export async function fetchZoning(address: string): Promise<LightboxZoningResult | null> {
  const raw = await lbGet<LbZoningRaw>(
    `/zoning/address?text=${encodeURIComponent(address)}`
  );
  const z = raw.zonings?.[0];
  if (!z) return null;

  return {
    parcelId: z.parcel?.id ?? "",
    jurisdiction: z.jurisdiction?.name ?? "",
    zoningCode: z.code?.value ?? "",
    zoningCategory: z.category ?? "UNKNOWN",
    zoningSubcategory: z.subcategory ?? "UNKNOWN",
    description: val(z.description?.value),
    summary: val(z.summary?.value),
    permittedUse: val(z.permittedUse),
    frontSetback: z.frontSetback?.distance != null ? String(z.frontSetback.distance) : val(z.frontSetback?.description),
    sideSetback: z.sideSetback?.distance != null ? String(z.sideSetback.distance) : val(z.sideSetback?.description),
    rearSetback: z.rearSetback?.distance != null ? String(z.rearSetback.distance) : val(z.rearSetback?.description),
    maxBuildingHeight: z.maximumBuildingHeight?.height != null ? String(z.maximumBuildingHeight.height) : val(z.maximumBuildingHeight?.description),
    maxStories: z.maximumBuildingHeight?.maxStories != null ? String(z.maximumBuildingHeight.maxStories) : null,
    maxSiteCoverage: z.maximumSiteCoverage?.percent != null ? `${z.maximumSiteCoverage.percent}%` : val(z.maximumSiteCoverage?.description),
    minLotArea: z.minimumLotArea?.perLot != null ? String(z.minimumLotArea.perLot) : val(z.minimumLotArea?.description),
    densityFloorArea: z.densityFloorArea?.value != null ? String(z.densityFloorArea.value) : val(z.densityFloorArea?.description),
    ordinanceUrl: val(z.$metadata?.ordinanceUrl),
    zoningVintage: val(z.$metadata?.vintage?.zoning),
  };
}

// ---------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchParcel(address: string): Promise<LightboxParcelResult | null> {
  const raw = await lbGet<any>(
    `/parcels/address?text=${encodeURIComponent(address)}`
  );
  const p = raw.parcels?.[0];
  if (!p) return null;

  const lotSqm = p.assessment?.lot?.size ?? p.derived?.calculatedLotArea ?? null;
  const livingSqm = p.primaryStructure?.livingArea ?? null;
  const owner = p.owner?.names?.[0];

  return {
    parcelId: p.id ?? "",
    apn: p.assessment?.apn ?? p.parcelApn ?? "",
    fips: p.fips ?? "",
    county: p.county ?? "",
    address: p.location?.streetAddress ?? "",
    city: p.location?.locality ?? "",
    state: p.location?.regionCode ?? "",
    zip: p.location?.postalCode ?? "",
    ownerName: owner?.fullName ?? "",
    ownerAddress: [p.owner?.streetAddress, p.owner?.locality, p.owner?.regionCode, p.owner?.postalCode].filter(Boolean).join(", "),
    ownerOccupied: p.occupant?.owner ?? false,
    landUse: p.landUse?.description ?? "",
    landUseCategory: p.landUse?.normalized?.categoryDescription ?? "",
    propertyType: p.propertyType?.type?.description ?? "",
    lotSizeSqm: val(lotSqm),
    lotSizeSqft: sqmToSqft(lotSqm),
    yearBuilt: val(p.primaryStructure?.yearBuilt),
    livingAreaSqm: val(livingSqm),
    livingAreaSqft: sqmToSqft(livingSqm),
    bedrooms: val(p.primaryStructure?.bedrooms) ?? val(p.assessment?.bedrooms),
    baths: val(p.primaryStructure?.baths) ?? val(p.assessment?.baths),
    stories: val(p.primaryStructure?.stories?.count),
    lastSaleDate: val(p.transaction?.lastMarketSale?.transferDate),
    lastSalePrice: val(p.transaction?.lastMarketSale?.value),
    lastSaleBuyer: val(p.transaction?.lastMarketSale?.buyer),
    lastSaleSeller: val(p.transaction?.lastMarketSale?.seller),
    legalDescription: p.legalDescription ?? [],
    latitude: val(p.location?.representativePoint?.latitude),
    longitude: val(p.location?.representativePoint?.longitude),
    parcelWkt: val(p.location?.geometry?.wkt),
  };
}

// ---------------------------------------------------------------------------
// Assessments
// ---------------------------------------------------------------------------

export async function fetchAssessment(address: string): Promise<LightboxAssessmentResult | null> {
  const raw = await lbGet<any>(
    `/assessments/address?text=${encodeURIComponent(address)}`
  );
  const a = raw.assessments?.[0];
  if (!a) return null;

  const livingSqm = a.primaryStructure?.livingArea ?? null;
  const lotSqm = a.lot?.lotSize ?? a.assessedLotSize ?? null;

  return {
    assessmentId: a.id ?? "",
    parcelId: a.parcel?.id ?? "",
    apn: a.apn ?? "",
    assessedValueTotal: val(a.assessedValue?.total),
    assessedValueLand: val(a.assessedValue?.land),
    assessedValueImprovements: val(a.assessedValue?.improvements),
    assessedYear: val(a.assessedValue?.year),
    avm: val(a.avm),
    taxYear: val(a.tax?.year),
    taxAmount: val(a.tax?.amount),
    lotSizeSqm: val(lotSqm),
    lotSizeSqft: sqmToSqft(lotSqm),
    yearBuilt: val(a.primaryStructure?.yearBuilt),
    stories: val(a.primaryStructure?.stories?.count),
    bedrooms: val(a.primaryStructure?.bedrooms),
    baths: val(a.primaryStructure?.baths),
    rooms: val(a.primaryStructure?.rooms),
    livingAreaSqm: val(livingSqm),
    livingAreaSqft: sqmToSqft(livingSqm),
    parkingSpaces: val(a.primaryStructure?.parkingSpaces),
    roofType: val(a.primaryStructure?.roof?.description),
    constructionType: val(a.primaryStructure?.construction?.description),
    heatingType: val(a.primaryStructure?.heating?.description),
    acType: val(a.primaryStructure?.airConditioning?.description),
    garageType: val(a.primaryStructure?.garage?.description),
    style: val(a.primaryStructure?.style?.description),
    poolIndicator: val(a.poolIndicator),
    lastSaleDate: val(a.transaction?.lastMarketSale?.transferDate),
    lastSalePrice: val(a.transaction?.lastMarketSale?.value),
    lastSaleBuyer: val(a.transaction?.lastMarketSale?.buyer),
    lastSaleSeller: val(a.transaction?.lastMarketSale?.seller),
    priorSalePrice: val(a.transaction?.priorSale?.value),
    priorSaleSeller: val(a.transaction?.priorSale?.seller),
    lastLoanAmount: val(a.lastLoan?.value),
    lastLoanLender: val(a.lastLoan?.lender),
    improvementPercent: val(a.improvementPercent),
  };
}

// ---------------------------------------------------------------------------
// Structures
// ---------------------------------------------------------------------------

export async function fetchStructure(address: string): Promise<LightboxStructureResult | null> {
  const raw = await lbGet<any>(
    `/structures/address?text=${encodeURIComponent(address)}`
  );
  const s = raw.structures?.[0];
  if (!s) return null;

  const footprintSqm = s.physicalFeatures?.area?.footprintArea ?? null;
  const heightAvgM = s.physicalFeatures?.height?.average ?? null;
  const heightMaxM = s.physicalFeatures?.height?.max ?? null;
  const elevAvgM = s.physicalFeatures?.groundElevation?.average ?? null;

  return {
    structureId: s.id ?? "",
    parcelId: s.parcels?.[0]?.id ?? "",
    address: s.location?.streetAddress ?? "",
    city: s.location?.locality ?? "",
    state: s.location?.regionCode ?? "",
    zip: s.location?.postalCode ?? "",
    footprintAreaSqm: val(footprintSqm),
    footprintAreaSqft: sqmToSqft(footprintSqm),
    heightAvgM: val(heightAvgM),
    heightAvgFt: mToFt(heightAvgM),
    heightMaxM: val(heightMaxM),
    heightMaxFt: mToFt(heightMaxM),
    numberOfStories: val(s.physicalFeatures?.numberOfStories),
    groundElevationAvgM: val(elevAvgM),
    groundElevationAvgFt: mToFt(elevAvgM),
    isBusiness: s.business ?? false,
    isPrimaryBuilding: s.parcels?.[0]?.primaryBuilding ?? false,
    ubid: val(s.ubid),
    structureWkt: val(s.location?.geometry?.wkt),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
