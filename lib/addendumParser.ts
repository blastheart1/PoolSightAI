import { load } from "cheerio";
import type { OrderItem } from "./contractTypes";

/**
 * Addendum data structure
 */
export interface AddendumData {
  addendumNumber: string;
  items: OrderItem[];
  url: string;
  urlId?: string;
}

export function extractAddendumNumber(url: string): string {
  try {
    const urlObj = new URL(url);
    const queryParam = urlObj.search.substring(1);
    const parts = queryParam.split(".");
    if (parts.length > 0 && parts[0]) {
      return parts[0].trim();
    }
    const match = url.match(/[?&](\d+)\./);
    if (match && match[1]) {
      return match[1];
    }
    throw new Error(`Could not extract addendum number from URL: ${url}`);
  } catch (error) {
    throw new Error(
      `Invalid URL format: ${url}. Error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export function validateAddendumUrl(url: string): boolean {
  try {
    const urlPattern = /^https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?/i;
    return urlPattern.test(url.trim());
  } catch {
    return false;
  }
}

export async function fetchAddendumHTML(url: string): Promise<string> {
  try {
    if (!validateAddendumUrl(url)) {
      throw new Error(
        `Invalid addendum URL format: ${url}. Expected format: https://l1.prodbx.com/go/view/?...`
      );
    }
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch addendum URL: ${response.status} ${response.statusText}`
      );
    }
    const html = await response.text();
    if (!html || html.trim().length === 0) {
      throw new Error("Empty HTML content received from addendum URL");
    }
    return html;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timeout while fetching addendum URL: ${url}`);
    }
    throw new Error(
      `Failed to fetch addendum HTML: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuantity(qtyStr: string): number {
  if (!qtyStr) return 1;
  const cleaned = qtyStr.replace(/\u00A0/g, " ").trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)/);
  if (match) return parseFloat(match[1]);
  return 1;
}

function extractAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[$,\s]/g, "").trim();
  const match = cleaned.match(/^-?\d+(?:\.\d+)?/);
  if (match && match[0]) {
    const value = parseFloat(match[0]);
    if (
      value > 0 &&
      (amountStr.includes("-") || cleaned.startsWith("-"))
    ) {
      return -value;
    }
    return value;
  }
  return 0;
}

export function parseAddendum(
  html: string,
  addendumNumber: string,
  url: string
): AddendumData {
  try {
    const $ = load(html);
    const items: OrderItem[] = [];
    let pageAddendumNumber: string | null = null;
    const pageText = $.text();
    const addendumMatch = pageText.match(/Addendum\s*#\s*:?\s*(\d+)/i);
    if (addendumMatch?.[1]) {
      pageAddendumNumber = addendumMatch[1].trim();
    }
    const displayAddendumNumber = pageAddendumNumber || addendumNumber;
    const table = $("table.pos");
    const targetTable =
      table.length > 0 ? table : $("table").first();
    if (targetTable.length === 0) {
      throw new Error(
        "Order Items Table not found in addendum HTML. Expected table with class \"pos\""
      );
    }
    const rows = targetTable.find("tr");
    if (rows.length === 0) {
      throw new Error("No rows found in addendum table");
    }
    let currentMainCategory: string | null = null;
    let currentSubCategory: string | null = null;

    rows.each((_index, row) => {
      const $row = $(row);
      const cells = $row.find("td");
      if (cells.length === 0) return;
      const rowText = $row.text();
      const rowTextLower = rowText.toLowerCase();
      if (
        rowTextLower.includes("description") &&
        rowTextLower.includes("qty") &&
        rowTextLower.includes("extended")
      ) {
        return;
      }
      const firstCell = cells.first();
      const isSubCategory =
        $row.hasClass("ssg_title") ||
        firstCell.hasClass("ssg_title") ||
        firstCell.attr("class")?.includes("ssg_title") ||
        $row.hasClass("subcategory") ||
        firstCell.attr("class")?.includes("subcategory");

      if (isSubCategory) {
        const categoryName = cleanText(firstCell.text());
        if (categoryName?.trim()) {
          currentSubCategory = categoryName;
          items.push({
            type: "subcategory",
            productService: categoryName,
            qty: "",
            rate: "",
            amount: "",
            mainCategory: currentMainCategory,
            subCategory: categoryName,
          });
        }
        return;
      }

      if (cells.length >= 3) {
        const categoryText = cleanText(firstCell.text());
        const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
        const qtyCell = cells.eq(1);
        const extendedCell = cells.eq(2);
        const hasQtyAndExtended =
          qtyCell.text().trim() && extendedCell.text().trim();
        if (
          categoryCodePattern.test(categoryText.trim()) &&
          hasQtyAndExtended
        ) {
          currentMainCategory = categoryText;
          return;
        }
      }

      if (cells.length >= 3) {
        const descriptionCell = cells.eq(0);
        const qtyCell = cells.eq(1);
        const extendedCell = cells.eq(2);
        const cellHtml = descriptionCell.html() || "";
        const plainText = cellHtml
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "$1")
          .replace(/<em[^>]*>(.*?)<\/em>/gi, "$1")
          .replace(/<b[^>]*>(.*?)<\/b>/gi, "$1")
          .replace(/<i[^>]*>(.*?)<\/i>/gi, "$1")
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<\/?[^>]+(>|$)/g, " ");
        const description = cleanText(plainText);
        const qtyText = cleanText(qtyCell.text());
        const extendedText = cleanText(extendedCell.text());
        if (!description?.trim()) return;
        if (
          description.toLowerCase().includes("description") &&
          qtyText.toLowerCase().includes("qty")
        )
          return;
        if (
          description.toLowerCase().includes("subtotal") ||
          description.toLowerCase().includes("tax") ||
          description.toLowerCase().includes("grand total") ||
          description.toLowerCase().includes("current balance")
        )
          return;
        const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
        const trimmedDescription = description.trim();
        const hasQtyAndExtendedInLineItem =
          qtyText.trim() && extendedText.trim();
        if (
          categoryCodePattern.test(trimmedDescription) &&
          hasQtyAndExtendedInLineItem
        ) {
          currentMainCategory = trimmedDescription;
          return;
        }
        const qty = extractQuantity(qtyText);
        const extended = extractAmount(extendedText);
        if (description.trim().length > 0 && extended !== 0) {
          items.push({
            type: "item",
            productService: description,
            qty,
            rate: "",
            amount: extended,
            mainCategory: currentMainCategory,
            subCategory: currentSubCategory,
          });
        }
      }
    });

    if (items.length === 0) {
      throw new Error(
        `No order items found in addendum ${addendumNumber}. Please verify the HTML structure.`
      );
    }
    return {
      addendumNumber: displayAddendumNumber,
      items,
      url,
      urlId: addendumNumber,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse addendum ${addendumNumber}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export function parseOriginalContract(
  html: string,
  _contractId: string,
  url: string
): OrderItem[] {
  try {
    const $ = load(html);
    const items: OrderItem[] = [];
    const table = $("table.pos");
    const targetTable =
      table.length > 0 ? table : $("table").first();
    if (targetTable.length === 0) {
      throw new Error(
        "Order Items Table not found in Original Contract HTML. Expected table with class \"pos\""
      );
    }
    const rows = targetTable.find("tr");
    if (rows.length === 0) {
      throw new Error("No rows found in Original Contract table");
    }
    let currentMainCategory: string | null = null;
    let currentSubCategory: string | null = null;
    let currentOptionalPackageNumber: number | undefined = undefined;

    rows.each((_index, row) => {
      const $row = $(row);
      const cells = $row.find("td");
      if (cells.length === 0) return;
      const rowText = $row.text();
      const optionalPackageMatch = rowText.match(
        /-OPTIONAL\s+PACKAGE\s+(\d+)-/i
      );
      if (optionalPackageMatch?.[1]) {
        const packageNumber = parseInt(optionalPackageMatch[1], 10);
        if (!isNaN(packageNumber) && packageNumber > 0) {
          currentOptionalPackageNumber = packageNumber;
        }
      }
      if (rowText.includes("PACKAGE TOTAL")) {
        currentOptionalPackageNumber = undefined;
      }
      if (
        currentOptionalPackageNumber !== undefined &&
        (rowText.includes("THIS AGREEMENT") ||
          rowText.includes("CONTRACT #") ||
          rowText.includes("Contractor Signature"))
      ) {
        currentOptionalPackageNumber = undefined;
      }
      const rowTextLower = rowText.toLowerCase();
      if (
        rowTextLower.includes("description") &&
        rowTextLower.includes("qty") &&
        rowTextLower.includes("extended")
      ) {
        return;
      }
      const firstCell = cells.first();
      let isSubCategory = false;
      let subCategoryName = "";

      if (cells.length === 2) {
        const firstCellText = cleanText(firstCell.text());
        const secondCell = cells.eq(1);
        const secondCellStyle = secondCell.attr("style") || "";
        if (
          (!firstCellText || firstCellText.trim() === "") &&
          secondCellStyle.includes("border-top:solid 1px #BBB") &&
          secondCellStyle.includes("letter-spacing:2px")
        ) {
          const strongTag = secondCell.find("strong");
          if (strongTag.length > 0) {
            subCategoryName = cleanText(strongTag.text());
            if (subCategoryName?.trim()) isSubCategory = true;
          }
        }
      }
      if (!isSubCategory) {
        isSubCategory = !!(
          $row.hasClass("ssg_title") ||
          firstCell.hasClass("ssg_title") ||
          firstCell.attr("class")?.includes("ssg_title") ||
          $row.hasClass("subcategory") ||
          firstCell.attr("class")?.includes("subcategory")
        );
        if (isSubCategory) subCategoryName = cleanText(firstCell.text());
      }

      if (isSubCategory && subCategoryName?.trim()) {
        currentSubCategory = subCategoryName;
        items.push({
          type: "subcategory",
          productService: subCategoryName,
          qty: "",
          rate: "",
          amount: "",
          mainCategory: currentMainCategory,
          subCategory: subCategoryName,
          ...(currentOptionalPackageNumber
            ? {
                isOptional: true,
                optionalPackageNumber: currentOptionalPackageNumber,
              }
            : {}),
        });
        return;
      }

      if (cells.length >= 3) {
        const firstCellHtml = firstCell.html() || "";
        const categoryText = cleanText(firstCell.text());
        const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
        const hasCategoryCode = categoryCodePattern.test(categoryText.trim());
        const isBold =
          firstCellHtml.includes("font-weight: bold") ||
          firstCellHtml.includes("font-size: 14px") ||
          firstCell.find('span[style*="font-weight: bold"]').length > 0 ||
          firstCell.find('span[style*="font-size: 14px"]').length > 0 ||
          firstCell.find("strong").length > 0 ||
          firstCell.find("b").length > 0;
        const qtyCell = cells.eq(1);
        const extendedCell = cells.eq(2);
        const hasQtyAndExtended =
          qtyCell.text().trim() && extendedCell.text().trim();
        if (
          (hasCategoryCode && hasQtyAndExtended) ||
          (isBold && hasQtyAndExtended)
        ) {
          if (categoryText?.trim()) {
            let fullCategoryName = categoryText.trim().replace(/:\s*$/, "").trim();
            fullCategoryName = `${fullCategoryName}:`;
            currentMainCategory = fullCategoryName;
            currentSubCategory = null;
            const qtyText = cleanText(qtyCell.text());
            const extendedText = cleanText(extendedCell.text());
            const qty = extractQuantity(qtyText);
            const extended = extractAmount(extendedText);
            items.push({
              type: "maincategory",
              productService: fullCategoryName,
              qty,
              rate: "",
              amount: extended,
              mainCategory: fullCategoryName,
              subCategory: null,
              ...(currentOptionalPackageNumber
                ? {
                    isOptional: true,
                    optionalPackageNumber: currentOptionalPackageNumber,
                  }
                : {}),
            });
          }
          return;
        }
      }

      if (cells.length >= 3) {
        const descriptionCell = cells.eq(0);
        const qtyCell = cells.eq(1);
        const extendedCell = cells.eq(2);
        const cellHtml = descriptionCell.html() || "";
        const plainText = cellHtml
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "$1")
          .replace(/<em[^>]*>(.*?)<\/em>/gi, "$1")
          .replace(/<b[^>]*>(.*?)<\/b>/gi, "$1")
          .replace(/<i[^>]*>(.*?)<\/i>/gi, "$1")
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<\/?[^>]+(>|$)/g, " ");
        const description = cleanText(plainText);
        const qtyText = cleanText(qtyCell.text());
        const extendedText = cleanText(extendedCell.text());
        if (!description?.trim()) return;
        if (
          description.toLowerCase().includes("description") &&
          qtyText.toLowerCase().includes("qty")
        )
          return;
        if (
          description.toLowerCase().includes("subtotal") ||
          description.toLowerCase().includes("tax") ||
          description.toLowerCase().includes("grand total") ||
          description.toLowerCase().includes("current balance")
        )
          return;
        const categoryCodePattern = /^\s*\d{4}\s+Calimingo/i;
        const trimmedDescription = description.trim();
        const hasQtyAndExtendedInLineItem =
          qtyText.trim() && extendedText.trim();
        if (
          categoryCodePattern.test(trimmedDescription) &&
          hasQtyAndExtendedInLineItem
        ) {
          return;
        }
        const qty = extractQuantity(qtyText);
        const extended = extractAmount(extendedText);
        if (description.trim().length > 0) {
          items.push({
            type: "item",
            productService: description,
            qty,
            rate: "",
            amount: extended,
            mainCategory: currentMainCategory,
            subCategory: currentSubCategory,
            ...(currentOptionalPackageNumber
              ? {
                  isOptional: true,
                  optionalPackageNumber: currentOptionalPackageNumber,
                }
              : {}),
          });
        }
      }
    });

    if (items.length === 0) {
      throw new Error(
        "No order items found in Original Contract. Please verify the HTML structure."
      );
    }
    return items;
  } catch (error) {
    throw new Error(
      `Failed to parse Original Contract: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

export async function fetchAndParseAddendum(
  url: string
): Promise<AddendumData> {
  if (!validateAddendumUrl(url)) {
    throw new Error(`Invalid addendum URL format: ${url}`);
  }
  const addendumNumber = extractAddendumNumber(url);
  const html = await fetchAddendumHTML(url);
  return parseAddendum(html, addendumNumber, url);
}

export async function fetchAndParseAddendums(
  urls: string[],
  concurrency = 5
): Promise<AddendumData[]> {
  const errors: Array<{ url: string; error: string }> = [];

  // Process in parallel batches to stay within Vercel's 60s limit
  // while avoiding overwhelming the ProDBX server.
  const settled: Array<AddendumData | null> = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fetchAndParseAddendum));
    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status === "fulfilled") {
        settled.push(r.value);
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : "Unknown error";
        errors.push({ url: batch[j], error: msg });
        console.error(`[Addendum Parser] Error processing ${batch[j]}:`, msg);
        settled.push(null);
      }
    }
  }

  const results = settled.filter((r): r is AddendumData => r !== null);
  if (results.length === 0 && urls.length > 0) {
    throw new Error(
      `All addendum URLs failed to process. Errors: ${errors.map((e) => e.error).join("; ")}`
    );
  }
  return results;
}
