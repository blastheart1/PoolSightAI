// ---------------------------------------------------------------------------
// Lightbox RE API — response types (Trial)
// ---------------------------------------------------------------------------

export interface LightboxZoningResult {
  parcelId: string;
  jurisdiction: string;
  zoningCode: string;
  zoningCategory: string;
  zoningSubcategory: string;
  description: string | null;
  summary: string | null;
  permittedUse: string | null;
  frontSetback: string | null;
  sideSetback: string | null;
  rearSetback: string | null;
  maxBuildingHeight: string | null;
  maxStories: string | null;
  maxSiteCoverage: string | null;
  minLotArea: string | null;
  densityFloorArea: string | null;
  ordinanceUrl: string | null;
  zoningVintage: string | null;
}

export interface LightboxParcelResult {
  parcelId: string;
  apn: string;
  fips: string;
  county: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ownerName: string;
  ownerAddress: string;
  ownerOccupied: boolean;
  landUse: string;
  landUseCategory: string;
  propertyType: string;
  lotSizeSqm: number | null;
  lotSizeSqft: number | null;
  yearBuilt: string | null;
  livingAreaSqm: number | null;
  livingAreaSqft: number | null;
  bedrooms: number | null;
  baths: number | null;
  stories: string | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  lastSaleBuyer: string | null;
  lastSaleSeller: string | null;
  legalDescription: string[];
  latitude: number | null;
  longitude: number | null;
  parcelWkt: string | null;
}

export interface LightboxAssessmentResult {
  assessmentId: string;
  parcelId: string;
  apn: string;
  assessedValueTotal: number | null;
  assessedValueLand: number | null;
  assessedValueImprovements: number | null;
  assessedYear: string | null;
  avm: number | null;
  taxYear: string | null;
  taxAmount: number | null;
  lotSizeSqm: number | null;
  lotSizeSqft: number | null;
  yearBuilt: string | null;
  stories: string | null;
  bedrooms: number | null;
  baths: number | null;
  rooms: number | null;
  livingAreaSqm: number | null;
  livingAreaSqft: number | null;
  parkingSpaces: number | null;
  roofType: string | null;
  constructionType: string | null;
  heatingType: string | null;
  acType: string | null;
  garageType: string | null;
  style: string | null;
  poolIndicator: string | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  lastSaleBuyer: string | null;
  lastSaleSeller: string | null;
  priorSalePrice: number | null;
  priorSaleSeller: string | null;
  lastLoanAmount: number | null;
  lastLoanLender: string | null;
  improvementPercent: number | null;
}

export interface ZoningInferenceResult {
  frontSetback: string | null;
  sideSetback: string | null;
  rearSetback: string | null;
  maxBuildingHeight: string | null;
  maxStories: string | null;
  maxSiteCoverage: string | null;
  minLotArea: string | null;
  densityFloorArea: string | null;
  confidence: "high" | "medium" | "low";
  sourceNote: string;
  caveats: string[];
}

export interface LightboxStructureResult {
  structureId: string;
  parcelId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  footprintAreaSqm: number | null;
  footprintAreaSqft: number | null;
  heightAvgM: number | null;
  heightAvgFt: number | null;
  heightMaxM: number | null;
  heightMaxFt: number | null;
  numberOfStories: number | null;
  groundElevationAvgM: number | null;
  groundElevationAvgFt: number | null;
  isBusiness: boolean;
  isPrimaryBuilding: boolean;
  ubid: string | null;
  structureWkt: string | null;
}
