import type { OrderItem } from "./contractTypes";
import type { AddendumData } from "./addendumParser";

/**
 * Deduplicate an array of URLs.
 */
export function deduplicateUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map((u) => u.trim()).filter(Boolean)));
}

/**
 * Scan existing items for addendum headers and return a Set of their
 * `addendumUrlId` values.  Used to skip already-imported addendums.
 */
export function getExistingAddendumIds(
  existingItems: ReadonlyArray<OrderItem>
): Set<string> {
  const ids = new Set<string>();
  for (const item of existingItems) {
    if (item.isAddendumHeader && item.addendumUrlId) {
      ids.add(item.addendumUrlId);
    }
  }
  return ids;
}

/**
 * Filter out addendums whose `urlId` (or `addendumNumber` as fallback) already
 * exists in the existing set.
 */
export function filterNewAddendums(
  addendumData: ReadonlyArray<AddendumData>,
  existingAddendumIds: ReadonlySet<string>
): AddendumData[] {
  return addendumData.filter((a) => {
    const id = a.urlId ?? a.addendumNumber;
    return !existingAddendumIds.has(id);
  });
}

/**
 * Deep-copy existing items and append new addendum data after a blank
 * separator row.  Existing items (and their progress fields) are never
 * modified — only new rows are appended.
 */
export function mergeExistingWithNewAddendums(
  existingItems: ReadonlyArray<OrderItem>,
  newAddendumData: ReadonlyArray<AddendumData>
): OrderItem[] {
  const merged: OrderItem[] = existingItems.map((item) => ({ ...item }));

  if (newAddendumData.length === 0) return merged;

  // Blank separator between existing items and new addendums
  merged.push({
    type: "item",
    productService: "",
    qty: "",
    rate: "",
    amount: "",
    isBlankRow: true,
  });

  for (const addendum of newAddendumData) {
    const addendumNum = addendum.addendumNumber;
    const urlId = addendum.urlId ?? addendum.addendumNumber;

    // Addendum header row
    merged.push({
      type: "maincategory",
      productService: `Addendum #${addendumNum} (${urlId})`,
      qty: "",
      rate: "",
      amount: "",
      isAddendumHeader: true,
      addendumNumber: addendumNum,
      addendumUrlId: urlId,
      columnBLabel: "Addendum",
    });

    // Addendum line items
    for (const item of addendum.items) {
      merged.push({ ...item, columnBLabel: "Addendum" });
    }
  }

  return merged;
}

/**
 * Safety checks before committing a merge.
 */
export function validateMergeSafety(
  existingItems: ReadonlyArray<OrderItem>,
  parsedItems: ReadonlyArray<OrderItem>,
  existingProjectId: string | undefined
): { safe: boolean; reason?: string } {
  if (
    existingProjectId &&
    parsedItems.length === 0 &&
    existingItems.length > 0
  ) {
    return {
      safe: false,
      reason:
        "Parsing returned 0 items but project has existing data. Preserving existing items.",
    };
  }
  return { safe: true };
}
