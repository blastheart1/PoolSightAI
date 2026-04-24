import { describe, it, expect } from "vitest";
import {
  deduplicateUrls,
  getExistingAddendumIds,
  filterNewAddendums,
  mergeExistingWithNewAddendums,
  validateMergeSafety,
} from "../lib/contractMerger";
import type { OrderItem } from "../lib/contractTypes";
import type { AddendumData } from "../lib/addendumParser";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    type: "item",
    productService: "Sample Item",
    qty: "1",
    rate: "100",
    amount: "100",
    ...overrides,
  };
}

function makeAddendumHeader(num: string, urlId: string): OrderItem {
  return makeItem({
    type: "maincategory",
    productService: `Addendum #${num} (${urlId})`,
    isAddendumHeader: true,
    addendumNumber: num,
    addendumUrlId: urlId,
    columnBLabel: "Addendum",
  });
}

function makeAddendumData(num: string, urlId: string, items: Partial<OrderItem>[] = []): AddendumData {
  return {
    addendumNumber: num,
    url: `https://l1.prodbx.com/go/view/?${urlId}`,
    urlId,
    items: items.map((i) => makeItem(i)),
  };
}

/**
 * Represents a realistic project state:
 * - 3 original line items with progress/billing values filled in
 * - 1 already-imported addendum (#3)
 */
function buildExistingItems(): OrderItem[] {
  return [
    makeItem({
      productService: "0100 Calimingo - Pools",
      type: "maincategory",
      mainCategory: "0100 Calimingo - Pools",
      progressOverallPct: "25",
      completedAmount: "5000",
      previouslyInvoicedPct: "10",
      previouslyInvoicedAmount: "2000",
      newProgressPct: "15",
      thisBill: "3000",
    }),
    makeItem({
      productService: "Excavation",
      qty: "1",
      rate: "8500",
      amount: "8500",
      columnBLabel: "Initial",
    }),
    makeItem({
      productService: "Shotcrete",
      qty: "1",
      rate: "12000",
      amount: "12000",
      columnBLabel: "Initial",
      progressOverallPct: "50",
      completedAmount: "6000",
    }),
    makeItem({ productService: "", isBlankRow: true }),
    makeAddendumHeader("3", "34533.426.20250915095400"),
    makeItem({
      productService: "Pool Heater Upgrade",
      qty: "1",
      rate: "3200",
      amount: "3200",
      columnBLabel: "Addendum",
    }),
  ];
}

// ---------------------------------------------------------------------------
// deduplicateUrls
// ---------------------------------------------------------------------------

describe("deduplicateUrls", () => {
  it("removes exact duplicate URLs", () => {
    const urls = [
      "https://l1.prodbx.com/go/view/?35587.426.20251112100816",
      "https://l1.prodbx.com/go/view/?35587.426.20251112100816",
      "https://l1.prodbx.com/go/view/?35279.426.20251020095021",
    ];
    expect(deduplicateUrls(urls)).toHaveLength(2);
  });

  it("trims whitespace before deduplication", () => {
    const urls = [
      "  https://l1.prodbx.com/go/view/?111  ",
      "https://l1.prodbx.com/go/view/?111",
    ];
    expect(deduplicateUrls(urls)).toHaveLength(1);
  });

  it("removes empty strings", () => {
    expect(deduplicateUrls(["", "  ", "https://l1.prodbx.com/go/view/?111"])).toHaveLength(1);
  });

  it("returns empty array for all-empty input", () => {
    expect(deduplicateUrls([])).toHaveLength(0);
  });

  it("preserves order of first occurrence", () => {
    const urls = ["https://l1.prodbx.com/go/view/?B", "https://l1.prodbx.com/go/view/?A", "https://l1.prodbx.com/go/view/?B"];
    expect(deduplicateUrls(urls)).toEqual([
      "https://l1.prodbx.com/go/view/?B",
      "https://l1.prodbx.com/go/view/?A",
    ]);
  });
});

