/**
 * Contract and project types for parser I/O and client state.
 * Mirrors CalimingoPools OrderItem/Location; does not depend on that repo.
 */

export type OrderItemType = "maincategory" | "subcategory" | "item";

export interface Location {
  orderNo: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  clientName?: string;
  email?: string;
  phone?: string;
  orderDate?: string;
  orderPO?: string;
  orderDueDate?: string;
  orderType?: string;
  orderGrandTotal?: number;
  progressPayments?: string;
  balanceDue?: number;
  salesRep?: string;
  /** Normalized order date for response (e.g. MM/DD/YYYY) */
  contractDate?: string;
}

export interface OrderItem {
  id?: string; // stable id for selection (set when loading from DB or after parse)
  type: OrderItemType;
  productService: string;
  qty: number | string;
  rate: number | string;
  amount: number | string;
  mainCategory?: string | null;
  subCategory?: string | null;
  progressOverallPct?: number | string;
  completedAmount?: number | string;
  previouslyInvoicedPct?: number | string;
  previouslyInvoicedAmount?: number | string;
  newProgressPct?: number | string;
  thisBill?: number | string;
  isOptional?: boolean;
  optionalPackageNumber?: number;
  vendorName1?: string;
  vendorPercentage?: number | string;
  totalWorkAssignedToVendor?: number | string;
  estimatedVendorCost?: number | string;
  totalAmountWorkCompleted?: number | string;
  vendorBillingToDate?: number | string;
  vendorSavingsDeficit?: number | string;
  negotiatedVendorAmount?: number | string;
  /** Merge/addendum metadata (not stored in DB) */
  columnBLabel?: string;
  isBlankRow?: boolean;
  isAddendumHeader?: boolean;
  addendumNumber?: string;
  addendumUrlId?: string;
}

export interface Project {
  id: string;
  name: string;
  location?: Location | null;
  contractItems: OrderItem[];
  selectedLineItemIds: string[];
  createdAt: string;
  updatedAt?: string;
}

import type { ReconciliationResponse } from "../types/reconciliation";

export type { ReconciliationResponse };

export interface ReportEntry {
  id: string;
  projectId: string;
  asOfDate: string;
  reconciliationResult: ReconciliationResponse;
  createdAt?: string;
}
