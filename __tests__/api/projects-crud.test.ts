/**
 * Tests for:
 *   GET  /api/projects             → list all projects
 *   POST /api/projects             → create project + contract items
 *   GET  /api/projects/[id]        → project with items + selectedLineItemIds
 *   PATCH /api/projects/[id]       → update name / location / items / selectedIds
 *   DELETE /api/projects/[id]      → hard delete, returns 204
 *
 * DB is fully mocked — no real connection required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { mockDb, querySpy } from "./helpers/mockDb";

vi.mock("../../lib/db", () => ({ db: mockDb }));
vi.mock("next/server", async () => vi.importActual("next/server"));

const projectsRoute  = await import("../../app/api/projects/route");
const projectIdRoute = await import("../../app/api/projects/[id]/route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_ID = "proj-uuid-1";

const baseProject = {
  id:              PROJECT_ID,
  name:            "Smith Residence",
  orderNo:         "WO-1048",
  streetAddress:   "1842 Canyon Ridge Dr",
  city:            "Newport Beach",
  state:           "CA",
  zip:             "92660",
  clientName:      "Evan Smith",
  orderGrandTotal: "248600",
  parsedAt:        new Date("2026-04-24"),
  createdAt:       new Date("2026-04-24"),
  updatedAt:       new Date("2026-04-24"),
  trelloLinks:     null,
};

const contractItems = [
  { id: "item-1", projectId: PROJECT_ID, rowIndex: 0, itemType: "maincategory", productService: "Pool Construction", amount: "200000", progressOverallPct: "0"  },
  { id: "item-2", projectId: PROJECT_ID, rowIndex: 1, itemType: "item",         productService: "Excavation",        amount: "50000",  progressOverallPct: "0"  },
  { id: "item-3", projectId: PROJECT_ID, rowIndex: 2, itemType: "item",         productService: "Plumbing",          amount: "30000",  progressOverallPct: "0"  },
];

function makeRequest(method: string, body?: unknown, url = "http://localhost/api/projects"): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => mockDb.__reset());

// ── GET /api/projects ─────────────────────────────────────────────────────────

describe("GET /api/projects", () => {
  it("returns empty array when no projects exist", async () => {
    mockDb.__queue([]); // orderBy result
    const res = await projectsRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns all projects", async () => {
    mockDb.__queue([baseProject]);
    const res = await projectsRoute.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(PROJECT_ID);
  });

  it("returns 500 on db error", async () => {
    querySpy.mockRejectedValueOnce(new Error("connection lost"));
    const res = await projectsRoute.GET();
    expect(res.status).toBe(500);
  });
});

// ── POST /api/projects ────────────────────────────────────────────────────────

describe("POST /api/projects", () => {
  it("creates a project and returns it", async () => {
    mockDb.__queue([baseProject]); // insert.returning
    const req = makeRequest("POST", { name: "New Pool", location: {}, items: [] });
    const res = await projectsRoute.POST(req);
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(PROJECT_ID);
  });

  it("auto-generates name from streetAddress | clientName", async () => {
    // Capture what gets inserted by spying on the chain
    let insertedName: string | undefined;
    const origInsert = mockDb.insert.bind(mockDb);
    vi.spyOn(mockDb, "insert").mockImplementationOnce(() => ({
      from:   () => ({}),
      values: (vals: Record<string, unknown>) => {
        insertedName = vals.name as string;
        return { returning: () => thenable_result([baseProject]) };
      },
    }));

    const req = makeRequest("POST", {
      location: { streetAddress: "123 Main St", clientName: "Jane Doe" },
      items: [],
    });
    await projectsRoute.POST(req);
    expect(insertedName).toBe("123 Main St | Jane Doe");
    (mockDb.insert as ReturnType<typeof vi.spyOn>).mockRestore?.();
    void origInsert;
  });

  it("falls back to body.name when location has no address/client", async () => {
    let insertedName: string | undefined;
    vi.spyOn(mockDb, "insert").mockImplementationOnce(() => ({
      values: (vals: Record<string, unknown>) => {
        insertedName = vals.name as string;
        return { returning: () => thenable_result([baseProject]) };
      },
    }));
    const req = makeRequest("POST", { name: "Manual Name", location: {}, items: [] });
    await projectsRoute.POST(req);
    expect(insertedName).toBe("Manual Name");
    (mockDb.insert as ReturnType<typeof vi.spyOn>).mockRestore?.();
  });

  it("sets parsedAt when items are provided", async () => {
    let parsedAt: unknown;
    vi.spyOn(mockDb, "insert").mockImplementationOnce(() => ({
      values: (vals: Record<string, unknown>) => {
        parsedAt = vals.parsedAt;
        return { returning: () => thenable_result([baseProject]) };
      },
    }));
    const req = makeRequest("POST", {
      items: [{ type: "item", productService: "Test" }],
      location: {},
    });
    await projectsRoute.POST(req);
    expect(parsedAt).toBeInstanceOf(Date);
    (mockDb.insert as ReturnType<typeof vi.spyOn>).mockRestore?.();
  });

  it("does NOT set parsedAt when items array is empty", async () => {
    let parsedAt: unknown;
    vi.spyOn(mockDb, "insert").mockImplementationOnce(() => ({
      values: (vals: Record<string, unknown>) => {
        parsedAt = vals.parsedAt;
        return { returning: () => thenable_result([baseProject]) };
      },
    }));
    const req = makeRequest("POST", { name: "X", location: {}, items: [] });
    await projectsRoute.POST(req);
    expect(parsedAt).toBeNull();
    (mockDb.insert as ReturnType<typeof vi.spyOn>).mockRestore?.();
  });

  it("returns 500 on db failure", async () => {
    querySpy.mockRejectedValueOnce(new Error("insert failed"));
    const req = makeRequest("POST", { name: "X", location: {}, items: [] });
    const res = await projectsRoute.POST(req);
    expect(res.status).toBe(500);
  });
});

// tiny helper used by spied insert mocks above
function thenable_result(val: unknown) {
  return {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(val).then(resolve),
    catch: (rej: (e: unknown) => unknown) => Promise.resolve(val).catch(rej),
  };
}

// ── GET /api/projects/[id] ────────────────────────────────────────────────────

describe("GET /api/projects/[id]", () => {
  it("returns project with contractItems, selectedLineItemIds, trelloLinkedLists", async () => {
    mockDb.__queue(
      [baseProject],                   // project lookup
      contractItems,                   // contractItems (where+orderBy)
      [{ contractItemId: "item-2" }],  // selectedRows
      [],                              // trelloLinkedLists (where+orderBy)
    );
    const res = await projectIdRoute.GET(makeRequest("GET"), makeParams(PROJECT_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(PROJECT_ID);
    expect(body.contractItems).toHaveLength(3);
    expect(body.selectedLineItemIds).toEqual(["item-2"]);
    expect(body.trelloLinkedLists).toEqual([]);
  });

  it("returns 404 when project not found", async () => {
    mockDb.__queue([]);
    const res = await projectIdRoute.GET(makeRequest("GET"), makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("returns 500 on db error", async () => {
    querySpy.mockRejectedValueOnce(new Error("db error"));
    const res = await projectIdRoute.GET(makeRequest("GET"), makeParams(PROJECT_ID));
    expect(res.status).toBe(500);
  });
});

// ── PATCH /api/projects/[id] ──────────────────────────────────────────────────

describe("PATCH /api/projects/[id]", () => {
  /** Queue for a typical PATCH success: existing check + final re-fetch sequence */
  function queuePatchSuccess(updatedProject = baseProject) {
    mockDb.__queue(
      [baseProject],     // existing project check
      [updatedProject],  // re-fetch after update
      contractItems,     // contractItems (orderBy terminal)
      [],                // selectedRows
      [],                // trelloLinkedLists (orderBy terminal)
    );
  }

  it("updates project name and returns 200", async () => {
    queuePatchSuccess({ ...baseProject, name: "Updated Name" });
    const req = makeRequest("PATCH", { name: "Updated Name" });
    const res = await projectIdRoute.PATCH(req, makeParams(PROJECT_ID));
    expect(res.status).toBe(200);
  });

  it("returns 404 for unknown project", async () => {
    mockDb.__queue([]); // existing check — not found
    const req = makeRequest("PATCH", { name: "Ghost" });
    const res = await projectIdRoute.PATCH(req, makeParams("nonexistent"));
    expect(res.status).toBe(404);
  });

  it("refuses to overwrite existing items with an empty array", async () => {
    mockDb.__queue(
      [baseProject],  // existing check
      contractItems,  // existingCount check — items exist (> 0), refuse
    );
    const req = makeRequest("PATCH", { items: [] });
    const res = await projectIdRoute.PATCH(req, makeParams(PROJECT_ID));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/refusing/i);
  });

  it("allows replacing items with a non-empty array", async () => {
    mockDb.__queue(
      [baseProject],     // existing check
      [baseProject],     // re-fetch after update
      contractItems,     // contractItems
      [],                // selectedRows
      [],                // trelloLinkedLists
    );
    const newItems = [
      { type: "item", productService: "New Item A", qty: 1, rate: 10000, amount: 10000 },
    ];
    const req = makeRequest("PATCH", { items: newItems });
    const res = await projectIdRoute.PATCH(req, makeParams(PROJECT_ID));
    expect(res.status).toBe(200);
  });

  it("allows empty array when no existing items (safe to clear)", async () => {
    mockDb.__queue(
      [baseProject],  // existing check
      [],             // existingCount — no items, proceed
      [baseProject],  // re-fetch
      [],             // contractItems
      [],             // selectedRows
      [],             // trelloLinkedLists
    );
    const req = makeRequest("PATCH", { items: [] });
    const res = await projectIdRoute.PATCH(req, makeParams(PROJECT_ID));
    expect(res.status).toBe(200);
  });

  it("updates selectedLineItemIds", async () => {
    queuePatchSuccess();
    const req = makeRequest("PATCH", { selectedLineItemIds: ["item-1", "item-3"] });
    const res = await projectIdRoute.PATCH(req, makeParams(PROJECT_ID));
    expect(res.status).toBe(200);
    // delete + insert sequence for selected items must have run (querySpy called)
    expect(querySpy).toHaveBeenCalled();
  });

  it("returns response with contractItems and selectedLineItemIds", async () => {
    queuePatchSuccess();
    const req = makeRequest("PATCH", { name: "Patched" });
    const res = await projectIdRoute.PATCH(req, makeParams(PROJECT_ID));
    const body = await res.json();
    expect(body).toHaveProperty("contractItems");
    expect(body).toHaveProperty("selectedLineItemIds");
  });
});

// ── DELETE /api/projects/[id] ─────────────────────────────────────────────────

describe("DELETE /api/projects/[id]", () => {
  it("returns 204 on successful deletion", async () => {
    mockDb.__queue([baseProject]); // existing check
    // delete().where() also goes through querySpy
    mockDb.__queue([]);
    const res = await projectIdRoute.DELETE(makeRequest("DELETE"), makeParams(PROJECT_ID));
    expect(res.status).toBe(204);
  });

  it("returns 404 when project does not exist", async () => {
    mockDb.__queue([]);
    const res = await projectIdRoute.DELETE(makeRequest("DELETE"), makeParams("no-such-id"));
    expect(res.status).toBe(404);
  });

  it("returns 500 on db error during delete", async () => {
    querySpy
      .mockResolvedValueOnce([baseProject])       // existing check succeeds
      .mockRejectedValueOnce(new Error("constraint violation")); // delete fails
    const res = await projectIdRoute.DELETE(makeRequest("DELETE"), makeParams(PROJECT_ID));
    expect(res.status).toBe(500);
  });
});
