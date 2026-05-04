import {
  extractLocation,
} from "./tableExtractor";
import { toDec } from "./db/utils";
import { normalizeToMmddyyyy } from "./utils/dateFormat";
import type { Location, OrderItem } from "./contractTypes";
import {
  fetchAddendumHTML,
  parseOriginalContract,
  extractAddendumNumber,
  fetchAndParseAddendums,
  type AddendumData,
} from "./addendumParser";
import { db } from "./db";
import { projects, projectContractItems } from "./db/schema";
import { eq } from "drizzle-orm";
import {
  deduplicateUrls,
  getExistingAddendumIds,
  filterNewAddendums,
  mergeExistingWithNewAddendums,
  validateMergeSafety,
} from "./contractMerger";

export interface MergeInfo {
  existingItemCount: number;
  newAddendumCount: number;
  skippedDuplicateCount: number;
  totalItemCount: number;
}

export interface ExistingProjectData {
  project: { orderNo: string | null; clientName: string | null };
  items: OrderItem[];
}

/**
 * Filter items by type (main category / subcategory).
 */
export function filterItems(
  items: OrderItem[],
  includeMainCategories: boolean,
  includeSubcategories: boolean
): OrderItem[] {
  return items.filter((item) => {
    if (item.type === "maincategory" && !includeMainCategories) return false;
    if (item.type === "subcategory" && !includeSubcategories) return false;
    return true;
  });
}

/**
 * Fetch existing project + contract items from the database.
 * Returns null if the project doesn't exist or DB is not configured.
 */
export async function fetchExistingProjectData(
  projectId: string
): Promise<ExistingProjectData | null> {
  if (!db) return null;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project) return null;

  const rows = await db
    .select()
    .from(projectContractItems)
    .where(eq(projectContractItems.projectId, projectId))
    .orderBy(projectContractItems.rowIndex);

  const items: OrderItem[] = rows.map((r) => ({
    id: r.id,
    type: r.itemType,
    productService: r.productService,
    qty: r.qty ?? "",
    rate: r.rate ?? "",
    amount: r.amount ?? "",
    mainCategory: r.mainCategory ?? null,
    subCategory: r.subCategory ?? null,
    progressOverallPct: r.progressOverallPct ?? undefined,
    completedAmount: r.completedAmount ?? undefined,
    previouslyInvoicedPct: r.previouslyInvoicedPct ?? undefined,
    previouslyInvoicedAmount: r.previouslyInvoicedAmount ?? undefined,
    newProgressPct: r.newProgressPct ?? undefined,
    thisBill: r.thisBill ?? undefined,
    optionalPackageNumber: r.optionalPackageNumber ?? undefined,
    columnBLabel: r.columnBLabel ?? undefined,
    isAddendumHeader: r.isAddendumHeader ?? undefined,
    addendumNumber: r.addendumNumber ?? undefined,
    addendumUrlId: r.addendumUrlId ?? undefined,
    isBlankRow: r.isBlankRow ?? undefined,
  }));

  return {
    project: {
      orderNo: project.orderNo ?? null,
      clientName: project.clientName ?? null,
    },
    items,
  };
}

/**
 * Look up a project by orderNo. Returns project id + name, or null.
 */
export async function findProjectByOrderNo(
  orderNo: string
): Promise<{ id: string; name: string; orderNo: string } | null> {
  if (!db || !orderNo.trim()) return null;
  const [project] = await db
    .select({ id: projects.id, name: projects.name, orderNo: projects.orderNo })
    .from(projects)
    .where(eq(projects.orderNo, orderNo.trim()))
    .limit(1);
  if (!project || !project.orderNo) return null;
  return { id: project.id, name: project.name, orderNo: project.orderNo };
}

/**
 * Verify that a parsed contract's order number matches the existing project.
 * Returns an error message string on mismatch, or null if OK.
 */
export function verifyContractIdentity(
  existingOrderNo: string | null,
  parsedOrderNo: string | null
): string | null {
  if (!existingOrderNo || !parsedOrderNo) return null;
  if (existingOrderNo.trim() === parsedOrderNo.trim()) return null;
  return `Contract identity mismatch: project has order #${existingOrderNo} but parsed data has order #${parsedOrderNo}`;
}

/**
 * Core parse flow for links mode (ProDBX URLs).
 * Fetches original contract + addendums, merges with existing data if appending.
 */
