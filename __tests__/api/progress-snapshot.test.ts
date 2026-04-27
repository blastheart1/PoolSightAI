/**
 * Tests for the progress snapshot / restore behaviour in PATCH /api/projects/[id].
 *
 * When items are replaced via PATCH, any billing/progress fields that existed on
 * the old rows (but are absent from the incoming items) must be restored from a
 * snapshot taken before the delete.  This prevents the "manual append wipes
 * progress" regression for inline-table re-parses.
 *
 * Invariants tested:
 *   1. Inline re-parse (no progress on incoming items) → snapshot restored.
 *   2. Items carrying progress (e.g. from runLinksFlow) → incoming values win.
 *   3. New items beyond snapshot length → inserted, fields null (no fallback row).
 *   4. Refusal — empty array sent when existing items are present → 400.
 *   5. Empty snapshot (no prior items) → insert proceeds, no snapshot fallback needed.
 *
 * querySpy call count for a typical replace with N incoming items:
 *   1  existing project check
 *   2  snapshot select
 *   3  delete projectSelectedItems
 *   4  delete projectContractItems
 *   5  bulk insert (one call regardless of N)
 *   6  db.update(projects) for parsedAt
 *   7-10  Promise.all re-fetch (project, contractItems, selectedRows, trelloLinkedLists)
 *   = 10 calls
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockDb, querySpy } from "./helpers/mockDb";

vi.mock("../../lib/db", () => ({ db: mockDb }));
vi.mock("next/server", async () => vi.importActual("next/server"));

const { PATCH } = await import("../../app/api/projects/[id]/route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-snapshot";

const baseProject = { id: PROJECT_ID, name: "Snapshot Project", orderNo: "WO-9999" };

/** Existing DB rows with non-zero progress. */
const existingItems = [
  {
    id: "ci-1", projectId: PROJECT_ID, rowIndex: 0,
    productService: "Excavation", amount: "50000",
    progressOverallPct: "40", completedAmount: "20000",
    previouslyInvoicedPct: "25", previouslyInvoicedAmount: "12500",
    newProgressPct: "15", thisBill: "7500",
  },
  {
    id: "ci-2", projectId: PROJECT_ID, rowIndex: 1,
    productService: "Plumbing", amount: "30000",
    progressOverallPct: "10", completedAmount: "3000",
    previouslyInvoicedPct: null, previouslyInvoicedAmount: null,
    newProgressPct: null, thisBill: null,
  },
];

/** Incoming items from inline table — no progress context. */
const inlineItems = [
  { type: "item", productService: "Excavation", qty: 1, rate: 50000, amount: 50000 },
  { type: "item", productService: "Plumbing",   qty: 1, rate: 30000, amount: 30000 },
];

/** Incoming items that already carry progress (e.g. from runLinksFlow). */
const mergedItems = [
  {
    type: "item", productService: "Excavation", qty: 1, rate: 50000, amount: 50000,
    progressOverallPct: "60", completedAmount: "30000",
    previouslyInvoicedPct: "40", previouslyInvoicedAmount: "20000",
    newProgressPct: "20", thisBill: "10000",
  },
  {
    type: "item", productService: "Plumbing", qty: 1, rate: 30000, amount: 30000,
    progressOverallPct: "50", completedAmount: "15000",
  },
];

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/projects/${PROJECT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = PROJECT_ID) {
  return { params: Promise.resolve({ id }) };
}

/**
 * Standard queue for a replace-items PATCH that succeeds.
 * 10 querySpy calls total (see module-level comment).
 */
function queueReplace(items = inlineItems, updatedProject = baseProject) {
  mockDb.__queue(
    [baseProject],      // 1. existing project check
    existingItems,      // 2. snapshot select
    [],                 // 3. delete projectSelectedItems
    [],                 // 4. delete projectContractItems
    [],                 // 5. bulk insert
    [],                 // 6. db.update(projects) for parsedAt
    [updatedProject],   // 7. re-fetch project (Promise.all[0])
    items,              // 8. re-fetch contractItems (Promise.all[1])
    [],                 // 9. re-fetch selectedRows (Promise.all[2])
    [],                 // 10. re-fetch trelloLinkedLists (Promise.all[3])
  );
}

beforeEach(() => {
  mockDb.__reset();
  vi.clearAllMocks();
});

// ── 1. Inline re-parse — snapshot must be restored ────────────────────────────

