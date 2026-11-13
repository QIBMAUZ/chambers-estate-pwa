-- ==============================================================================
-- PRE-ENTRY TENANCY APPLICATION & HYBRID TENANCY AGREEMENT MIGRATION
-- Covers:
-- 1. tenancy_applications table (Pre-entry bio-data, employment, guarantor, passport photo & valid ID)
-- 2. units & tenancy_history upgrades (passport_photo_url, valid_id_url, agreement_token,
--    tenant_signature_url, tenant_signed_at, executed_agreement_scan_url, agreement_status)
-- 3. RLS Policies & Storage support for KYC documents, E-signatures & Scanned Hard Copies
-- ==============================================================================

-- 1. CREATE TENANCY APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS tenancy_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    applicant_name TEXT NOT NULL,
    applicant_phone TEXT NOT NULL,
    applicant_email TEXT,
    nin_or_id_number TEXT,
    occupation TEXT,
    employer TEXT,
    previous_address TEXT,
    guarantor_name TEXT NOT NULL,
    guarantor_phone TEXT NOT NULL,
    guarantor_address TEXT NOT NULL,
    guarantor_occupation TEXT,
    passport_photo_url TEXT,
    valid_id_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' -- 'PENDING' | 'APPROVED' | 'REJECTED'
);

-- 2. EXPAND UNITS & TENANCY_HISTORY FOR KYC DOCS & HYBRID TENANCY AGREEMENTS
ALTER TABLE units ADD COLUMN IF NOT EXISTS agreement_token UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE units ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_signature_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_signed_at TIMESTAMPTZ;
ALTER TABLE units ADD COLUMN IF NOT EXISTS executed_agreement_scan_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS agreement_status TEXT DEFAULT 'PENDING'; -- 'PENDING' | 'TENANT_E_SIGNED' | 'EXECUTED_HARD_COPY'

ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS tenant_signature_url TEXT;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS tenant_signed_at TIMESTAMPTZ;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS executed_agreement_scan_url TEXT;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS agreement_status TEXT DEFAULT 'PENDING';

-- 3. ENSURE STORAGE BUCKET SUPPORTS IMAGES & PDFS UP TO 10MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf'];

-- 4. ROW LEVEL SECURITY FOR TENANCY APPLICATIONS & PUBLIC SIGNING
ALTER TABLE tenancy_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read tenancy_applications" ON tenancy_applications;
CREATE POLICY "Allow public read tenancy_applications"
ON tenancy_applications FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Allow public insert tenancy_applications" ON tenancy_applications;
CREATE POLICY "Allow public insert tenancy_applications"
ON tenancy_applications FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow staff update tenancy_applications" ON tenancy_applications;
CREATE POLICY "Allow staff update tenancy_applications"
ON tenancy_applications FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Only Head of Chambers can delete tenancy_applications" ON tenancy_applications;
CREATE POLICY "Only Head of Chambers can delete tenancy_applications"
ON tenancy_applications FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Ensure public tenant signing (/sign/[token]) can update unit signature columns
DROP POLICY IF EXISTS "Allow full access to units" ON units;
CREATE POLICY "Allow full access to units"
ON units FOR ALL
USING (true)
WITH CHECK (true);

GRANT ALL ON tenancy_applications TO anon, authenticated, service_role;
