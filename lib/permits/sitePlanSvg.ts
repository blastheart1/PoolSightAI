import type { SitePlanInputs, PoolFeature } from "@/types/permits";
import {
  FEATURE_COLORS,
  FEATURE_CATEGORY,
  DRAW_ORDER,
} from "@/lib/permits/featureRegistry";

const W = 800;
const H = 600;
const PAD = 40;
const TITLE_H = 50;
const DRAW_W = W - PAD * 2;
const DRAW_H = H - PAD * 2 - TITLE_H;
const DECK_PAD_FT = 5;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Rect { x: number; y: number; w: number; h: number }

function ft(val: number, scale: number): number { return val * scale; }

function getDims(
  f: PoolFeature,
  dims: SitePlanInputs["confirmedDimensions"],
): { w: number; h: number } {
  const d = dims[f.id];
  return {
    w: d?.width ?? f.estimatedWidth ?? 10,
    h: d?.length ?? f.estimatedLength ?? 8,
  };
}

function makeScale(inputs: SitePlanInputs): number {
  if (inputs.scale && inputs.scale > 0) return inputs.scale;

  if (inputs.lotWidth && inputs.lotDepth) {
    return Math.min(DRAW_W / inputs.lotWidth, DRAW_H / inputs.lotDepth) * 0.9;
  }

  const features = inputs.confirmedFeatures.filter((f) => f.engineerConfirmed);
  if (!features.length) return 5;

  const totalW = features.reduce((s, f) => {
    const d = inputs.confirmedDimensions?.[f.id];
    return s + (d?.width ?? f.estimatedWidth ?? 12);
  }, 0) + features.length * 4;

  const maxH = Math.max(
    ...features.map((f) => {
      const d = inputs.confirmedDimensions?.[f.id];
      return d?.length ?? f.estimatedLength ?? 12;
    }),
  );

  return Math.min(Math.max(DRAW_W / totalW, 2), Math.min(DRAW_H / (maxH + 20), 10));
}

function cat(f: PoolFeature): string {
  return FEATURE_CATEGORY[f.type] ?? "other";
}

function style(f: PoolFeature) {
  return FEATURE_COLORS[f.type] ?? FEATURE_COLORS.other;
}

function northArrow(dir: SitePlanInputs["north"]): string {
  const cx = W - 50;
  const cy = 50;
  let rot = 0;
  if (dir === "down") rot = 180;
  else if (dir === "left") rot = 270;
  else if (dir === "right") rot = 90;
  return `<g transform="translate(${cx},${cy}) rotate(${rot})">
    <polygon points="0,-18 -8,8 0,2 8,8" fill="#334155" stroke="#0f172a" stroke-width="1"/>
    <text y="-22" text-anchor="middle" font-size="10" fill="#0f172a" font-weight="bold">N</text>
  </g>`;
}

function scaleBar(scale: number): string {
  const barFt = 10;
  const barPx = ft(barFt, scale);
  const x = PAD;
  const y = H - TITLE_H - 15;
  return `<g>
    <line x1="${x}" y1="${y}" x2="${x + barPx}" y2="${y}" stroke="#334155" stroke-width="2"/>
    <line x1="${x}" y1="${y - 4}" x2="${x}" y2="${y + 4}" stroke="#334155" stroke-width="2"/>
    <line x1="${x + barPx}" y1="${y - 4}" x2="${x + barPx}" y2="${y + 4}" stroke="#334155" stroke-width="2"/>
    <text x="${x + barPx / 2}" y="${y + 14}" text-anchor="middle" font-size="9" fill="#475569">${barFt} ft</text>
  </g>`;
}

function titleBlock(address?: string): string {
  const y = H - TITLE_H;
  const dateStr = new Date().toISOString().split("T")[0];
  return `<g>
    <rect x="0" y="${y}" width="${W}" height="${TITLE_H}" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="${PAD}" y="${y + 18}" font-size="11" font-weight="bold" fill="#0f172a">${esc(address || "Address TBC")}</text>
    <text x="${PAD}" y="${y + 34}" font-size="9" fill="#64748b">Generated: ${dateStr}</text>
    <text x="${W - PAD}" y="${y + 18}" text-anchor="end" font-size="9" font-weight="bold" fill="#dc2626">DRAFT — NOT FOR PERMIT SUBMISSION</text>
  </g>`;
}

