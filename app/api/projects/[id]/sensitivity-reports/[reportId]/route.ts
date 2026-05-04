import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../../lib/db";
import { projectSensitivityReports } from "../../../../../../lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { reportId } = await params;

  const [report] = await db
    .select()
    .from(projectSensitivityReports)
    .where(eq(projectSensitivityReports.id, reportId));

  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(report);
}
