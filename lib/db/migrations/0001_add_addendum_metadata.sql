-- Addendum metadata columns for project_contract_items
-- Apply via: npx drizzle-kit push (preferred) or run this SQL manually
ALTER TABLE project_contract_items ADD COLUMN IF NOT EXISTS column_b_label VARCHAR(50);
ALTER TABLE project_contract_items ADD COLUMN IF NOT EXISTS is_addendum_header BOOLEAN DEFAULT false;
ALTER TABLE project_contract_items ADD COLUMN IF NOT EXISTS addendum_number VARCHAR(50);
ALTER TABLE project_contract_items ADD COLUMN IF NOT EXISTS addendum_url_id VARCHAR(255);
ALTER TABLE project_contract_items ADD COLUMN IF NOT EXISTS is_blank_row BOOLEAN DEFAULT false;
