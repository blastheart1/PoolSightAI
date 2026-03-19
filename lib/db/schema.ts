import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  pgEnum,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const itemTypeEnum = pgEnum("item_type", [
  "maincategory",
  "subcategory",
  "item",
]);

// Projects – one row per Calimingo Project (location snapshot from contract parse)
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    orderNo: varchar("order_no", { length: 255 }),
    streetAddress: varchar("street_address", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zip: varchar("zip", { length: 20 }),
    clientName: varchar("client_name", { length: 255 }),
    orderGrandTotal: decimal("order_grand_total", { precision: 15, scale: 2 }),
    trelloLinks: text("trello_links"), // newline- or comma-separated URLs
    parsedAt: timestamp("parsed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    createdAtIdx: index("projects_created_at_idx").on(table.createdAt),
  })
);

// Project contract items – full parsed rows for table display
export const projectContractItems = pgTable(
  "project_contract_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    rowIndex: integer("row_index").notNull(),
    itemType: itemTypeEnum("item_type").notNull(),
    productService: text("product_service").notNull(),
    qty: decimal("qty", { precision: 15, scale: 2 }),
    rate: decimal("rate", { precision: 15, scale: 2 }),
    amount: decimal("amount", { precision: 15, scale: 2 }),
    mainCategory: varchar("main_category", { length: 255 }),
    subCategory: varchar("sub_category", { length: 255 }),
    progressOverallPct: decimal("progress_overall_pct", {
      precision: 10,
      scale: 4,
    }),
    completedAmount: decimal("completed_amount", { precision: 15, scale: 2 }),
    previouslyInvoicedPct: decimal("previously_invoiced_pct", {
      precision: 10,
      scale: 4,
    }),
    previouslyInvoicedAmount: decimal("previously_invoiced_amount", {
      precision: 15,
      scale: 2,
    }),
    newProgressPct: decimal("new_progress_pct", { precision: 10, scale: 4 }),
    thisBill: decimal("this_bill", { precision: 15, scale: 2 }),
    optionalPackageNumber: integer("optional_package_number"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("project_contract_items_project_id_idx").on(
      table.projectId
    ),
  })
);

// Which contract line items are selected for progress billing / AI analysis
export const projectSelectedItems = pgTable(
  "project_selected_items",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contractItemId: uuid("contract_item_id")
      .notNull()
      .references(() => projectContractItems.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: unique("project_selected_items_pk").on(
      table.projectId,
      table.contractItemId
    ),
    projectIdIdx: index("project_selected_items_project_id_idx").on(
      table.projectId
    ),
  })
);

// AI analysis entries – one per run
export const aiAnalysisEntries = pgTable(
  "ai_analysis_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    asOfDate: varchar("as_of_date", { length: 10 }).notNull(),
    pmUpdate: text("pm_update"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("ai_analysis_entries_project_id_idx").on(table.projectId),
  })
);

// Images uploaded with each analysis run
export const aiAnalysisImages = pgTable(
  "ai_analysis_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => aiAnalysisEntries.id, { onDelete: "cascade" }),
    storageKey: text("storage_key"), // blob url or path
    contentType: varchar("content_type", { length: 100 }),
    sequence: integer("sequence"),
  },
  (table) => ({
    analysisIdIdx: index("ai_analysis_images_analysis_id_idx").on(
      table.analysisId
    ),
  })
);

// AI analysis results – 1:1 with entry, full reconciliation jsonb
export const aiAnalysisResults = pgTable("ai_analysis_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  analysisId: uuid("analysis_id")
    .notNull()
    .references(() => aiAnalysisEntries.id, { onDelete: "cascade" })
    .unique(),
  reconciliationResult: jsonb("reconciliation_result").notNull(),
});

// Optional: link AI result rows to contract line items
export const aiAnalysisResultLineItems = pgTable(
  "ai_analysis_result_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    analysisResultId: uuid("analysis_result_id")
      .notNull()
      .references(() => aiAnalysisResults.id, { onDelete: "cascade" }),
    contractItemId: uuid("contract_item_id").references(
      () => projectContractItems.id,
      { onDelete: "set null" }
    ),
    sectionId: varchar("section_id", { length: 100 }),
    lineItem: text("line_item").notNull(),
    currentPercent: varchar("current_percent", { length: 20 }),
    suggestedPercent: varchar("suggested_percent", { length: 20 }),
    status: varchar("status", { length: 20 }),
    notes: text("notes"),
  },
  (table) => ({
    analysisResultIdIdx: index(
      "ai_analysis_result_line_items_analysis_result_id_idx"
    ).on(table.analysisResultId),
    contractItemIdIdx: index(
      "ai_analysis_result_line_items_contract_item_id_idx"
    ).on(table.contractItemId),
  })
);