// ---------------------------------------------------------------------------
// getExistingAddendumIds
// ---------------------------------------------------------------------------

describe("getExistingAddendumIds", () => {
  it("extracts urlIds from addendum header rows only", () => {
    const ids = getExistingAddendumIds(buildExistingItems());
    expect(ids.size).toBe(1);
    expect(ids.has("34533.426.20250915095400")).toBe(true);
  });

  it("returns empty set when no addendums exist", () => {
    expect(getExistingAddendumIds([makeItem()]).size).toBe(0);
  });

  it("ignores non-header rows even if columnBLabel is Addendum", () => {
    const items = [makeItem({ columnBLabel: "Addendum", isAddendumHeader: false, addendumUrlId: "ghost" })];
    expect(getExistingAddendumIds(items).size).toBe(0);
  });

  it("collects multiple addendum IDs", () => {
    const items = [
      makeAddendumHeader("3", "id-3"),
      makeAddendumHeader("4", "id-4"),
      makeAddendumHeader("5", "id-5"),
    ];
    const ids = getExistingAddendumIds(items);
    expect(ids.size).toBe(3);
    expect(ids.has("id-3")).toBe(true);
    expect(ids.has("id-5")).toBe(true);
  });

  it("skips header rows that have no addendumUrlId", () => {
    const items = [makeItem({ isAddendumHeader: true, addendumUrlId: undefined })];
    expect(getExistingAddendumIds(items).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// filterNewAddendums
// ---------------------------------------------------------------------------

describe("filterNewAddendums", () => {
  it("filters out already-imported addendums by urlId", () => {
    const existingIds = new Set(["34533.426.20250915095400"]);
    const incoming = [
      makeAddendumData("3", "34533.426.20250915095400"),  // duplicate
      makeAddendumData("4", "35098.426.20251008144807"),   // new
      makeAddendumData("5", "35237.426.20251016121413"),   // new
    ];
    const result = filterNewAddendums(incoming, existingIds);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.urlId)).toEqual([
      "35098.426.20251008144807",
      "35237.426.20251016121413",
    ]);
  });

  it("returns all addendums when none are pre-existing", () => {
    const incoming = [makeAddendumData("1", "111"), makeAddendumData("2", "222")];
    expect(filterNewAddendums(incoming, new Set())).toHaveLength(2);
  });

  it("returns empty array when all addendums are duplicates", () => {
    const existing = new Set(["111", "222"]);
    const incoming = [makeAddendumData("1", "111"), makeAddendumData("2", "222")];
    expect(filterNewAddendums(incoming, existing)).toHaveLength(0);
  });

  it("falls back to addendumNumber when urlId is undefined", () => {
    const existing = new Set(["7"]);
    const incoming: AddendumData[] = [
      { addendumNumber: "7", url: "https://l1.prodbx.com/go/view/?7", urlId: undefined as unknown as string, items: [] },
    ];
    expect(filterNewAddendums(incoming, existing)).toHaveLength(0);
  });

  it("does not filter when urlId differs from existing even if addendumNumber matches", () => {
    // Same addendum number but different urlId = different doc, should pass through
    const existing = new Set(["old-url-id"]);
    const incoming = [makeAddendumData("3", "new-url-id")];
    expect(filterNewAddendums(incoming, existing)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// mergeExistingWithNewAddendums — data retention (core business rule)
// ---------------------------------------------------------------------------

describe("mergeExistingWithNewAddendums — data retention", () => {
  it("does NOT mutate the original existing items array", () => {
    const existing = buildExistingItems();
    const snapshot = JSON.stringify(existing);
    mergeExistingWithNewAddendums(existing, [makeAddendumData("5", "new-id")]);
    expect(JSON.stringify(existing)).toBe(snapshot);
  });

  it("preserves all progress/billing fields on original line items", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [makeAddendumData("5", "new-id")]);

    const shotcrete = merged.find((i) => i.productService === "Shotcrete");
    expect(shotcrete?.progressOverallPct).toBe("50");
    expect(shotcrete?.completedAmount).toBe("6000");
  });

  it("preserves all billing fields on original category header rows", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [makeAddendumData("5", "new-id")]);

    const header = merged.find((i) => i.productService === "0100 Calimingo - Pools");
    expect(header?.progressOverallPct).toBe("25");
    expect(header?.completedAmount).toBe("5000");
    expect(header?.previouslyInvoicedPct).toBe("10");
    expect(header?.previouslyInvoicedAmount).toBe("2000");
    expect(header?.newProgressPct).toBe("15");
    expect(header?.thisBill).toBe("3000");
  });

  it("preserves already-imported addendum rows without modification", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [makeAddendumData("5", "new-id")]);

    const oldHeader = merged.find(
      (i) => i.isAddendumHeader && i.addendumUrlId === "34533.426.20250915095400"
    );
    expect(oldHeader).toBeDefined();
    expect(oldHeader?.productService).toBe("Addendum #3 (34533.426.20250915095400)");

    const oldItem = merged.find((i) => i.productService === "Pool Heater Upgrade");
    expect(oldItem?.rate).toBe("3200");
    expect(oldItem?.amount).toBe("3200");
    expect(oldItem?.columnBLabel).toBe("Addendum");
  });

  it("appends new addendum rows AFTER all existing items", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [
      makeAddendumData("5", "new-id", [{ productService: "New Pool Feature", amount: "500" }]),
    ]);

    const newHeaderIdx = merged.findIndex(
      (i) => i.isAddendumHeader && i.addendumUrlId === "new-id"
    );
    // Must appear after all original existing items
    expect(newHeaderIdx).toBeGreaterThan(existing.length - 1);

    const newItem = merged.find((i) => i.productService === "New Pool Feature");
    expect(newItem).toBeDefined();
    expect(newItem?.columnBLabel).toBe("Addendum");
  });

  it("inserts a blank separator row between existing and new addendums", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [makeAddendumData("5", "new-id")]);

    const separator = merged[existing.length];
    expect(separator.isBlankRow).toBe(true);
    expect(separator.productService).toBe("");
  });

  it("does not append a blank separator when there are no new addendums", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, []);
    expect(merged).toHaveLength(existing.length);
    expect(merged[existing.length]).toBeUndefined();
  });

  it("sets correct header fields on new addendum row", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [
      makeAddendumData("7", "35587.426.20251112100816"),
    ]);

    const header = merged.find(
      (i) => i.isAddendumHeader && i.addendumUrlId === "35587.426.20251112100816"
    );
    expect(header).toMatchObject({
      type: "maincategory",
      isAddendumHeader: true,
      addendumNumber: "7",
      addendumUrlId: "35587.426.20251112100816",
      columnBLabel: "Addendum",
      productService: "Addendum #7 (35587.426.20251112100816)",
    });
  });

  it("handles multiple new addendums appended in one pass", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [
      makeAddendumData("4", "35098.426.20251008144807", [{ productService: "Item A" }]),
      makeAddendumData("5", "35237.426.20251016121413", [{ productService: "Item B" }]),
    ]);

    const newHeaders = merged.filter((i) => i.isAddendumHeader && i.addendumNumber !== "3");
    expect(newHeaders).toHaveLength(2);
    expect(merged.find((i) => i.productService === "Item A")).toBeDefined();
    expect(merged.find((i) => i.productService === "Item B")).toBeDefined();
  });

  it("only one blank separator is added even with multiple new addendums", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [
      makeAddendumData("4", "id-4"),
      makeAddendumData("5", "id-5"),
    ]);
    // Merger copies all items with spread, so check blank rows appended AFTER existing length
    const appendedBlankRows = merged.slice(existing.length).filter((i) => i.isBlankRow);
    expect(appendedBlankRows).toHaveLength(1);
  });

  it("new addendum items carry columnBLabel = Addendum", () => {
    const existing = buildExistingItems();
    const merged = mergeExistingWithNewAddendums(existing, [
      makeAddendumData("5", "new-id", [
        { productService: "Item X", columnBLabel: undefined },
        { productService: "Item Y", columnBLabel: "Initial" }, // should be overwritten
      ]),
    ]);
    const newItems = merged.filter(
      (i) => i.productService === "Item X" || i.productService === "Item Y"
    );
    expect(newItems).toHaveLength(2);
    newItems.forEach((i) => expect(i.columnBLabel).toBe("Addendum"));
  });

  it("total item count = existing + blank separator + new header rows + new items", () => {
    const existing = buildExistingItems();
    const newAddendums = [
      makeAddendumData("4", "id-4", [{ productService: "A" }, { productService: "B" }]),
      makeAddendumData("5", "id-5", [{ productService: "C" }]),
    ];
    const merged = mergeExistingWithNewAddendums(existing, newAddendums);
    // existing(6) + separator(1) + header(1) + 2 items + header(1) + 1 item = 12
    expect(merged).toHaveLength(existing.length + 1 + 1 + 2 + 1 + 1);
  });
});

