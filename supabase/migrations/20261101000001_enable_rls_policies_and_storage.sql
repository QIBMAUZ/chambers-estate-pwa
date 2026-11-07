-- ==============================================================================
-- STEP 3: RLS POLICIES & STORAGE BUCKET MIGRATION
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/jzpgknlbroofetpwsicp/sql
-- ==============================================================================

-- 1. Create 'receipts' Storage Bucket for Bank Transfer Proofs & Artisan Invoices
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf'];

-- 2. Storage Bucket RLS Policies for 'receipts'
CREATE POLICY "Allow public read access to receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

CREATE POLICY "Allow public upload to receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Allow public update to receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipts');

-- 3. Table Row Level Security (RLS) Policies
-- Enables seamless access for Legal Property Managers and Tenants via Magic Link

-- Landlords
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to landlords"
ON landlords FOR ALL
USING (true)
WITH CHECK (true);

-- Properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to properties"
ON properties FOR ALL
USING (true)
WITH CHECK (true);

-- Units
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to units"
ON units FOR ALL
USING (true)
WITH CHECK (true);

-- Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to invoices"
ON invoices FOR ALL
USING (true)
WITH CHECK (true);

-- Transactions Ledger
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access to transactions"
ON transactions FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Grant access to views & functions
GRANT SELECT ON property_balances TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION verify_tenant_invoice TO anon, authenticated, service_role;
