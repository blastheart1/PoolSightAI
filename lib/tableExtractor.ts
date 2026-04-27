import { load } from "cheerio";
import type { Location, OrderItem } from "./contractTypes";
import { normalizeToMmddyyyy } from "./utils/dateFormat";

function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractField(pattern: string, text: string): string | null {
  const cleanValue = (v: string | null): string | null => {
    if (!v) return null;
    const c = v.replace(/\*/g, "").trim();
    return c.length > 0 ? c : null;
  };
  const asteriskPattern = new RegExp(
    `\\*${pattern}[:：]\\*([^\\n\\r]*)`,
    "i"
  );
  let match = text.match(asteriskPattern);
  if (match) return cleanValue(match[1]);
  const asteriskNoValue = new RegExp(
    `\\*${pattern}[:：]\\s*([^\\n\\r]*)`,
    "i"
  );
  match = text.match(asteriskNoValue);
  if (match) return cleanValue(match[1]);
  const regular = new RegExp(`${pattern}[:：]\\s*([^\\n\\r]*)`, "i");
  match = text.match(regular);
  if (match) return cleanValue(match[1]);
  return null;
}

export function extractLocation(text: string): Location {
  const location: Location = {
    orderNo: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
  };
  if (!text?.trim()) return location;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const orderId = extractField("Order\\s+[Ii][Dd]", normalized);
  if (orderId) location.orderNo = orderId;
  const client = extractField("Client", normalized);
  if (client) location.clientName = client;
  const address = extractField("Address", normalized);
  if (address) location.streetAddress = address;
  const city = extractField("City", normalized);
  if (city) location.city = city;
  const state = extractField("State", normalized);
  if (state) location.state = state;
  const zip = extractField("Zip", normalized);
  if (zip) location.zip = zip;
  const email = extractField("Email", normalized);
  if (email) location.email = email;
  const phone = extractField("Phone", normalized);
  if (phone) location.phone = phone;
  const orderDate = extractField("Order\\s+Date", normalized);
  if (orderDate && orderDate !== "0") {
    const d = normalizeToMmddyyyy(orderDate);
    if (d) location.orderDate = d;
  }
  const orderPO = extractField("Order\\s+Po", normalized);
  if (orderPO) location.orderPO = orderPO;
  const orderDue = extractField("Order\\s+Due\\s+Date", normalized);
  if (orderDue && orderDue !== "0") location.orderDueDate = orderDue;
  const orderType = extractField("Order\\s+Type", normalized);
  if (orderType) location.orderType = orderType;
  const grandTotal = extractField("Order\\s+Grand\\s+Total", normalized);
  if (grandTotal) {
    const parsed = parseFloat(grandTotal.replace(/[$,*]/g, ""));
    if (!isNaN(parsed) && parsed > 0) location.orderGrandTotal = parsed;
  }
  const balanceDue = extractField("Balance\\s+Due", normalized);
  if (balanceDue) {
    const parsed = parseFloat(balanceDue.replace(/[$,*]/g, ""));
    if (!isNaN(parsed) && parsed >= 0) location.balanceDue = parsed;
  }
  const salesRep = extractField("Sales\\s+Rep", normalized);
  if (salesRep) location.salesRep = salesRep;
  const progressPayments = extractField("Progress\\s+Payments", normalized);
  if (progressPayments) location.progressPayments = progressPayments;

  return location;
}

export function isLocationValid(location: Location): boolean {
  const hasAddress =
    !!location.streetAddress && location.streetAddress.trim().length > 0;
  const hasOrderNo =
    !!location.orderNo && location.orderNo.trim().length > 0;
  const hasClient =
    !!location.clientName && location.clientName.trim().length > 0;
  const hasAsterisks = (v: string | undefined | null) =>
    !!v && v.includes("*");
  if (
    hasAsterisks(location.clientName) ||
    hasAsterisks(location.streetAddress) ||
    hasAsterisks(location.city) ||
    hasAsterisks(location.state) ||
    hasAsterisks(location.zip) ||
    hasAsterisks(location.orderNo)
  ) {
    return false;
  }
  return (hasClient || hasOrderNo) && hasAddress;
}

function extractQuantity(qtyStr: string): number {
  if (!qtyStr) return 1;
  const cleaned = qtyStr.replace(/\u00A0/g, " ").trim();
  const match = cleaned.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 1;
}

