-- ==============================================================================
-- STEP 6: UNITS TABLE MANAGER ID & RLS POLICIES
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/jzpgknlbroofetpwsicp/sql
-- ==============================================================================

-- 1. Ensure manager_id column exists on units
ALTER TABLE units ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Ensure RLS is active on units
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- 3. Replace units policies with manager-aware policies
DROP POLICY IF EXISTS "Allow full access to units" ON units;
DROP POLICY IF EXISTS "Managers full access to own units" ON units;
DROP POLICY IF EXISTS "Public read units" ON units;

-- Managers have full access to units they manage (or unassigned units)
CREATE POLICY "Managers full access to own units"
ON units FOR ALL
USING (auth.uid() = manager_id OR manager_id IS NULL)
WITH CHECK (auth.uid() = manager_id OR manager_id IS NULL);

-- Public read for tenant invoice access via magic link
CREATE POLICY "Public read units"
ON units FOR SELECT
USING (true);