export async function runLinksFlow(opts: {
  originalContractUrl: string;
  addendumLinks: string[];
  locationOverride?: Location | null;
  existingProjectId?: string;
}): Promise<{
  location: Location;
  items: OrderItem[];
  mergeInfo?: MergeInfo;
}> {
  const { originalContractUrl, addendumLinks, locationOverride, existingProjectId } =
    opts;
  let freshItems: OrderItem[] = [];
  let location: Location = {
    orderNo: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
  };

  // Fetch existing project data if appending
  let existingData: ExistingProjectData | null = null;
  if (existingProjectId) {
    existingData = await fetchExistingProjectData(existingProjectId);
  }

  if (originalContractUrl.trim()) {
    const html = await fetchAddendumHTML(originalContractUrl);
    const contractId = extractAddendumNumber(originalContractUrl);

    // Only parse original contract items if this is a fresh parse
    if (!existingData) {
      const allItems = parseOriginalContract(html, contractId, originalContractUrl);
      freshItems = allItems.filter((it) => !it.isOptional);
    }

    if (!locationOverride) {
      const fromHtml = extractLocation(html);
      if (fromHtml.orderNo || fromHtml.streetAddress) location = fromHtml;
    }
  }

  if (locationOverride) {
    location = { ...location, ...locationOverride };
  }

  // Deduplicate addendum URLs
  const dedupedLinks = deduplicateUrls(addendumLinks);

  // Fetch and parse addendums
  let addendumData: AddendumData[] = [];
  if (dedupedLinks.length > 0) {
    addendumData = await fetchAndParseAddendums(dedupedLinks);
  }

  let merged: OrderItem[];
  let mergeInfo: MergeInfo | undefined;

  if (existingData) {
    // Identity verification
    const identityError = verifyContractIdentity(
      existingData.project.orderNo,
      location.orderNo || null
    );
    if (identityError) {
      throw new Error(identityError);
    }

    // Filter out already-imported addendums
    const existingAddendumIds = getExistingAddendumIds(existingData.items);
    const newAddendums = filterNewAddendums(addendumData, existingAddendumIds);
    const skippedCount = addendumData.length - newAddendums.length;

    // Merge existing with new addendums
    merged = mergeExistingWithNewAddendums(existingData.items, newAddendums);

    // Safety check
    const safety = validateMergeSafety(existingData.items, merged, existingProjectId);
    if (!safety.safe) {
      merged = existingData.items.map((item) => ({ ...item }));
    }

    mergeInfo = {
      existingItemCount: existingData.items.length,
      newAddendumCount: newAddendums.length,
      skippedDuplicateCount: skippedCount,
      totalItemCount: merged.length,
    };
  } else {
    // Fresh parse
    merged = mergeExistingWithNewAddendums(freshItems, addendumData);
  }

  const filtered = filterItems(merged, true, true);
  const contractDate = location.orderDate
    ? normalizeToMmddyyyy(location.orderDate)
    : null;
  const locationWithDate = contractDate
    ? { ...location, contractDate }
    : location;

  return { location: locationWithDate, items: filtered, mergeInfo };
}

/**
 * Insert contract items into the database for a project (single bulk statement).
 * Reusable by both POST /api/projects and the webhook.
 */
export async function insertContractItems(
  projectId: string,
  items: OrderItem[]
): Promise<void> {
  if (!db) throw new Error("Database not configured");
  if (items.length === 0) return;
  const rows = items.map((it, i) => ({
    projectId,
    rowIndex: i,
    itemType: it.type ?? "item",
    productService: it.productService ?? "",
    qty: toDec(it.qty),
    rate: toDec(it.rate),
    amount: toDec(it.amount),
    mainCategory: it.mainCategory ?? null,
    subCategory: it.subCategory ?? null,
    progressOverallPct: toDec(it.progressOverallPct),
    completedAmount: toDec(it.completedAmount),
    previouslyInvoicedPct: toDec(it.previouslyInvoicedPct),
    previouslyInvoicedAmount: toDec(it.previouslyInvoicedAmount),
    newProgressPct: toDec(it.newProgressPct),
    thisBill: toDec(it.thisBill),
    optionalPackageNumber:
      typeof it.optionalPackageNumber === "number" ? it.optionalPackageNumber : null,
    columnBLabel: it.columnBLabel ?? null,
    isAddendumHeader: it.isAddendumHeader === true,
    addendumNumber: it.addendumNumber ?? null,
    addendumUrlId: it.addendumUrlId ?? null,
    isBlankRow: it.isBlankRow === true,
  }));
  await db.insert(projectContractItems).values(rows);
}

/**
 * Delete all contract items for a project, then insert the new set.
 * Used by both PATCH and webhook for the replace-with-merged-data pattern.
 */
export async function replaceContractItems(
  projectId: string,
  items: OrderItem[]
): Promise<void> {
  if (!db) throw new Error("Database not configured");
  await db
    .delete(projectContractItems)
    .where(eq(projectContractItems.projectId, projectId));
  await insertContractItems(projectId, items);
}
