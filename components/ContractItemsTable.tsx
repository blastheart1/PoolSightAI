"use client";

import { useState } from "react";
import {
  FolderIcon,
  FolderOpenIcon,
} from "@heroicons/react/24/outline";
import type { OrderItem } from "../lib/contractTypes";
import { clsx } from "clsx";

function formatNum(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatPct(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(n)) return "—";
  return `${Math.round(n)}%`;
}

export interface ContractItemsTableProps {
  items: (OrderItem & { id?: string })[];
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showCheckboxes?: boolean;
  showMainCategories?: boolean;
  showSubcategories?: boolean;
  /** When true, render Show/Hide Main Category and Subcategory toggles in header */
  showVisibilityToggles?: boolean;
}

export function ContractItemsTable({
  items,
  selectedIds = [],
  onSelectionChange,
  showCheckboxes = false,
  showMainCategories: controlledMain = true,
  showSubcategories: controlledSub = true,
  showVisibilityToggles = false,
}: ContractItemsTableProps) {
  const [localMain, setLocalMain] = useState(true);
  const [localSub, setLocalSub] = useState(true);
  const showMainCategories = showVisibilityToggles ? localMain : controlledMain;
  const showSubcategories = showVisibilityToggles ? localSub : controlledSub;

  const filtered = items.filter((it) => {
    if (it.type === "maincategory") return showMainCategories;
    if (it.type === "subcategory") return showSubcategories;
    return true;
  });

  const toggleSelection = (id: string) => {
    if (!onSelectionChange) return;
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onSelectionChange(Array.from(set));
  };

  const selectAllItems = () => {
    if (!onSelectionChange) return;
    const itemIds = items.filter((i) => i.type === "item").map((i) => i.id ?? "");
    const valid = itemIds.filter(Boolean);
    onSelectionChange(valid);
  };

  const clearSelection = () => {
    onSelectionChange?.([]);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Order Items</h2>
          <p className="text-sm text-slate-500">
            {items.length} item{items.length !== 1 ? "s" : ""} in this order
          </p>
        </div>
        {(showCheckboxes || showVisibilityToggles) && (
          <div className="flex flex-wrap items-center gap-3">
            {showVisibilityToggles && (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={localMain}
                    onChange={(e) => setLocalMain(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Main Category
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={localSub}
                    onChange={(e) => setLocalSub(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Subcategory
                </label>
              </div>
            )}
            {showCheckboxes && (
              <>
            <button
              type="button"
              onClick={selectAllItems}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Select all line items
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear
            </button>
              </>
            )}
          </div>
        )}
      </header>
      <div className="relative w-full overflow-auto min-h-[200px] max-h-[450px]">
        <table className="w-full caption-bottom text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-200 font-semibold text-slate-900">
              {showCheckboxes && (
                <th
                  scope="col"
                  className="h-10 w-10 px-2 text-left align-middle"
                  aria-label="Select"
                >
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th scope="col" className="h-10 px-2 text-left align-middle min-w-[200px]">
                Product / Service
              </th>
              <th scope="col" className="h-10 w-[70px] px-2 text-right align-middle">
                Qty
              </th>
              <th scope="col" className="h-10 w-[86px] px-2 text-right align-middle">
                Rate
              </th>
              <th scope="col" className="h-10 w-[95px] px-2 text-right align-middle font-medium">
                Amount
              </th>
              <th scope="col" className="h-10 w-[90px] px-2 text-right align-middle">
                Progress %
              </th>
              <th scope="col" className="h-10 w-[105px] px-2 text-right align-middle border-r border-slate-300">
                This Bill
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => {
              const isMain = item.type === "maincategory";
              const isSub = item.type === "subcategory";
              const isItem = item.type === "item";
              const id = item.id ?? `row-${idx}`;
              const isSelected = selectedIds.includes(id);
              const canSelect = isItem && showCheckboxes;
              return (
                <tr
                  key={id}
                  className={clsx(
                    "border-b border-slate-200 transition-colors",
                    isMain && "bg-slate-300 font-semibold text-slate-900",
                    isSub && "bg-slate-100 font-medium text-slate-800",
                    isItem && "bg-white text-slate-700",
                    canSelect && "hover:bg-green-200"
                  )}
                >
                  {showCheckboxes && (
                    <td className="p-2 align-middle w-10">
                      {isItem ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(id)}
                          aria-label={`Select ${item.productService}`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      ) : null}
                    </td>
                  )}
                  <td className="min-w-[200px] p-2 align-middle">
                    <div className="flex items-start gap-2 min-w-0">
                      {isMain && (
                        <FolderIcon className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-700" aria-hidden />
                      )}
                      {isSub && (
                        <FolderOpenIcon className="h-4 w-4 flex-shrink-0 ml-2 mt-0.5 text-slate-600" aria-hidden />
                      )}
                      <span className="break-words min-w-0">{item.productService}</span>
                    </div>
                  </td>
                  <td className="w-[70px] p-2 text-right align-middle">
                    {isItem ? formatNum(item.qty) : ""}
                  </td>
                  <td className="w-[86px] p-2 text-right align-middle">
                    {isItem ? formatNum(item.rate) : ""}
                  </td>
                  <td className="w-[95px] p-2 text-right align-middle font-medium">
                    {isItem ? (item.amount != null ? `$${formatNum(item.amount)}` : "—") : ""}
                  </td>
                  <td className="w-[90px] p-2 text-right align-middle">
                    {isItem ? formatPct(item.progressOverallPct) : ""}
                  </td>
                  <td className="w-[105px] p-2 text-right align-middle border-r border-slate-200">
                    {isItem ? (item.thisBill != null ? `$${formatNum(item.thisBill)}` : "—") : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
