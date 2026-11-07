-- ==============================================================================
-- STEP 4: CHAMBERS PROFILE & DYNAMIC LETTERHEAD BRANDING MIGRATION
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/jzpgknlbroofetpwsicp/sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    firm_name TEXT NOT NULL DEFAULT 'BARR. T. A. BABATUNDE & ASSOCIATES',
    solicitor_name TEXT NOT NULL DEFAULT 'Barr. T. A. Babatunde, LL.B, B.L',
    enrollment_no TEXT DEFAULT 'SCN/2004/0981',
    phone TEXT DEFAULT '+234 803 555 0192',
    email TEXT DEFAULT 'chambers@babatundelaw.ng',
    office_address TEXT DEFAULT 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria',
    letterhead_logo_url TEXT
);

-- Seed Default Chambers Profile
INSERT INTO profiles (
    id, firm_name, solicitor_name, enrollment_no, phone, email, office_address, letterhead_logo_url
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'BARR. T. A. BABATUNDE & ASSOCIATES',
    'Barr. T. A. Babatunde, LL.B, B.L',
    'SCN/2004/0981',
    '+234 803 555 0192',
    'chambers@babatundelaw.ng',
    'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria',
    NULL
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to profiles"
ON profiles FOR ALL
USING (true)
WITH CHECK (true);

GRANT ALL ON profiles TO anon, authenticated, service_role;
