import type { SitePlanInputs, PoolFeature } from "@/types/permits";

const LAYER_COLORS: Record<string, number> = {
  "PROPERTY-LINE": 7,
  "EXISTING-STRUCT": 2,
  POOL: 4,
  SPA: 5,
  DECKING: 3,
  EQUIPMENT: 8,
  "SETBACK-LINES": 1,
  DIMENSIONS: 7,
  NOTES: 7,
  "TITLE-BLOCK": 7,
  DISCLAIMER: 1,
};

const FEATURE_LAYER: Record<string, string> = {
  pool: "POOL",
  spa: "SPA",
  baja_shelf: "POOL",
  water_feature: "POOL",
  equipment_pad: "EQUIPMENT",
  decking: "DECKING",
  retaining_wall: "EXISTING-STRUCT",
  fence: "PROPERTY-LINE",
  gate: "PROPERTY-LINE",
  covered_patio: "EXISTING-STRUCT",
  existing_structure: "EXISTING-STRUCT",
  other: "NOTES",
};

function line(x1: number, y1: number, x2: number, y2: number, layer: string): string {
  return [
    "0", "LINE",
    "8", layer,
    "10", x1.toFixed(4),
    "20", y1.toFixed(4),
    "30", "0.0000",
    "11", x2.toFixed(4),
    "21", y2.toFixed(4),
    "31", "0.0000",
  ].join("\n");
}

function rect(x: number, y: number, w: number, h: number, layer: string): string {
  return [
    line(x, y, x + w, y, layer),
    line(x + w, y, x + w, y + h, layer),
    line(x + w, y + h, x, y + h, layer),
    line(x, y + h, x, y, layer),
  ].join("\n");
}

function text(
  x: number, y: number, height: number, content: string, layer: string,
): string {
  return [
    "0", "TEXT",
    "8", layer,
    "10", x.toFixed(4),
    "20", y.toFixed(4),
    "30", "0.0000",
    "40", height.toFixed(4),
    "1", content,
  ].join("\n");
}

function headerSection(): string {
  return [
    "0", "SECTION",
    "2", "HEADER",
    "9", "$INSUNITS",
    "70", "2",
    "9", "$ACADVER",
    "1", "AC1009",
    "0", "ENDSEC",
  ].join("\n");
}

function tablesSection(): string {
  const layers = Object.entries(LAYER_COLORS);
  const parts: string[] = [
    "0", "SECTION",
    "2", "TABLES",
    "0", "TABLE",
    "2", "LAYER",
    "70", String(layers.length),
  ];

  for (const [name, color] of layers) {
    parts.push(
      "0", "LAYER",
      "2", name,
      "70", "0",
      "62", String(color),
      "6", name === "SETBACK-LINES" ? "DASHED" : "CONTINUOUS",
    );
  }

  parts.push("0", "ENDTAB");
  parts.push("0", "ENDSEC");
  return parts.join("\n");
}

function featurePosition(
  f: PoolFeature,
  dims: SitePlanInputs["confirmedDimensions"],
  idx: number,
  houseX: number,
  houseY: number,
  houseH: number,
): { x: number; y: number; w: number; h: number } {
  const d = dims[f.id];
  const w = d?.width ?? f.estimatedWidth ?? 12;
  const h = d?.length ?? f.estimatedLength ?? 8;
  const x = houseX + 2 + idx * 2;
  const y = houseY - houseH - 5 - h;
  return { x, y: y, w, h };
}

export function generateSitePlanDxf(inputs: SitePlanInputs): string {
  const toRender = inputs.confirmedFeatures.filter((f) => f.engineerConfirmed);
  const entities: string[] = [];

  const lotW = inputs.lotWidth ?? 60;
  const lotD = inputs.lotDepth ?? 120;

  // Property boundary
  entities.push(rect(0, 0, lotW, lotD, "PROPERTY-LINE"));
  entities.push(text(lotW / 2, lotD + 2, 1.5, `LOT: ${lotW}ft x ${lotD}ft`, "PROPERTY-LINE"));

  // Setback lines
  if (inputs.zoningData) {
    const sb = inputs.zoningData.setbacks;
    const parseNum = (s: string) => parseFloat(s.replace(/[^\d.]/g, "")) || 0;
    const f = parseNum(sb.front);
    const r = parseNum(sb.rear);
    const sl = parseNum(sb.sideLeft);
    const sr = parseNum(sb.sideRight);
    const sx = sl;
    const sy = f;
    const sw = lotW - sl - sr;
    const sh = lotD - f - r;
    if (sw > 0 && sh > 0) {
      entities.push(rect(sx, sy, sw, sh, "SETBACK-LINES"));
    }
  }

  // House footprint
  const houseW = inputs.houseFootprintWidth ?? 0;
  const houseD = inputs.houseFootprintDepth ?? 0;
  const houseSetF = inputs.houseSetbackFromFront ?? 20;
  const houseSetL = inputs.houseSetbackFromLeft ?? 5;
  const houseX = houseSetL;
  const houseY = houseSetF;

  if (houseW > 0 && houseD > 0) {
    entities.push(rect(houseX, houseY, houseW, houseD, "EXISTING-STRUCT"));
    entities.push(
      text(houseX + houseW / 2, houseY + houseD / 2, 1.5, "EXISTING HOUSE", "EXISTING-STRUCT"),
    );
  }

  // Features
  toRender.forEach((feat, i) => {
    const layer = FEATURE_LAYER[feat.type] ?? "NOTES";
    const pos = featurePosition(feat, inputs.confirmedDimensions, i, houseX, houseY + houseD, houseD);

    entities.push(rect(pos.x, pos.y, pos.w, pos.h, layer));
    entities.push(text(pos.x + pos.w / 2, pos.y + pos.h / 2, 1.0, feat.label, layer));

    const dims = inputs.confirmedDimensions[feat.id];
    const dw = dims?.width ?? feat.estimatedWidth;
    const dl = dims?.length ?? feat.estimatedLength;
    if (dw && dl) {
      entities.push(text(pos.x, pos.y - 1.5, 0.8, `${dw}ft x ${dl}ft`, "DIMENSIONS"));
    } else {
      entities.push(text(pos.x, pos.y - 1.5, 0.8, "DIM TBC", "NOTES"));
    }
  });

  // Title block
  const dateStr = new Date().toISOString().split("T")[0];
  entities.push(text(0, -5, 1.5, inputs.address || "Address TBC", "TITLE-BLOCK"));
  entities.push(text(0, -8, 1.0, `Generated: ${dateStr}`, "TITLE-BLOCK"));
  entities.push(text(lotW, -5, 1.0, "DRAFT - NOT FOR PERMIT SUBMISSION", "TITLE-BLOCK"));

  // Disclaimer
  entities.push(
    text(0, 0, 2.0, "AI-GENERATED DRAFT - FOR ENGINEER USE ONLY - NOT FOR PERMIT SUBMISSION", "DISCLAIMER"),
  );

  // Assemble DXF
  const parts: string[] = [];
  parts.push(headerSection());
  parts.push(tablesSection());
  parts.push(["0", "SECTION", "2", "ENTITIES"].join("\n"));
  parts.push(entities.join("\n"));
  parts.push(["0", "ENDSEC"].join("\n"));
  parts.push(["0", "EOF"].join("\n"));

  return parts.join("\n");
}