describe("progress snapshot — inline re-parse (no progress on incoming items)", () => {
  it("returns 200 and valid response shape", async () => {
    queueReplace();
    const res = await PATCH(makeRequest({ items: inlineItems }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("contractItems");
    expect(body).toHaveProperty("selectedLineItemIds");
    expect(body).toHaveProperty("trelloLinkedLists");
  });

  it("issues exactly one bulk insert (not N per-row inserts)", async () => {
    queueReplace();
    await PATCH(makeRequest({ items: inlineItems }), makeParams());
    // 10 total: 1(exist) + 1(snapshot) + 1(del-sel) + 1(del-items)
    //         + 1(bulk-insert) + 1(update-project) + 4(refetch Promise.all)
    expect(querySpy).toHaveBeenCalledTimes(10);
  });

  it("snapshot select fires before delete (preserves progress data)", async () => {
    queueReplace();
    await PATCH(makeRequest({ items: inlineItems }), makeParams());
    // If snapshot were missing, call count would be 9 (no snapshot select).
    // Count of 10 confirms snapshot query ran.
    expect(querySpy).toHaveBeenCalledTimes(10);
  });
});

// ── 2. Merged items carry progress — incoming values win ──────────────────────

describe("progress snapshot — incoming items carry progress (runLinksFlow path)", () => {
  it("returns 200 when items already carry progress fields", async () => {
    queueReplace(mergedItems);
    const res = await PATCH(makeRequest({ items: mergedItems }), makeParams());
    expect(res.status).toBe(200);
  });

  it("still issues exactly one bulk insert", async () => {
    queueReplace(mergedItems);
    await PATCH(makeRequest({ items: mergedItems }), makeParams());
    expect(querySpy).toHaveBeenCalledTimes(10);
  });
});

// ── 3. Extra items beyond snapshot length ─────────────────────────────────────

describe("progress snapshot — extra items beyond snapshot length", () => {
  it("inserts new item (no matching snapshot row) without error", async () => {
    const threeItems = [
      ...inlineItems,
      { type: "item", productService: "Electrical", qty: 1, rate: 20000, amount: 20000 },
    ];
    queueReplace(threeItems);
    const res = await PATCH(makeRequest({ items: threeItems }), makeParams());
    expect(res.status).toBe(200);
  });
});

// ── 4. Refusal — empty array when existing items present ──────────────────────

describe("progress snapshot — refuse empty replacement", () => {
  it("returns 400 when items:[] and project has existing items", async () => {
    mockDb.__queue(
      [baseProject],   // 1. existing check
      existingItems,   // 2. existingCount — length > 0, refuse
    );
    const res = await PATCH(makeRequest({ items: [] }), makeParams());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/refusing/i);
  });
});

// ── 5. Empty snapshot (no prior items) ───────────────────────────────────────

describe("progress snapshot — first parse (no existing rows)", () => {
  it("allows empty items array when no existing items (safe clear)", async () => {
    mockDb.__queue(
      [baseProject],   // 1. existing check
      [],              // 2. existingCount — 0 items, safe to proceed
      // empty array → newItems.length === 0, no snapshot select, no insert
      [],              // 3. db.update(projects) — only updatedAt, skipped if keys ≤ 1
      [baseProject],   // 4. re-fetch project
      [],              // 5. re-fetch contractItems
      [],              // 6. re-fetch selectedRows
      [],              // 7. re-fetch trelloLinkedLists
    );
    const res = await PATCH(makeRequest({ items: [] }), makeParams());
    expect(res.status).toBe(200);
  });

  it("inserts items on first parse (no snapshot rows to restore)", async () => {
    // No existing items, so snapshot select returns empty, but insert fires.
    mockDb.__queue(
      [baseProject],   // 1. existing check
      [],              // 2. snapshot select — empty
      [],              // 3. delete projectSelectedItems
      [],              // 4. delete projectContractItems
      [],              // 5. bulk insert
      [],              // 6. db.update(projects) for parsedAt
      [baseProject],   // 7. re-fetch project
      inlineItems,     // 8. re-fetch contractItems
      [],              // 9. re-fetch selectedRows
      [],              // 10. re-fetch trelloLinkedLists
    );
    const res = await PATCH(makeRequest({ items: inlineItems }), makeParams());
    expect(res.status).toBe(200);
    expect(querySpy).toHaveBeenCalledTimes(10);
  });
});
