import { NextRequest, NextResponse } from "next/server";
import { parseEML } from "../../../lib/emlParser";
import {
  extractOrderItems,
  extractLocation,
  isLocationValid,
  validateOrderItemsTotal,
} from "../../../lib/tableExtractor";
import { normalizeToMmddyyyy } from "../../../lib/utils/dateFormat";
import type { Location, OrderItem } from "../../../lib/contractTypes";
import {
  validateAddendumUrl,
  fetchAddendumHTML,
  parseOriginalContract,
  extractAddendumNumber,
  fetchAndParseAddendums,
  type AddendumData,
} from "../../../lib/addendumParser";
import { extractContractLinks } from "../../../lib/contractLinkExtractor";

export const runtime = "nodejs";

const includeMainCategoriesDefault = true;
const includeSubcategoriesDefault = true;

function filterItems(
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

function mergeAddendumDataIntoItems(
  mainItems: OrderItem[],
  addendumData: AddendumData[]
): OrderItem[] {
  const merged: OrderItem[] = [...mainItems];
  if (addendumData.length === 0) return merged;
  merged.push({
    type: "item",
    productService: "",
    qty: "",
    rate: "",
    amount: "",
    isBlankRow: true,
  });
  for (const addendum of addendumData) {
    const addendumNum = addendum.addendumNumber;
    const urlId = addendum.urlId ?? addendum.addendumNumber;
    merged.push({
      type: "maincategory",
      productService: `Addendum #${addendumNum} (${urlId})`,
      qty: "",
      rate: "",
      amount: "",
      isAddendumHeader: true,
      addendumNumber: addendumNum,
      addendumUrlId: urlId,
    });
    for (const item of addendum.items) {
      merged.push({ ...item, columnBLabel: "Addendum" });
    }
  }
  return merged;
}

async function runLinksFlow(opts: {
  originalContractUrl: string;
  addendumLinks: string[];
  locationOverride?: Location | null;
}): Promise<{ location: Location; items: OrderItem[] }> {
  const { originalContractUrl, addendumLinks, locationOverride } = opts;
  let items: OrderItem[] = [];
  let location: Location = {
    orderNo: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
  };

  if (originalContractUrl.trim()) {
    const html = await fetchAddendumHTML(originalContractUrl);
    const contractId = extractAddendumNumber(originalContractUrl);
    const allItems = parseOriginalContract(html, contractId, originalContractUrl);
    items = allItems.filter((it) => !it.isOptional);
    if (!locationOverride) {
      const fromHtml = extractLocation(html);
      if (fromHtml.orderNo || fromHtml.streetAddress) location = fromHtml;
    }
  }

  let addendumData: AddendumData[] = [];
  if (addendumLinks.length > 0) {
    addendumData = await fetchAndParseAddendums(addendumLinks);
  }

  if (locationOverride) {
    location = { ...location, ...locationOverride };
  }

  const merged = mergeAddendumDataIntoItems(items, addendumData);
  const filtered = filterItems(
    merged,
    includeMainCategoriesDefault,
    includeSubcategoriesDefault
  );
  const contractDate = location.orderDate
    ? normalizeToMmddyyyy(location.orderDate)
    : null;
  const locationWithDate = contractDate
    ? { ...location, contractDate }
    : location;

  return { location: locationWithDate, items: filtered };
}

function toLocationResponse(loc: Location): Record<string, unknown> {
  return {
    orderNo: loc.orderNo,
    streetAddress: loc.streetAddress,
    city: loc.city,
    state: loc.state,
    zip: loc.zip,
    clientName: loc.clientName ?? undefined,
    email: loc.email ?? undefined,
    phone: loc.phone ?? undefined,
    orderDate: loc.orderDate ?? undefined,
    orderPO: loc.orderPO ?? undefined,
    orderDueDate: loc.orderDueDate ?? undefined,
    orderType: loc.orderType ?? undefined,
    orderGrandTotal: loc.orderGrandTotal ?? undefined,
    progressPayments: loc.progressPayments ?? undefined,
    balanceDue: loc.balanceDue ?? undefined,
    salesRep: loc.salesRep ?? undefined,
    contractDate: (loc as { contractDate?: string }).contractDate ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const returnData = body.returnData === true;
    if (!returnData) {
      return NextResponse.json(
        { error: "returnData: true is required in this version" },
        { status: 400 }
      );
    }

    if (body.mode === "links") {
      const originalContractUrl =
        typeof body.originalContractUrl === "string" &&
        body.originalContractUrl.trim()
          ? body.originalContractUrl.trim()
          : null;
      const addendumLinks = Array.isArray(body.addendumLinks)
        ? (body.addendumLinks as string[]).filter(
            (u): u is string => typeof u === "string" && u.trim().length > 0
          )
        : [];

      if (!originalContractUrl) {
        return NextResponse.json(
          { error: "originalContractUrl is required for links mode" },
          { status: 400 }
        );
      }
      const allUrls = [originalContractUrl, ...addendumLinks];
      const invalid = allUrls.filter((u) => !validateAddendumUrl(u));
      if (invalid.length > 0) {
        return NextResponse.json(
          {
            error: "Invalid ProDBX URL format",
            message: `Expected https://l1.prodbx.com/go/view/?... Invalid: ${invalid.slice(0, 3).join(", ")}`,
          },
          { status: 400 }
        );
      }

      const { location, items } = await runLinksFlow({
        originalContractUrl,
        addendumLinks,
      });
      const orderItemsValidation = validateOrderItemsTotal(
        items,
        location.orderGrandTotal,
        0.01
      );
      const processingSummary = {
        mode: "links" as const,
        originalContractUrl,
        addendumCount: addendumLinks.length,
        itemsCount: items.length,
        orderItemsValidation: {
          isValid: orderItemsValidation.isValid,
          itemsTotal: orderItemsValidation.itemsTotal,
          orderGrandTotal: orderItemsValidation.orderGrandTotal,
          difference: orderItemsValidation.difference,
          message: orderItemsValidation.message,
        },
      };
      return NextResponse.json({
        success: true,
        data: {
          location: toLocationResponse(location),
          items,
          isLocationParsed: isLocationValid(location),
          orderItemsValidation: processingSummary.orderItemsValidation,
        },
        processingSummary,
      });
    }

    let buffer: Buffer;
    const raw = body.file ?? body.data;
    const singleUrl =
      typeof body.url === "string" && body.url.trim().length > 0 ? body.url.trim() : null;

    if (raw && typeof raw === "string") {
      try {
        buffer = Buffer.from(raw, "base64");
      } catch {
        return NextResponse.json(
          { error: "Invalid base64 in file/data" },
          { status: 400 }
        );
      }
      if (!buffer.length) {
        return NextResponse.json(
          { error: "No file uploaded or file is empty" },
          { status: 400 }
        );
      }
    } else if (singleUrl) {
      try {
        const parsedUrl = new URL(singleUrl);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          return NextResponse.json(
            { error: "URL must use http or https" },
            { status: 400 }
          );
        }
        const resp = await fetch(parsedUrl.toString());
        if (!resp.ok) {
          return NextResponse.json(
            { error: "Failed to fetch URL", status: resp.status },
            { status: 400 }
          );
        }
        const arrayBuf = await resp.arrayBuffer();
        buffer = Buffer.from(new Uint8Array(arrayBuf));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Invalid URL";
        return NextResponse.json(
          { error: "Failed to fetch contract URL", details: msg },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Missing file, data (base64 EML), or url" },
        { status: 400 }
      );
    }

    const parsed = await parseEML(buffer);
    const extractedLinks = extractContractLinks(parsed);
    const hasOriginal =
      extractedLinks.originalContractUrl &&
      validateAddendumUrl(extractedLinks.originalContractUrl);
    const hasAddendums =
      extractedLinks.addendumUrls.length > 0 &&
      extractedLinks.addendumUrls.every(validateAddendumUrl);

    if (hasOriginal || hasAddendums) {
      const originalContractUrl = extractedLinks.originalContractUrl ?? "";
      const addendumLinks = extractedLinks.addendumUrls ?? [];
      const locationFromEml = extractLocation(parsed.text);
      const { location, items } = await runLinksFlow({
        originalContractUrl,
        addendumLinks,
        locationOverride: locationFromEml,
      });
      const orderItemsValidation = validateOrderItemsTotal(
        items,
        location.orderGrandTotal,
        0.01
      );
      const processingSummary = {
        emlParsed: true,
        linksDetected: true,
        originalContractUrl: extractedLinks.originalContractUrl ?? null,
        addendumCount: addendumLinks.length,
        itemsCount: items.length,
        orderItemsValidation: {
          isValid: orderItemsValidation.isValid,
          itemsTotal: orderItemsValidation.itemsTotal,
          orderGrandTotal: orderItemsValidation.orderGrandTotal,
          difference: orderItemsValidation.difference,
          message: orderItemsValidation.message,
        },
      };
      return NextResponse.json({
        success: true,
        data: {
          location: toLocationResponse(location),
          items,
          isLocationParsed: isLocationValid(location),
          orderItemsValidation: processingSummary.orderItemsValidation,
        },
        processingSummary,
      });
    }

    const location = extractLocation(parsed.text);
    let items = extractOrderItems(parsed.html);
    items = filterItems(
      items,
      includeMainCategoriesDefault,
      includeSubcategoriesDefault
    );
    const isLocationParsed = isLocationValid(location);
    const orderItemsValidation = validateOrderItemsTotal(
      items,
      location.orderGrandTotal,
      0.01
    );
    const contractDate = location.orderDate
      ? normalizeToMmddyyyy(location.orderDate)
      : null;
    const locationWithDate = contractDate
      ? { ...location, contractDate }
      : location;
    const processingSummary = {
      emlParsed: true,
      linksDetected: false,
      locationExtracted: isLocationParsed,
      itemsCount: items.length,
      orderItemsValidation: {
        isValid: orderItemsValidation.isValid,
        itemsTotal: orderItemsValidation.itemsTotal,
        orderGrandTotal: orderItemsValidation.orderGrandTotal,
        difference: orderItemsValidation.difference,
        message: orderItemsValidation.message,
      },
    };
    return NextResponse.json({
      success: true,
      data: {
        location: toLocationResponse(locationWithDate),
        items,
        isLocationParsed,
        orderItemsValidation: processingSummary.orderItemsValidation,
      },
      processingSummary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parse failed";
    console.error("[parse-contract]", err);
    return NextResponse.json(
      { error: "Contract parse failed", details: message },
      { status: 500 }
    );
  }
}
