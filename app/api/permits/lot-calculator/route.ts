import { NextResponse } from "next/server";
import type {
  LotCalculatorInput,
  LotCalculatorResult,
  ComplianceStatus,
} from "@/types/permits";

export const runtime = "nodejs";

function checkCompliance(value: number, max: number): ComplianceStatus {
  if (value <= max) return "pass";
  if (value <= max * 1.05) return "warning";
  return "fail";
}

function checkSetback(
  proposed: number,
  required: number
): ComplianceStatus {
  if (proposed >= required) return "pass";
  if (proposed >= required * 0.95) return "warning";
  return "fail";
}

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as Partial<LotCalculatorInput>;

    if (
      !input.lotWidth ||
      !input.lotDepth ||
      input.structureFootprint == null ||
      input.proposedFAR == null ||
      !input.setbacks ||
      !input.zoningRules
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "All fields are required: lotWidth, lotDepth, structureFootprint, proposedFAR, setbacks, zoningRules",
        },
        { status: 400 }
      );
    }

    const lotArea = input.lotWidth * input.lotDepth;
    const lotCoveragePercent =
      lotArea > 0 ? (input.structureFootprint / lotArea) * 100 : 0;
    const lotCoverageStatus = checkCompliance(
      lotCoveragePercent,
      input.zoningRules.maxLotCoverage
    );

    const farCalculated = input.proposedFAR;
    const farStatus = checkCompliance(farCalculated, input.zoningRules.maxFAR);

    const setbackResults = [
      {
        side: "Front",
        proposed: input.setbacks.front,
        required: input.zoningRules.minSetbacks.front,
        status: checkSetback(
          input.setbacks.front,
          input.zoningRules.minSetbacks.front
        ),
      },
      {
        side: "Rear",
        proposed: input.setbacks.rear,
        required: input.zoningRules.minSetbacks.front,
        status: checkSetback(
          input.setbacks.rear,
          input.zoningRules.minSetbacks.front
        ),
      },
      {
        side: "Left",
        proposed: input.setbacks.sideLeft,
        required: input.zoningRules.minSetbacks.side,
        status: checkSetback(
          input.setbacks.sideLeft,
          input.zoningRules.minSetbacks.side
        ),
      },
      {
        side: "Right",
        proposed: input.setbacks.sideRight,
        required: input.zoningRules.minSetbacks.side,
        status: checkSetback(
          input.setbacks.sideRight,
          input.zoningRules.minSetbacks.side
        ),
      },
    ];

    const failures = setbackResults.filter((s) => s.status === "fail");
    const warnings = setbackResults.filter((s) => s.status === "warning");

    let summary = `Lot area: ${lotArea.toLocaleString()} sq ft. Coverage: ${lotCoveragePercent.toFixed(1)}% (max ${input.zoningRules.maxLotCoverage}%). FAR: ${farCalculated} (max ${input.zoningRules.maxFAR}).`;

    if (failures.length > 0) {
      summary += ` ${failures.length} setback violation(s) found.`;
    } else if (warnings.length > 0) {
      summary += ` ${warnings.length} setback(s) near the limit.`;
    } else {
      summary += " All setbacks compliant.";
    }

    const result: LotCalculatorResult = {
      lotArea,
      lotCoveragePercent: Math.round(lotCoveragePercent * 100) / 100,
      lotCoverageStatus,
      farCalculated,
      farStatus,
      setbackResults,
      summary,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("lot-calculator error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
