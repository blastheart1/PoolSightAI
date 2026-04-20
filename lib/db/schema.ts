import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  serial,
  pgEnum,
  jsonb,
  boolean,
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
    orderNoIdx: index("projects_order_no_idx").on(table.orderNo),
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
    // Addendum metadata
    columnBLabel: varchar("column_b_label", { length: 50 }),
    isAddendumHeader: boolean("is_addendum_header").default(false),
    addendumNumber: varchar("addendum_number", { length: 50 }),
    addendumUrlId: varchar("addendum_url_id", { length: 255 }),
    isBlankRow: boolean("is_blank_row").default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("project_contract_items_project_id_idx").on(
      table.projectId
    ),
  })
);

// Structured Trello list links for a project (replaces free-text trelloLinks field)
export const projectTrelloLinks = pgTable(
  "project_trello_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    listId: text("list_id").notNull(),
    listName: text("list_name"),
    boardId: text("board_id"),
    boardName: text("board_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("project_trello_links_project_id_idx").on(table.projectId),
    uniqueProjectList: unique("project_trello_links_project_list_unique").on(
      table.projectId,
      table.listId
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
    trelloListId: text("trello_list_id"),
    imageSource: varchar("image_source", { length: 20 }), // "upload" | "trello" | "audio"
    audioTranscript: text("audio_transcript"),
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
    progressBefore: decimal("progress_before", { precision: 10, scale: 4 }),
    appliedAt: timestamp("applied_at"),
    appliedProgressPct: decimal("applied_progress_pct", { precision: 10, scale: 4 }),
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

// Saved PM voice note transcripts — standalone saves, not tied to an analysis run
export const projectVoiceNotes = pgTable(
  "project_voice_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    transcript: text("transcript").notNull(),
    label: varchar("label", { length: 255 }),
    wordCount: integer("word_count"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("project_voice_notes_project_id_idx").on(table.projectId),
  })
);

// ──────────────────────────────────────────────────────────────────────────
// WEBHOOK LOGS
// ──────────────────────────────────────────────────────────────────────────

export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: varchar("source", { length: 50 }).notNull(), // "zapier", "manual", etc.
  action: varchar("action", { length: 20 }), // "created", "updated", "skipped", "error"
  orderNo: varchar("order_no", { length: 255 }),
  clientName: varchar("client_name", { length: 255 }),
  projectId: uuid("project_id"),
  emailSubject: varchar("email_subject", { length: 500 }),
  itemCount: integer("item_count"),
  payloadKeys: text("payload_keys"), // JSON array of field names
  payloadSizes: text("payload_sizes"), // JSON object of field→length
  preParseResult: jsonb("pre_parse_result"),
  parseResult: jsonb("parse_result"), // item count, types, first few items
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ──────────────────────────────────────────────────────────────────────────
// PERMITS MODULE
// ──────────────────────────────────────────────────────────────────────────

// Lean single-table cache for Lightbox zoning lookups (trial).
// Dedups API calls when the same address (normalized) is queried repeatedly.
// Post-trial, this will be split into the 3-table pattern described in
// test-files/lightbox-cache-plan.md.
export const lightboxZoningCache = pgTable(
  "lightbox_zoning_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rawAddress: text("raw_address").notNull(),
    normalizedAddress: text("normalized_address").notNull(),
    parcelId: text("parcel_id"),
    jurisdiction: text("jurisdiction"),
    zoningData: jsonb("zoning_data"),
    httpStatus: integer("http_status").notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (table) => ({
    normalizedUnique: unique("lightbox_zoning_cache_normalized_unique").on(
      table.normalizedAddress,
    ),
    parcelIdIdx: index("lightbox_zoning_cache_parcel_id_idx").on(
      table.parcelId,
    ),
  }),
);

// AI inference cache for zoning codes that lack explicit dimensional standards
// in Lightbox. Keyed by (jurisdiction, zoning_code) after normalization
// (lowercase + trim). Shared across all addresses within the same code.
export const zoningCodeInferenceCache = pgTable(
  "zoning_code_inference_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdiction: text("jurisdiction").notNull(),
    zoningCode: text("zoning_code").notNull(),
    inferenceData: jsonb("inference_data").notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (table) => ({
    uniq: unique("zoning_code_inference_cache_unique").on(
      table.jurisdiction,
      table.zoningCode,
    ),
  }),
);

export const permitProjects = pgTable("permit_projects", {
  id: serial("id").primaryKey(),
  projectId: uuid("project_id").references(() => projects.id),
  address: text("address").notNull(),
  apn: text("apn"),
  projectType: text("project_type").notNull(),
  zoningClassification: text("zoning_classification"),
  status: text("status").default("intake"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const permitDocuments = pgTable("permit_documents", {
  id: serial("id").primaryKey(),
  permitProjectId: integer("permit_project_id").references(
    () => permitProjects.id
  ),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const permitRedlines = pgTable("permit_redlines", {
  id: serial("id").primaryKey(),
  permitProjectId: integer("permit_project_id").references(
    () => permitProjects.id
  ),
  rawCorrections: text("raw_corrections").notNull(),
  draftResponse: text("draft_response"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
