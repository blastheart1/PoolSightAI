/**
 * Pure utility functions for zone classification and pool setback derivation.
 * Values are hardcoded from LAMC — no AI inference, no external API calls.
 */

import type { ZoneType, PoolSetbacks } from "@/types/permits";

// Strip [Q], [D], [T] prefix qualifiers before reading the base zone code
function stripQualifiers(code: string): string {
  return code.replace(/^\[.\]/g, "").trim();
}

/**
 * Classify a zoning code into a broad zone type for UI warnings.
 *
 * Residential: R, RE, RS, RD, RW, RA
 * Commercial:  C, CR, CL, CM (limited manufacturing — still commercial character)
 * Industrial:  M, MR
 * Public:      PF
 * Open Space:  OS, GW, AG, PB
 */
export function classifyZone(zoningCode: string): ZoneType {
  const base = stripQualifiers(zoningCode).toUpperCase();

  if (/^R[A-Z0-9-]/.test(base) || base.startsWith("R")) return "residential";
  if (base.startsWith("CR") || base.startsWith("CL") || base.startsWith("C")) return "commercial";
  if (base.startsWith("CM")) return "industrial"; // Limited Manufacturing
  if (base.startsWith("MR") || base.startsWith("M")) return "industrial";
  if (base.startsWith("PF")) return "public_facilities";
  if (
    base.startsWith("OS") ||
    base.startsWith("GW") ||
    base.startsWith("AG") ||
    base.startsWith("PB")
  )
    return "open_space";

  return "unknown";
}

/**
 * Derive pool-specific setbacks from the zoning code and overlay list.
 *
 * Base values: LAMC Section 12.21-A,4(k) — Swimming Pools
 *   - Not permitted in required front yard
 *   - Min 5 ft from any interior side or rear property line
 *   - Min 5 ft from main building or any structure
 *   - Equipment pad: same 5 ft property-line rule
 *
 * Caveats are derived from the zone code suffixes and overlays array so
 * users know which conditions may modify these standards.
 */
export function derivePoolSetbacks(
  zoningCode: string,
  overlays: string[]
): PoolSetbacks {
  const upper = zoningCode.toUpperCase();
  const caveats: string[] = [];

  // Hillside area — BHO may add grading and coverage restrictions
  if (upper.includes("-H") || upper.endsWith("H")) {
    caveats.push(
      "Hillside Area (BHO): additional grading, drainage, and setback restrictions may apply — verify with LADBS Hillside ordinance (LAMC 91.7006)"
    );
  }

  // CPIO — community plan may impose additional pool or accessory structure rules
  if (upper.includes("CPIO")) {
    caveats.push(
      "CPIO overlay present: verify whether the applicable Community Plan Implementation Overlay imposes additional accessory structure or pool setback requirements"
    );
  }

  // Q condition — specific restrictions recorded against this parcel
  if (upper.startsWith("[Q]") || upper.includes("[Q]")) {
    caveats.push(
      "[Q] Qualified condition: specific development restrictions are recorded on this parcel — confirm pool setbacks are not further restricted by the Q condition ordinance"
    );
  }

  // RE (Residential Estate) large-lot zones — lot size minimums, verify no CC&Rs
  if (/^RE\d/.test(stripQualifiers(upper))) {
    caveats.push(
      "RE zone: large-lot estate designation — verify no private CC&Rs or deed restrictions impose larger pool setbacks beyond LAMC minimums"
    );
  }

  // VL (Very Low density) suffix
  if (upper.includes("-VL") || upper.endsWith("VL")) {
    caveats.push(
      "VL (Very Low density) suffix: may impose additional lot coverage or development restrictions — verify with LADBS"
    );
  }

  // Overlay mentions in the overlays array that suggest further restrictions
  const overlayText = overlays.join(" ").toLowerCase();
  if (overlayText.includes("specific plan") && !upper.includes("CPIO")) {
    caveats.push(
      "Specific Plan detected in overlays: verify whether plan contains pool-specific setback or accessory structure standards"
    );
  }

  // Always include the baseline reminder
  caveats.push(
    "Standard LAMC 12.21-A,4(k) values shown — always confirm final setbacks on permitted plans with LADBS before construction"
  );

  return {
    fromPropertyLine: "5 ft",
    fromDwelling: "5 ft",
    frontYard: "Not permitted in required front yard",
    equipmentPad: "5 ft from property line",
    caveats,
  };
}