// ---------------------------------------------------------------------------
// Full dedup round-trip: simulates second delivery of same addendum email
// ---------------------------------------------------------------------------

describe("dedup round-trip — second delivery of same addendum email", () => {
  it("produces zero new addendums when all urlIds already exist in project", () => {
    const existing = buildExistingItems();
    const existingIds = getExistingAddendumIds(existing);

    // Incoming contains the same addendum already in the project
    const incoming = [makeAddendumData("3", "34533.426.20250915095400")];
    const newAddendums = filterNewAddendums(incoming, existingIds);

    expect(newAddendums).toHaveLength(0);

    const merged = mergeExistingWithNewAddendums(existing, newAddendums);
    // Nothing should be added
    expect(merged).toHaveLength(existing.length);
  });

  it("only appends the truly new addendum when email contains a mix of old and new", () => {
    const existing = buildExistingItems();
    const existingIds = getExistingAddendumIds(existing);

    const incoming = [
      makeAddendumData("3", "34533.426.20250915095400"),  // already imported
      makeAddendumData("7", "35587.426.20251112100816"),   // new
    ];
    const newAddendums = filterNewAddendums(incoming, existingIds);
    expect(newAddendums).toHaveLength(1);
    expect(newAddendums[0].urlId).toBe("35587.426.20251112100816");

    const merged = mergeExistingWithNewAddendums(existing, newAddendums);
    // existing(6) + blank(1) + header(1) + 0 items for the new addendum = 8
    expect(merged).toHaveLength(existing.length + 1 + 1);
  });
});

// ---------------------------------------------------------------------------
// validateMergeSafety
// ---------------------------------------------------------------------------

describe("validateMergeSafety", () => {
  it("is safe when merged has more items than existing", () => {
    const existing = buildExistingItems();
    const merged = [...existing, makeItem({ productService: "Extra" })];
    expect(validateMergeSafety(existing, merged, "proj-1").safe).toBe(true);
  });

  it("is NOT safe when merged is empty but existing has data", () => {
    const existing = buildExistingItems();
    const result = validateMergeSafety(existing, [], "proj-1");
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("Preserving existing items");
  });

  it("is safe when both existing and merged are empty", () => {
    expect(validateMergeSafety([], [], "proj-1").safe).toBe(true);
  });

  it("is safe when existingProjectId is undefined (fresh parse, no project yet)", () => {
    // Fresh parse: even 0 merged items is OK — there's no existing data to protect
    expect(validateMergeSafety(buildExistingItems(), [], undefined).safe).toBe(true);
  });

  it("is safe when merged equals existing (no-op append)", () => {
    const existing = buildExistingItems();
    expect(validateMergeSafety(existing, [...existing], "proj-1").safe).toBe(true);
  });
});
