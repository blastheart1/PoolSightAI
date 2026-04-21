export type ProjectType = "pool" | "adu" | "addition" | "remodel" | "new_construction";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ComplianceStatus = "pass" | "fail" | "warning";

export interface ExtractedDimension {
  label: string;
  value: string;
  unit: string;
  confidence: ConfidenceLevel;
}

export interface ExtractedRoom {
  label: string;
  squareFootage: string;
  confidence: ConfidenceLevel;
}

export interface DrawingAnalysisResult {
  dimensions: ExtractedDimension[];
  rooms: ExtractedRoom[];
  setbacks: { side: string; distance: string; confidence: ConfidenceLevel }[];
  notes: string[];
  flagged: string[];
}

export type ZoneType =
  | "residential"
  | "commercial"
  | "industrial"
  | "public_facilities"
  | "open_space"
  | "unknown";

export interface PoolSetbacks {
  /** From any property line — LAMC 12.21-A,4(k) */
  fromPropertyLine: string;
  /** From the main dwelling or any structure — LAMC 12.21-A,4(k) */
  fromDwelling: string;
  /** Front yard — pools not permitted in required front yard */
  frontYard: string;
  /** Equipment pad — same property-line rule applies */
  equipmentPad: string;
  /** Zone-specific caveats (hillside, CPIO, Q conditions, etc.) */
  caveats: string[];
}

export interface ZoningResult {
  parcelNumber: string;
  zoningClassification: string;
  lotSize: string;
  allowedUses: string[];
  setbacks: { front: string; rear: string; sideLeft: string; sideRight: string };
  heightLimit: string;
  lotCoverageMax: string;
  overlays: string[];
  rawSource: string;
  /** Address as matched by the Census geocoder — may differ from the input (e.g. "1/2" units dropped) */
  matchedAddress?: string;
  /** Pool-specific setbacks per LAMC 12.21-A,4(k) — hardcoded from ordinance, not AI-inferred */
  poolSetbacks?: PoolSetbacks;
  /** Broad zone classification used for UI warnings */
  zoneType?: ZoneType;
}

export interface LotCalculatorInput {
  lotWidth: number;
  lotDepth: number;
  structureFootprint: number;
  proposedFAR: number;
  setbacks: { front: number; rear: number; sideLeft: number; sideRight: number };
  zoningRules: {
    maxLotCoverage: number;
    maxFAR: number;
    minSetbacks: { front: number; rear: number; side: number };
  };
}

export interface LotCalculatorResult {
  lotArea: number;
  lotCoveragePercent: number;
  lotCoverageStatus: ComplianceStatus;
  farCalculated: number;
  farStatus: ComplianceStatus;
  setbackResults: { side: string; proposed: number; required: number; status: ComplianceStatus }[];
  summary: string;
}

export interface ChecklistItem {
  name: string;
  formNumber?: string;
  required: boolean;
  notes?: string;
}

export interface ChecklistResult {
  projectType: ProjectType;
  requiredForms: ChecklistItem[];
  requiredPlanSheets: string[];
  supportingDocuments: ChecklistItem[];
  estimatedReviewTime: string;
  notes: string[];
}

export interface RedlineCorrection {
  originalText: string;
  plainLanguageSummary: string;
  draftResponse: string;
  affectedSheets: string[];
  actionRequired: string;
}

export interface RedlineResult {
  corrections: RedlineCorrection[];
  coverLetter: string;
  totalCorrections: number;
}

// --- TOOL 7 TYPES ---

export type { PoolFeatureType } from "@/lib/permits/featureRegistry";
import type { PoolFeatureType } from "@/lib/permits/featureRegistry";

export interface PoolFeature {
  id: string;
  type: PoolFeatureType;
  label: string;
  estimatedWidth?: number;
  estimatedLength?: number;
  estimatedArea?: number;
  material?: string;
  notes?: string;
  confidence: ConfidenceLevel;
  engineerConfirmed: boolean;
  engineerOverride?: Partial<Omit<PoolFeature, "id" | "engineerConfirmed">>;
  deckWrap?: "U" | "L" | "right" | "left" | "surround" | null;
  containedIn?: string | null;
  spatialPosition?: string | null;
  adjacentTo?: string[];
}

export interface SiteCondition {
  id: string;
  description: string;
  type: "slope" | "retaining_wall" | "existing_structure" | "drainage" | "other";
  actionRequired: string;
  confidence: ConfidenceLevel;
  engineerConfirmed: boolean;
}

export interface RenderingInterpretation {
  features: PoolFeature[];
  siteConditions: SiteCondition[];
  estimatedTotalDeckingArea?: number;
  inferredStyle?: string;
  materialsIdentified: string[];
  engineerActionItems: string[];
  rawDescription: string;
}

export interface SitePlanInputs {
  interpretation: RenderingInterpretation;
  address?: string;
  lotWidth?: number;
  lotDepth?: number;
  houseFootprintWidth?: number;
  houseFootprintDepth?: number;
  houseSetbackFromFront?: number;
  houseSetbackFromLeft?: number;
  confirmedFeatures: PoolFeature[];
  confirmedDimensions: {
    [featureId: string]: {
      width?: number;
      length?: number;
      area?: number;
    };
  };
  scale?: number;
  north?: "up" | "down" | "left" | "right";
  zoningData?: ZoningResult;
}

export interface SitePlanOutputs {
  svgContent: string;
  dxfContent: string;
  dataSheet: SitePlanDataSheet;
}

export interface SitePlanDataSheet {
  projectType: "pool";
  generatedAt: string;
  address?: string;
  zoningData?: ZoningResult;
  features: PoolFeature[];
  siteConditions: SiteCondition[];
  estimatedPoolArea?: number;
  estimatedDeckingArea?: number;
  materialsSchedule: { item: string; material: string; notes?: string }[];
  engineerActionItems: string[];
  disclaimer: string;
}
