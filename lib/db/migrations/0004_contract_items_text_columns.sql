-- Widen main_category and sub_category from varchar(255) to text.
-- Contract line item descriptions can exceed 255 characters and must be stored in full.
-- Apply via: npx drizzle-kit push (preferred) or run this SQL manually
ALTER TABLE project_contract_items ALTER COLUMN main_category TYPE text;
ALTER TABLE project_contract_items ALTER COLUMN sub_category TYPE text;
