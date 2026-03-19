import type { OrderItem } from "./contractTypes";

export function calculateOrderItemsTotal(items: OrderItem[]): number {
  if (!items?.length) return 0;
  let total = 0;
  for (const item of items) {
    if (item.type !== "item" || item.amount == null) continue;
    const amount =
      typeof item.amount === "string"
        ? parseFloat(String(item.amount).replace(/[$,*]/g, ""))
        : Number(item.amount);
    if (!isNaN(amount) && amount > 0) total += amount;
  }
  return total;
}

export function validateOrderItemsTotal(
  items: OrderItem[],
  orderGrandTotal: number | undefined,
  tolerance = 0.01
): {
  isValid: boolean;
  itemsTotal: number;
  orderGrandTotal: number;
  difference: number;
  message?: string;
} {
  const itemsTotal = calculateOrderItemsTotal(items);
  if (!orderGrandTotal || orderGrandTotal === 0) {
    return {
      isValid: false,
      itemsTotal,
      orderGrandTotal: 0,
      difference: itemsTotal,
      message: "Order Grand Total is missing or zero",
    };
  }
  const difference = Math.abs(itemsTotal - orderGrandTotal);
  const isValid = difference <= tolerance;
  return {
    isValid,
    itemsTotal,
    orderGrandTotal,
    difference,
    message: isValid
      ? undefined
      : `Grand Total ($${orderGrandTotal.toFixed(2)}) differs from line items sum ($${itemsTotal.toFixed(2)}). Difference: $${difference.toFixed(2)}`,
  };
}