function watermark(): string {
  return `<text
    x="${W / 2}" y="${H / 2}"
    text-anchor="middle" dominant-baseline="middle"
    font-size="40" fill="#e5e7eb" opacity="0.4"
    transform="rotate(-30,${W / 2},${H / 2})"
    font-weight="bold"
  >AI-GENERATED DRAFT — ENGINEER REVIEW REQUIRED</text>`;
}

export function generateSitePlanSvg(inputs: SitePlanInputs): string {
  const scale = makeScale(inputs);
  const toRender = inputs.confirmedFeatures.filter((f) => f.engineerConfirmed);
  const dims = inputs.confirmedDimensions ?? {};

  const shapes: string[] = [];
  const labels: string[] = [];

  const placed = new Map<string, Rect>();

  const originX = PAD + 10;
  const originY = PAD + 10;
  const lotFtW = inputs.lotWidth ?? 80;
  const lotFtH = inputs.lotDepth ?? 60;
  const lotPxW = ft(lotFtW, scale);
  const lotPxH = ft(lotFtH, scale);

  // Center the lot in the drawable area
  const lotX = originX + Math.max(0, (DRAW_W - lotPxW) / 2);
  const lotY = originY + Math.max(0, (DRAW_H - lotPxH) / 2);

  // Sort features by draw order
  const sorted = [...toRender].sort((a, b) => {
    const oa = DRAW_ORDER[cat(a)] ?? 9;
    const ob = DRAW_ORDER[cat(b)] ?? 9;
    return oa - ob;
  });

  // Classify features into groups
  const waterFeatures = sorted.filter((f) => cat(f) === "water");
  const structFeatures = sorted.filter((f) => cat(f) === "structure");
  const poolZoneDecking = sorted.filter((f) =>
    cat(f) === "hardscape" && (
      f.type === "wood_deck" ||
      f.type === "composite_deck" ||
      f.type === "tile_deck" ||
      f.spatialPosition?.includes("right") ||
      f.deckWrap != null
    ),
  );
  const patioZoneDecking = sorted.filter((f) =>
    cat(f) === "hardscape" && !poolZoneDecking.includes(f),
  );
  const livingFeatures = sorted.filter((f) => cat(f) === "living");
  const boundaryFeatures = sorted.filter((f) => cat(f) === "boundary");
  const landscapeFeatures = sorted.filter((f) => cat(f) === "landscape");
  const mechFeatures = sorted.filter((f) => cat(f) === "mechanical");
  const poolStructFeatures = sorted.filter((f) => cat(f) === "pool_structure");
  const otherFeatures = sorted.filter((f) => cat(f) === "other");

  // --- SVG START ---
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif">`,
  );
  parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);

  // 1. Property boundary
  if (inputs.lotWidth && inputs.lotDepth) {
    parts.push(
      `<rect x="${lotX}" y="${lotY}" width="${lotPxW}" height="${lotPxH}" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="8,4"/>`,
    );
    labels.push(
      `<text x="${lotX + lotPxW / 2}" y="${lotY - 6}" text-anchor="middle" font-size="9" fill="#475569">LOT: ${lotFtW}ft × ${lotFtH}ft</text>`,
    );
  }

  // 2. Setback lines
  if (inputs.zoningData && inputs.lotWidth && inputs.lotDepth) {
    const sb = inputs.zoningData.setbacks;
    const pn = (s: string) => parseFloat(s.replace(/[^\d.]/g, "")) || 0;
    const sf = pn(sb.front), sr = pn(sb.rear), sl = pn(sb.sideLeft), srt = pn(sb.sideRight);
    const sx = lotX + ft(sl, scale);
    const sy = lotY + ft(sf, scale);
    const sw = lotPxW - ft(sl + srt, scale);
    const sh = lotPxH - ft(sf + sr, scale);
    if (sw > 0 && sh > 0) {
      parts.push(
        `<rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="none" stroke="#dc2626" stroke-width="1" stroke-dasharray="4,4"/>`,
      );
      labels.push(`<text x="${sx + 4}" y="${sy - 3}" font-size="7" fill="#dc2626">SETBACK</text>`);
    }
  }

  // 3. Landscape — background fill for remaining lot area
  for (const f of landscapeFeatures) {
    const d = getDims(f, dims);
    const pw = ft(d.w, scale);
    const ph = ft(d.h, scale);
    const r: Rect = { x: lotX + 2, y: lotY + 2, w: Math.min(pw, lotPxW - 4), h: Math.min(ph, lotPxH - 4) };
    placed.set(f.id, r);
    const s = style(f);
    shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="0.8" opacity="0.5"${s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : ""}/>`);
  }

  // 4. Boundary features — lot perimeter inset
  for (const f of boundaryFeatures) {
    const s = style(f);
    const inset = ft(1, scale);
    const r: Rect = { x: lotX + inset, y: lotY + inset, w: lotPxW - inset * 2, h: lotPxH - inset * 2 };
    placed.set(f.id, r);
    shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"${s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : ""}/>`);
    labels.push(`<text x="${r.x + 6}" y="${r.y + r.h - 6}" font-size="8" fill="${s.text}">${esc(f.label)}</text>`);
  }

  // 5. House footprint
  let houseRect: Rect | null = null;
  if (inputs.houseFootprintWidth && inputs.houseFootprintDepth) {
    const hw = ft(inputs.houseFootprintWidth, scale);
    const hh = ft(inputs.houseFootprintDepth, scale);
    const setF = ft(inputs.houseSetbackFromFront ?? 15, scale);
    const setL = ft(inputs.houseSetbackFromLeft ?? 5, scale);
    houseRect = { x: lotX + setL, y: lotY + setF, w: hw, h: hh };
    shapes.push(`<rect x="${houseRect.x}" y="${houseRect.y}" width="${hw}" height="${hh}" fill="#e2e8f0" stroke="#334155" stroke-width="1.5"/>`);
    labels.push(`<text x="${houseRect.x + hw / 2}" y="${houseRect.y + hh / 2 + 4}" text-anchor="middle" font-size="10" fill="#334155" font-weight="bold">EXISTING HOUSE</text>`);
  }

  // 6. Large structures (covered_patio, pergola) — LEFT zone or outer frame
  let patioZoneBottom = lotY + ft(3, scale);
  for (const f of structFeatures) {
    const d = getDims(f, dims);
    let pw: number;
    let ph: number;
    let rx: number;
    let ry: number;

    const isOuterFrame =
      f.type === "pergola" &&
      (f.spatialPosition === "center" || (!d.w && !d.h)) &&
      !f.containedIn;

    if (isOuterFrame) {
      pw = lotPxW - ft(1, scale);
      ph = lotPxH - ft(1, scale);
      rx = lotX + ft(0.5, scale);
      ry = lotY + ft(0.5, scale);
    } else {
      pw = Math.min(ft(d.w, scale), lotPxW * 0.45);
      ph = ft(d.h, scale);
      rx = lotX + ft(2, scale);
      ry = patioZoneBottom;
      patioZoneBottom = ry + Math.min(ph, lotPxH - ft(6, scale)) + ft(2, scale);
      ph = Math.min(ph, lotPxH - ft(6, scale));
    }

    const r: Rect = { x: rx, y: ry, w: pw, h: ph };
    placed.set(f.id, r);
    const s = style(f);
    shapes.push(
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"` +
      ` rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}"` +
      ` stroke-width="1.5"` +
      (s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : "") +
      `/>`,
    );
  }

  // 6b. Patio-zone decking (concrete_deck etc.) in left zone
  let patioHsCursorY = lotY + ft(2, scale);
  let patioRect: Rect | null = null;

  for (const f of patioZoneDecking) {
    const d = getDims(f, dims);
    const pw = d.w ? ft(d.w, scale) : lotPxW * 0.45;
    const ph = d.h ? ft(d.h, scale) : lotPxH - ft(4, scale);

    const r: Rect = {
      x: lotX + ft(2, scale),
      y: patioHsCursorY,
      w: pw,
      h: ph,
    };
    placed.set(f.id, r);
    if (!patioRect) patioRect = r;
    patioHsCursorY += ph + ft(2, scale);

    const s = style(f);
    shapes.push(
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"` +
      ` rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"` +
      (s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : "") +
      `/>`,
    );
  }

  // 7 + 8 + 9. Pool zone — CENTER-RIGHT
  const poolZoneX = lotX + lotPxW * 0.48;

  let poolCursorY = lotY + (lotPxH * 0.2);
  const waterRects: Rect[] = [];

  for (const f of waterFeatures) {
    const d = getDims(f, dims);
    const pw = ft(d.w, scale);
    const ph = ft(d.h, scale);
    const r: Rect = { x: poolZoneX, y: poolCursorY, w: pw, h: ph };
    placed.set(f.id, r);
    waterRects.push(r);
    poolCursorY += ph + ft(1, scale);
    const s = style(f);
    shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.5"${s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : ""}/>`);
  }

  // Decking bounding box around water features
  if (waterRects.length > 0) {
    const deckPad = ft(DECK_PAD_FT, scale);
    const minX = Math.min(...waterRects.map((r) => r.x));
    const minY = Math.min(...waterRects.map((r) => r.y));
    const maxX = Math.max(...waterRects.map((r) => r.x + r.w));
    const maxY = Math.max(...waterRects.map((r) => r.y + r.h));
    const deckRect: Rect = {
      x: minX - deckPad,
      y: minY - deckPad,
      w: maxX - minX + deckPad * 2,
      h: maxY - minY + deckPad * 2,
    };

    // Pool-zone decking wraps around water features
    for (const f of poolZoneDecking) {
      placed.set(f.id, deckRect);
      const s = style(f);
      shapes.push(
        `<rect x="${deckRect.x}" y="${deckRect.y}"` +
        ` width="${deckRect.w}" height="${deckRect.h}"` +
        ` rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"` +
        (s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : "") +
        `/>`,
      );
    }

    // Re-draw water features on top of deck
    for (const f of waterFeatures) {
      const r = placed.get(f.id)!;
      const s = style(f);
      shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.5"${s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : ""}/>`);
    }
  } else {
    // No water features — place pool-zone decking independently
    let hsCursor = lotY + lotPxH * 0.3;
    for (const f of poolZoneDecking) {
      const d = getDims(f, dims);
      const pw = ft(d.w, scale);
      const ph = ft(d.h, scale);
      const r: Rect = { x: poolZoneX, y: hsCursor, w: pw, h: ph };
      placed.set(f.id, r);
      hsCursor += ph + ft(2, scale);
      const s = style(f);
      shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"${s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : ""}/>`);
    }
  }

  // 10. Pool structure features — on pool edges
  if (waterRects.length > 0) {
    const poolRect = waterRects[0];
    let psCursorY = poolRect.y;
    for (const f of poolStructFeatures) {
      const d = getDims(f, dims);
      const pw = Math.min(ft(d.w, scale), poolRect.w);
      const ph = ft(Math.min(d.h, 3), scale);
      const r: Rect = { x: poolRect.x, y: psCursorY, w: pw, h: ph };
      placed.set(f.id, r);
      psCursorY += ph;
      const s = style(f);
      shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="0.8"${s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : ""}/>`);
    }
  }

  // 11. Living features — positioned via containedIn + spatialPosition
  function getParentRect(
    f: PoolFeature,
    placedMap: Map<string, Rect>,
    fallback: Rect,
  ): Rect {
    if (f.containedIn) {
      const parent = placedMap.get(f.containedIn);
      if (parent) return parent;
    }
    return fallback;
  }

  function positionInsideParent(
    parent: Rect,
    fw: number,
    fh: number,
    pos: string | null | undefined,
    cursor: number,
    innerPadding: number,
  ): { x: number; y: number } {
    const cx = parent.x + innerPadding;

    switch (pos) {
      case "top-left":
        return { x: parent.x + innerPadding, y: parent.y + innerPadding * 2 };
      case "top-right":
        return { x: parent.x + parent.w - fw - innerPadding, y: parent.y + innerPadding * 2 };
      case "bottom-left":
        return { x: parent.x + innerPadding, y: parent.y + parent.h - fh - innerPadding };
      case "bottom-right":
        return { x: parent.x + parent.w - fw - innerPadding, y: parent.y + parent.h - fh - innerPadding };
      case "center":
      case "center-left":
      case "center-right":
        return { x: cx, y: cursor };
      default:
        return { x: cx, y: cursor };
    }
  }

  const concreteDecks = patioZoneDecking.filter((f) => f.type === "concrete_deck");
  const defaultParent: Rect =
    concreteDecks.length > 0 && placed.get(concreteDecks[0].id)
      ? placed.get(concreteDecks[0].id)!
      : patioRect ?? { x: lotX + ft(2, scale), y: lotY + ft(3, scale), w: lotPxW * 0.45, h: lotPxH * 0.8 };

  const innerPad = ft(3, scale);
  let livingCursorY = defaultParent.y + innerPad * 2;

  for (const f of livingFeatures) {
    const parent = getParentRect(f, placed, defaultParent);
    const d = getDims(f, dims);
    const fw = Math.min(ft(d.w, scale), parent.w - innerPad * 2);
    const fh = ft(d.h, scale);

    const hasExplicitPos = f.spatialPosition != null &&
      ["top-left", "top-right", "bottom-left", "bottom-right"].includes(f.spatialPosition);

    const pos = hasExplicitPos
      ? positionInsideParent(parent, fw, fh, f.spatialPosition, livingCursorY, innerPad)
      : { x: parent.x + innerPad, y: livingCursorY };

    const r: Rect = { x: pos.x, y: pos.y, w: fw, h: fh };
    placed.set(f.id, r);

    if (!hasExplicitPos) {
      livingCursorY += fh + ft(2, scale);
    }

    const s = style(f);
    shapes.push(
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"` +
      ` rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"` +
      (s.strokeDash ? ` stroke-dasharray="${s.strokeDash}"` : "") +
      `/>`,
    );
  }

  // 12. Mechanical — right edge, bottom-aligned
  const waterRight = waterRects.length > 0
    ? Math.max(...waterRects.map((r) => r.x + r.w))
    : poolZoneX + ft(20, scale);
  let mechCursorY = lotY + lotPxH - ft(3, scale);
  for (const f of mechFeatures) {
    const d = getDims(f, dims);
    const pw = ft(d.w, scale);
    const ph = ft(d.h, scale);
    mechCursorY -= ph;
    const r: Rect = { x: waterRight + ft(2, scale), y: mechCursorY, w: pw, h: ph };
    placed.set(f.id, r);
    mechCursorY -= ft(1, scale);
    const s = style(f);
    shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"/>`);
  }

  // "other" features — stack below living inside default parent
  for (const f of otherFeatures) {
    const d = getDims(f, dims);
    const pw = Math.min(ft(d.w, scale), defaultParent.w - innerPad * 2);
    const ph = ft(d.h, scale);
    const r: Rect = { x: defaultParent.x + innerPad, y: livingCursorY, w: pw, h: ph };
    placed.set(f.id, r);
    livingCursorY += ph + ft(2, scale);
    const s = style(f);
    shapes.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${s.rx ?? 0}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1"/>`);
  }

  // 13. Labels — second pass, always on top
  for (const f of sorted) {
    const r = placed.get(f.id);
    if (!r) continue;
    const s = style(f);
    const d = dims[f.id];
    const dw = d?.width ?? f.estimatedWidth;
    const dl = d?.length ?? f.estimatedLength;

    const hasFill = s.fill !== "none";
    const isLargeEnough = r.w > 40 && r.h > 24;
    const isWideEnough = r.w > 30;

    if (!isWideEnough) continue;

    if (hasFill && isLargeEnough) {
      labels.push(
        `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="${s.text}" font-weight="bold">${esc(f.label)}</text>`,
      );
      if (dw && dl) {
        labels.push(
          `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 13}" text-anchor="middle" font-size="9" fill="${s.text}">${dw}ft × ${dl}ft</text>`,
        );
      } else {
        labels.push(
          `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 13}" text-anchor="middle" font-size="9" fill="#f97316" font-weight="bold">TBC</text>`,
        );
      }
    } else {
      labels.push(
        `<text x="${r.x + r.w / 2}" y="${r.y - 10}" text-anchor="middle" font-size="9" fill="${s.text}" font-weight="bold">${esc(f.label)}</text>`,
      );
      if (dw && dl) {
        labels.push(
          `<text x="${r.x + r.w / 2}" y="${r.y - 1}" text-anchor="middle" font-size="8" fill="${s.text}">${dw}ft × ${dl}ft</text>`,
        );
      } else {
        labels.push(
          `<text x="${r.x + r.w / 2}" y="${r.y - 1}" text-anchor="middle" font-size="8" fill="#f97316" font-weight="bold">TBC</text>`,
        );
      }
    }
  }

  // Assemble: shapes → labels → chrome
  parts.push(...shapes);
  parts.push(...labels);
  parts.push(northArrow(inputs.north ?? "up"));
  parts.push(scaleBar(scale));
  parts.push(titleBlock(inputs.address));
  parts.push(watermark());
  parts.push("</svg>");

  return parts.join("\n");
}
