-- ==============================================================================
-- STEP 5: MULTI-TENANCY AUTHENTICATION & MANAGER PROFILE POLICIES
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/jzpgknlbroofetpwsicp/sql
-- ==============================================================================

-- 1. Ensure profiles table has collection bank columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT 'Zenith Bank PLC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_number TEXT DEFAULT '1012345678';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_name TEXT DEFAULT 'Babatunde & Associates Client Account';

-- 2. Ensure manager_id columns exist across core operational tables
ALTER TABLE properties ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Row Level Security for Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles read" ON profiles;
DROP POLICY IF EXISTS "Managers insert own profile" ON profiles;
DROP POLICY IF EXISTS "Managers update own profile" ON profiles;

CREATE POLICY "Public profiles read"
ON profiles FOR SELECT
USING (true);

CREATE POLICY "Managers insert own profile"
ON profiles FOR INSERT
WITH CHECK (true);

CREATE POLICY "Managers update own profile"
ON profiles FOR UPDATE
USING (true);

-- 4. Enable seamless tenant access for invoices without requiring login
DROP POLICY IF EXISTS "Tenant magic link access to invoices" ON invoices;
CREATE POLICY "Tenant magic link access to invoices"
ON invoices FOR SELECT
USING (true);

CREATE POLICY "Tenant submit proof on invoices"
ON invoices FOR UPDATE
USING (true);