export function extractOrderItems(html: string): OrderItem[] {
  const $ = load(html);
  const items: OrderItem[] = [];
  let table = $("table.pos");
  if (table.length === 0) {
    $("table").each((_, el) => {
      const candidate = $(el);
      let found = false;
      candidate.find("tr").each((__, row) => {
        const cells = $(row).find("td");
        if (cells.length >= 3) {
          const t0 = cleanText(cells.eq(0).text()).toUpperCase();
          const t1 = cleanText(cells.eq(1).text()).toUpperCase();
          const t2 = cleanText(cells.eq(2).text()).toUpperCase();
          if (
            (t0.includes("DESCRIPTION") || t0 === "DESCRIPTION") &&
            (t1.includes("QTY") || t1 === "QTY") &&
            (t2.includes("EXTENDED") || t2 === "EXTENDED")
          ) {
            found = true;
            return false;
          }
        }
      });
      if (found && table.length === 0) table = candidate;
    });
  }
  if (table.length === 0) throw new Error("Order Items Table not found");

  const rows = table.children("tbody").length > 0
    ? table.children("tbody").children("tr")
    : table.children("tr");
  const rowsArray: ReturnType<typeof $>[] = [];
  rows.each((_, row) => {
    rowsArray.push($(row));
  });

  let currentMainCategory: string | null = null;
  let currentSubCategory: string | null = null;

  rowsArray.forEach(($row) => {
    const cells = $row.find("> td");
    if (cells.length === 0) return;

    const rowText = cleanText($row.text()).toLowerCase();
    const firstCell = cells.first();
    const firstCellText = cleanText(firstCell.text()).toLowerCase();

    const isSummaryRow =
      firstCellText === "subtotal" ||
      firstCellText === "tax" ||
      firstCellText === "grand total" ||
      firstCellText === "current balance" ||
      firstCellText.startsWith("subtotal") ||
      firstCellText.startsWith("grand total") ||
      (rowText.includes("phase") && rowText.includes("completed"));
    if (isSummaryRow) return;

    const isSubCategoryByClass =
      $row.hasClass("ssg_title") || firstCell.hasClass("ssg_title");
    const secondCell = cells.eq(1);
    const secondStyle = secondCell.attr("style") || "";
    const isSubCategoryByStyle =
      (cleanText(firstCell.text()) === "" || !cleanText(firstCell.text()).trim()) &&
      (secondStyle.includes("border-top:solid 1px #bbb") ||
        secondStyle.includes("border-top:solid 1px #BBB")) &&
      secondCell.find("strong").length > 0 &&
      cells.length >= 2;

    if (isSubCategoryByClass || isSubCategoryByStyle) {
      const categoryName = isSubCategoryByClass
        ? cleanText(firstCell.text())
        : cleanText(secondCell.find("strong").first().text()) ||
          cleanText(secondCell.text());
      if (categoryName?.trim()) {
        currentSubCategory = categoryName;
        items.push({
          type: "subcategory",
          productService: categoryName,
          qty: "",
          rate: "",
          amount: "",
        });
      }
      return;
    }

    if (cells.length >= 3) {
      const firstStyle = firstCell.attr("style") || "";
      const firstPlain = cleanText(firstCell.text());
      const isMainCategoryOld =
        (firstCell.html() || "").includes("font-weight: bold") ||
        firstCell.find("strong").length > 0;
      const isMainCategoryNew =
        (firstStyle.includes("border-top:solid 1px #666") ||
          firstStyle.includes("border-top: solid 1px #666")) &&
        /^\d{4}\s+Calimingo/.test(firstPlain);
      const isMainCategory = isMainCategoryOld || isMainCategoryNew;

      if (isMainCategory) {
        const qtyText = cleanText(cells.eq(1).text());
        const amountText = cleanText(cells.eq(2).text());
        if (qtyText.trim() && amountText.trim()) {
          let categoryName = firstPlain;
          const boldSpan = firstCell.find(
            'span[style*="font-weight: bold"], span[style*="font-size: 14px"]'
          ).first();
          if (boldSpan.length) categoryName = cleanText(boldSpan.text());
          else if (firstCell.find("strong").length)
            categoryName = cleanText(firstCell.find("strong").first().text());
          categoryName = categoryName.replace(/:\s*$/, "").trim();
          const emTag = firstCell.find("em").first();
          const desc = emTag.length ? cleanText(emTag.text()) : "";
          const fullName = desc
            ? `${categoryName} - ${desc}:`
            : `${categoryName}:`;
          currentMainCategory = fullName;
          currentSubCategory = null;
          items.push({
            type: "maincategory",
            productService: fullName,
            qty: "",
            rate: "",
            amount: "",
          });
          const amount = parseFloat(amountText.replace(/[$,]/g, "")) || 0;
          if (amount > 0) {
            const qty = extractQuantity(qtyText);
            items.push({
              type: "item",
              productService: fullName.replace(/:\s*$/, ""),
              qty,
              rate: qty > 0 ? amount / qty : amount,
              amount,
              mainCategory: fullName,
            });
          }
        }
        return;
      }

      const isIndented =
        firstStyle.includes("padding-left: 30px") ||
        firstStyle.includes("padding-left:30px");
      const cellHtml = firstCell.html() || "";
      const description = cleanText(
        cellHtml
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "$1")
          .replace(/<em[^>]*>(.*?)<\/em>/gi, "$1")
          .replace(/<br\s*\/?>/gi, " ")
          .replace(/<\/?[^>]+(>|$)/g, " ")
      );
      const qtyText = cleanText(cells.eq(1).text());
      const amountText = cleanText(cells.eq(2).text());
      if (
        description.toLowerCase().includes("description") &&
        qtyText.toLowerCase().includes("qty")
      )
        return;
      if (!description?.trim()) return;
      if (
        description.toLowerCase().includes("subtotal") ||
        description.toLowerCase().includes("grand total")
      )
        return;
      if (isIndented || (qtyText && amountText)) {
        const qty = extractQuantity(qtyText);
        let amountStr = amountText;
        const strongTag = cells.eq(2).find("strong");
        if (strongTag.length) amountStr = cleanText(strongTag.text());
        const amount = parseFloat(amountStr.replace(/[$,]/g, "")) || 0;
        if (
          description.trim().length > 0 &&
          (amount > 0 || isIndented)
        ) {
          items.push({
            type: "item",
            productService: description,
            qty,
            rate: qty > 0 ? amount / qty : 0,
            amount,
            mainCategory: currentMainCategory ?? undefined,
            subCategory: currentSubCategory ?? undefined,
          });
        }
      }
    }
  });

  return items;
}

export { calculateOrderItemsTotal, validateOrderItemsTotal } from "./orderItemsValidation";
