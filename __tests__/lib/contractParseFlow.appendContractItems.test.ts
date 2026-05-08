/**
 * Unit tests for appendContractItems.
 *
 * Verifies that new items are inserted at rowIndex = MAX(existing) + 1
 * without touching any existing rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrderItem } from "../../lib/contractTypes";

// ── Mock DB ────────────────────────────────────────────────────────────────────

const insertValuesSpy = vi.fn().mockResolvedValue(undefined);
const selectWhereSpy  = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => selectWhereSpy()),
    })),
  })),
  insert: vi.fn(() => ({
    values: insertValuesSpy,
  })),
};

vi.mock("../../lib/db", () => ({ db: mockDb }));

// drizzle-orm `max` and `eq` are used only for query building; stub them out.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, max: vi.fn((col) => col), eq: vi.fn(() => "eq-stub") };
});

// ── Import after mocks ─────────────────────────────────────────────────────────

const { appendContractItems } = await import("../../lib/contractParseFlow");

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    type: "item",
    productService: "Test item",
    qty: 1,
    rate: 100,
    amount: 100,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  insertValuesSpy.mockResolvedValue(undefined);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("appendContractItems", () => {
  it("no-ops when items array is empty", async () => {
    await appendContractItems("proj-1", []);
    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("starts at rowIndex 0 when project has no existing rows (MAX returns null)", async () => {
    selectWhereSpy.mockResolvedValueOnce([{ maxIdx: null }]);

    await appendContractItems("proj-1", [makeItem()]);

    const insertedRows = insertValuesSpy.mock.calls[0][0] as Array<{ rowIndex: number }>;
    expect(insertedRows[0].rowIndex).toBe(0);
  });

  it("starts at MAX + 1 when project has existing rows", async () => {
    selectWhereSpy.mockResolvedValueOnce([{ maxIdx: 9 }]);

    await appendContractItems("proj-1", [makeItem(), makeItem()]);

    const insertedRows = insertValuesSpy.mock.calls[0][0] as Array<{ rowIndex: number }>;
    expect(insertedRows[0].rowIndex).toBe(10);
    expect(insertedRows[1].rowIndex).toBe(11);
  });

  it("inserts the correct number of rows", async () => {
    selectWhereSpy.mockResolvedValueOnce([{ maxIdx: 4 }]);
    const items = [makeItem(), makeItem(), makeItem()];

    await appendContractItems("proj-2", items);

    const insertedRows = insertValuesSpy.mock.calls[0][0] as unknown[];
    expect(insertedRows).toHaveLength(3);
  });

  it("maps item fields correctly", async () => {
    selectWhereSpy.mockResolvedValueOnce([{ maxIdx: 0 }]);
    const item = makeItem({
      type: "maincategory",
      productService: "Excavation",
      qty: 2,
      rate: 5000,
      amount: 10000,
      addendumNumber: "42",
      addendumUrlId: "42.abc.xyz",
      isAddendumHeader: true,
      columnBLabel: "Addendum",
    });

    await appendContractItems("proj-3", [item]);

    const row = (insertValuesSpy.mock.calls[0][0] as Array<Record<string, unknown>>)[0];
    expect(row.projectId).toBe("proj-3");
    expect(row.rowIndex).toBe(1);
    expect(row.itemType).toBe("maincategory");
    expect(row.productService).toBe("Excavation");
    expect(row.addendumNumber).toBe("42");
    expect(row.addendumUrlId).toBe("42.abc.xyz");
    expect(row.isAddendumHeader).toBe(true);
    expect(row.columnBLabel).toBe("Addendum");
  });

  it("throws when DB is not configured", async () => {
    vi.resetModules();
    vi.doMock("../../lib/db", () => ({ db: null }));
    const { appendContractItems: fn } = await import("../../lib/contractParseFlow");
    await expect(fn("proj-x", [makeItem()])).rejects.toThrow("Database not configured");
    vi.doUnmock("../../lib/db");
  });
});
