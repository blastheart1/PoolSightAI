/**
 * Tests for PATCH /api/projects/[id]/contract-items/bulk-progress
 *
 * Critical invariants:
 *   1. Only explicitly listed items are updated; untouched items stay unchanged.
 *   2. completedAmount = amount × pct / 100.
 *   3. Progress out of range (< 0 or > 100) is rejected with 400.
 *   4. Items that belong to a different project are silently skipped.
 *   5. AI result line items are marked applied only when analysisResultLineItemId is provided.
 *   6. Empty or missing updates array → 400.
 *   7. Missing project → 404.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockDb, querySpy } from "./helpers/mockDb";

vi.mock("../../lib/db", () => ({ db: mockDb }));
vi.mock("next/server", async () => vi.importActual("next/server"));

const route = await import(
  "../../app/api/projects/[id]/contract-items/bulk-progress/route"
);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-abc";

const project = { id: PROJECT_ID, name: "Torres Remodel" };

const item1 = { id: "ci-1", projectId: PROJECT_ID, rowIndex: 0, productService: "Excavation", amount: "50000", progressOverallPct: "0",   completedAmount: "0"     };
const item2 = { id: "ci-2", projectId: PROJECT_ID, rowIndex: 1, productService: "Plumbing",   amount: "30000", progressOverallPct: "25",  completedAmount: "7500"  };
const item3 = { id: "ci-3", projectId: PROJECT_ID, rowIndex: 2, productService: "Electrical", amount: "20000", progressOverallPct: "50",  completedAmount: "10000" };

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://localhost/api/projects/${PROJECT_ID}/contract-items/bulk-progress`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
}

function makeParams(id = PROJECT_ID) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => mockDb.__reset());

// ── Basic success ─────────────────────────────────────────────────────────────

describe("bulk-progress — basic success", () => {
  it("updates one item and returns completedAmount", async () => {
    // project check, item ownership check, update contract item
    mockDb.__queue([project], [item1], []);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: 40 }] }),
      makeParams()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toHaveLength(1);
    expect(body.updated[0]).toMatchObject({
      contractItemId: "ci-1",
      newProgressPct: 40,
      completedAmount: "20000", // 50000 × 40 / 100
    });
  });

  it("updates multiple items in one call", async () => {
    mockDb.__queue([project], [item1], [], [item2], []);
    const res = await route.PATCH(
      makeRequest({
        updates: [
          { contractItemId: "ci-1", newProgressPct: 100 },
          { contractItemId: "ci-2", newProgressPct: 75  },
        ],
      }),
      makeParams()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toHaveLength(2);
    expect(body.updated[0]).toMatchObject({ contractItemId: "ci-1", newProgressPct: 100, completedAmount: "50000" });
    expect(body.updated[1]).toMatchObject({ contractItemId: "ci-2", newProgressPct: 75,  completedAmount: "22500" });
  });
});

// ── Isolation — only listed items updated ─────────────────────────────────────

describe("bulk-progress — isolation (other items must not change)", () => {
  it("issues exactly one db update when only one item is in the payload", async () => {
    mockDb.__queue([project], [item1], []);
    await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: 60 }] }),
      makeParams()
    );
    // querySpy call order: project select, item select, item update
    // Exactly 3 querySpy calls — no extra updates for item2 or item3
    expect(querySpy).toHaveBeenCalledTimes(3);
  });

  it("skips items that belong to a different project (ownership check fails)", async () => {
    // item ownership check returns empty → item belongs to another project or doesn't exist
    mockDb.__queue([project], []);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-foreign", newProgressPct: 50 }] }),
      makeParams()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toHaveLength(0);
    // Only 2 querySpy calls: project check + ownership check (no update issued)
    expect(querySpy).toHaveBeenCalledTimes(2);
  });

  it("updates valid items and skips items not found in project", async () => {
    mockDb.__queue(
      [project],    // project check
      [item1],      // ci-1 found ✓
      [],           // update ci-1
      [],           // ci-foreign NOT found → skip
      [item3],      // ci-3 found ✓
      [],           // update ci-3
    );
    const res = await route.PATCH(
      makeRequest({
        updates: [
          { contractItemId: "ci-1",       newProgressPct: 50  },
          { contractItemId: "ci-foreign", newProgressPct: 100 },
          { contractItemId: "ci-3",       newProgressPct: 75  },
        ],
      }),
      makeParams()
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updated).toHaveLength(2);
    expect(body.updated.map((u: { contractItemId: string }) => u.contractItemId)).toEqual(["ci-1", "ci-3"]);
  });
});

// ── completedAmount calculation ───────────────────────────────────────────────

describe("bulk-progress — completedAmount calculation", () => {
  it("computes amount × pct / 100", async () => {
    mockDb.__queue([project], [{ ...item1, amount: "100000" }], []);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: 33 }] }),
      makeParams()
    );
    expect((await res.json()).updated[0].completedAmount).toBe("33000");
  });

  it("returns null completedAmount when item has no amount", async () => {
    mockDb.__queue([project], [{ ...item1, amount: null }], []);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: 50 }] }),
      makeParams()
    );
    expect((await res.json()).updated[0].completedAmount).toBeNull();
  });

  it("handles 0% correctly (completedAmount = 0)", async () => {
    mockDb.__queue([project], [item2], []);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-2", newProgressPct: 0 }] }),
      makeParams()
    );
    expect((await res.json()).updated[0].completedAmount).toBe("0");
  });

  it("handles 100% correctly (completedAmount = full amount)", async () => {
    mockDb.__queue([project], [item2], []);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-2", newProgressPct: 100 }] }),
      makeParams()
    );
    expect((await res.json()).updated[0].completedAmount).toBe("30000");
  });
});

// ── Boundary / validation ─────────────────────────────────────────────────────

describe("bulk-progress — validation", () => {
  it("rejects progress below 0", async () => {
    mockDb.__queue([project], [item1]);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: -1 }] }),
      makeParams()
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/0.?100|invalid/i);
  });

  it("rejects progress above 100", async () => {
    mockDb.__queue([project], [item1]);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: 101 }] }),
      makeParams()
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when updates array is empty", async () => {
    mockDb.__queue([project]);
    const res = await route.PATCH(makeRequest({ updates: [] }), makeParams());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/empty|required/i);
  });

  it("returns 400 when updates field is missing", async () => {
    mockDb.__queue([project]);
    const res = await route.PATCH(makeRequest({}), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 404 when project not found", async () => {
    mockDb.__queue([]);
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: 50 }] }),
      makeParams()
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 on unexpected db error", async () => {
    querySpy.mockRejectedValueOnce(new Error("db crash"));
    const res = await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: 50 }] }),
      makeParams()
    );
    expect(res.status).toBe(500);
  });
});

// ── AI result line item tracking ──────────────────────────────────────────────

describe("bulk-progress — AI result tracking", () => {
  it("marks analysisResultLineItemId as applied when provided", async () => {
    // project check, item ownership, update contractItem, update aiAnalysisResultLineItem
    mockDb.__queue([project], [item1], [], []);
    const res = await route.PATCH(
      makeRequest({
        updates: [{
          contractItemId:          "ci-1",
          newProgressPct:           80,
          analysisResultLineItemId: "ai-result-99",
        }],
      }),
      makeParams()
    );
    expect(res.status).toBe(200);
    // 4 querySpy calls: project + item + contractItem update + aiResult update
    expect(querySpy).toHaveBeenCalledTimes(4);
  });

  it("does NOT issue an AI result update when analysisResultLineItemId is absent", async () => {
    mockDb.__queue([project], [item1], []);
    await route.PATCH(
      makeRequest({ updates: [{ contractItemId: "ci-1", newProgressPct: 50 }] }),
      makeParams()
    );
    // 3 querySpy calls: project + item + contractItem update (no AI update)
    expect(querySpy).toHaveBeenCalledTimes(3);
  });
});
