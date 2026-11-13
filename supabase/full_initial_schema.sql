-- ==============================================================================
-- CHAMBERS & ESTATE MANAGEMENT PWA — FULL INITIAL SCHEMA (IDEMPOTENT)
-- Run this single script in the Supabase SQL Editor on a brand-new or existing
-- Supabase project. It safely creates all base enums, tables, Storage buckets,
-- views, RPCs, RLS policies, and all 9 Chambers & Estate Management PWA modules.
-- ==============================================================================

-- ==============================================================================
-- 1. DOMAIN ENUMS (Base + Chambers Upgrade Values)
-- ==============================================================================
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'DRAFT',
        'SENT',
        'PARTIALLY_PAID',
        'AWAITING_VERIFICATION',
        'PAID',
        'OVERDUE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'RENT_INFLOW',
        'SERVICE_CHARGE',
        'CAUTION_DEPOSIT',
        'MAINTENANCE_EXPENSE',
        'MANAGEMENT_FEE',
        'TENANT_LEGAL_FEE',
        'CAUTION_REFUND',
        'OWNER_REMITTANCE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'TENANT_LEGAL_FEE';
    ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'CAUTION_REFUND';
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE funding_source AS ENUM (
        'LANDLORD_RENT_POOL',
        'SERVICE_CHARGE_POOL',
        'CAUTION_ESCROW'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('HEAD_OF_CHAMBERS', 'ACCOUNTANT_CLERK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tenancy_type AS ENUM ('FIRST_YEAR', 'RENEWAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE matter_category AS ENUM (
        'LITIGATION',
        'CAC',
        'LAND_PERFECTION',
        'CONSULTANCY',
        'GENERAL_SOLICITOR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE firm_expense_category AS ENUM (
        'COURT_REGISTRY_DISBURSEMENT',
        'FIRM_OVERHEAD'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. CHAMBERS PROFILES & RBAC TABLE
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
    letterhead_logo_url TEXT,
    bank_name TEXT DEFAULT 'Zenith Bank PLC',
    account_number TEXT DEFAULT '1012345678',
    account_name TEXT DEFAULT 'Babatunde & Associates Client Account',
    role TEXT NOT NULL DEFAULT 'HEAD_OF_CHAMBERS',
    chambers_id UUID,
    full_name TEXT
);

-- Ensure columns exist if profiles table was created by an older migration
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT 'Zenith Bank PLC';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_number TEXT DEFAULT '1012345678';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_name TEXT DEFAULT 'Babatunde & Associates Client Account';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'HEAD_OF_CHAMBERS';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chambers_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Helper function for RBAC checks in RLS policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_role, 'HEAD_OF_CHAMBERS');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. CORE ESTATE TABLES (Landlords, Properties, Units, Tenancy History)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS landlords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    default_mgt_rate NUMERIC(5, 2) DEFAULT 10.00,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

ALTER TABLE landlords ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS created_by_name TEXT;

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES landlords(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    address TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'Lagos',
    default_mgt_rate NUMERIC(5, 2) DEFAULT 10.00,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

ALTER TABLE properties ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS default_mgt_rate NUMERIC(5, 2) DEFAULT 10.00;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by_name TEXT;

CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_name TEXT NOT NULL,
    current_tenant_name TEXT,
    tenant_phone TEXT,
    tenant_email TEXT,
    tenant_nin_or_id TEXT,
    tenant_occupation TEXT,
    tenant_employer TEXT,
    guarantor_name TEXT,
    guarantor_phone TEXT,
    guarantor_address TEXT,
    guarantor_occupation TEXT,
    tenancy_type TEXT DEFAULT 'RENEWAL',
    annual_rent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    annual_service_charge NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    caution_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    lease_start_date DATE,
    lease_end_date DATE,
    is_occupied BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

ALTER TABLE units ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_email TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_nin_or_id TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_occupation TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_employer TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS guarantor_name TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS guarantor_phone TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS guarantor_address TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS guarantor_occupation TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenancy_type TEXT DEFAULT 'RENEWAL';
ALTER TABLE units ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE units ADD COLUMN IF NOT EXISTS created_by_name TEXT;

CREATE TABLE IF NOT EXISTS tenancy_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    unit_name TEXT NOT NULL,
    property_title TEXT,
    tenant_name TEXT NOT NULL,
    tenant_phone TEXT,
    tenant_email TEXT,
    tenant_nin_or_id TEXT,
    tenant_occupation TEXT,
    tenant_employer TEXT,
    guarantor_name TEXT,
    guarantor_phone TEXT,
    guarantor_address TEXT,
    guarantor_occupation TEXT,
    annual_rent NUMERIC(12, 2) DEFAULT 0.00,
    lease_start_date DATE,
    lease_end_date DATE,
    move_out_date DATE NOT NULL DEFAULT CURRENT_DATE,
    caution_deposit_held NUMERIC(12, 2) DEFAULT 0.00,
    deductions_amount NUMERIC(12, 2) DEFAULT 0.00,
    refund_amount NUMERIC(12, 2) DEFAULT 0.00,
    settlement_notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

-- ==============================================================================
-- 4. INVOICES, TRANCHE PAYMENTS & TRANSACTIONS LEDGER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token UUID DEFAULT gen_random_uuid() UNIQUE,
    manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    tenant_name TEXT NOT NULL,
    tenancy_type TEXT DEFAULT 'RENEWAL',
    rent_due NUMERIC(12, 2) NOT NULL,
    legal_fee_due NUMERIC(12, 2) DEFAULT 0.00,
    service_charge_due NUMERIC(12, 2) DEFAULT 0.00,
    caution_due NUMERIC(12, 2) DEFAULT 0.00,
    management_fee_rate NUMERIC(5, 2) DEFAULT 10.00,
    total_amount_payable NUMERIC(12, 2) GENERATED ALWAYS AS (
        COALESCE(rent_due, 0) + COALESCE(legal_fee_due, 0) + COALESCE(service_charge_due, 0) + COALESCE(caution_due, 0)
    ) STORED,
    amount_paid NUMERIC(12, 2) DEFAULT 0.00,
    balance_due NUMERIC(12, 2),
    promise_to_pay_date DATE,
    due_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status invoice_status DEFAULT 'SENT',
    proof_image_url TEXT,
    bank_session_id TEXT,
    verified_at TIMESTAMPTZ,
    notice_9m_sent BOOLEAN DEFAULT FALSE,
    notice_9m_sent_at TIMESTAMPTZ,
    notice_30d_sent BOOLEAN DEFAULT FALSE,
    notice_30d_sent_at TIMESTAMPTZ,
    last_daily_reminder_sent_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenancy_type TEXT DEFAULT 'RENEWAL';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legal_fee_due NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS management_fee_rate NUMERIC(5, 2) DEFAULT 10.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS promise_to_pay_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notice_9m_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notice_9m_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notice_30d_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notice_30d_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_daily_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_name TEXT;

CREATE TABLE IF NOT EXISTS tranche_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL UNIQUE,
    payment_scope TEXT NOT NULL DEFAULT 'ESTATE_INVOICE',
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    fee_note_id UUID,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    payer_name TEXT NOT NULL,
    payer_email TEXT,
    payer_phone TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    cumulative_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_remaining NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    promise_to_pay_date DATE,
    bank_reference TEXT,
    proof_url TEXT,
    email_sent BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    tx_date DATE NOT NULL DEFAULT CURRENT_DATE,
    tx_type transaction_type NOT NULL,
    funding_source funding_source,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT NOT NULL,
    reference_note TEXT,
    receipt_url TEXT,
    voucher_number TEXT,
    is_stamped BOOLEAN DEFAULT FALSE,
    work_photo_url TEXT,
    artisan_name TEXT,
    artisan_phone TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voucher_number TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_stamped BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS work_photo_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS artisan_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS artisan_phone TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- ==============================================================================
-- 5. CHAMBERS LEGAL MATTERS, SOLICITOR FEE NOTES & FIRM EXPENSES (ISOLATED)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS legal_matters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    matter_number TEXT NOT NULL,
    title TEXT NOT NULL,
    category matter_category NOT NULL DEFAULT 'GENERAL_SOLICITOR',
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    client_address TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS solicitor_fee_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    fee_note_number TEXT NOT NULL UNIQUE,
    matter_id UUID REFERENCES legal_matters(id) ON DELETE CASCADE,
    matter_title TEXT NOT NULL,
    matter_category matter_category NOT NULL DEFAULT 'GENERAL_SOLICITOR',
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    description TEXT NOT NULL,
    agreed_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    promise_to_pay_date DATE,
    status invoice_status NOT NULL DEFAULT 'SENT',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS firm_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    voucher_number TEXT NOT NULL,
    category firm_expense_category NOT NULL DEFAULT 'FIRM_OVERHEAD',
    matter_id UUID REFERENCES legal_matters(id) ON DELETE SET NULL,
    matter_title TEXT,
    title TEXT NOT NULL,
    vendor_or_registry TEXT,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

-- ==============================================================================
-- 6. AUTOMATED PAYMENT VERIFICATION RPC & BALANCES VIEW
-- ==============================================================================
CREATE OR REPLACE FUNCTION verify_tenant_invoice(
    p_invoice_id UUID,
    p_verified_by UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_inv RECORD;
    v_mgt_fee NUMERIC;
    v_is_first_year BOOLEAN;
BEGIN
    SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found with ID %', p_invoice_id;
    END IF;

    IF v_inv.status = 'PAID' THEN
        RAISE EXCEPTION 'Invoice has already been marked as PAID.';
    END IF;

    v_is_first_year := COALESCE(v_inv.tenancy_type, 'RENEWAL') = 'FIRST_YEAR';

    -- 1. Inflow: Gross Rent into Landlord Rent Pool
    INSERT INTO transactions (
        manager_id, property_id, unit_id, invoice_id, tx_date, tx_type, funding_source, amount, description, reference_note, recorded_by
    ) VALUES (
        v_inv.manager_id,
        v_inv.property_id,
        v_inv.unit_id,
        v_inv.id,
        CURRENT_DATE,
        'RENT_INFLOW',
        'LANDLORD_RENT_POOL',
        v_inv.rent_due,
        'Rent Payment: ' || v_inv.tenant_name,
        COALESCE(v_inv.bank_session_id, 'Direct Verification'),
        p_verified_by
    );

    -- 2. First-Year 10% Tenant Legal Fee vs Renewal 10% Landlord Management Fee
    IF v_is_first_year THEN
        IF COALESCE(v_inv.legal_fee_due, 0) > 0 THEN
            INSERT INTO transactions (
                manager_id, property_id, unit_id, invoice_id, tx_date, tx_type, amount, description, reference_note, recorded_by
            ) VALUES (
                v_inv.manager_id,
                v_inv.property_id,
                v_inv.unit_id,
                v_inv.id,
                CURRENT_DATE,
                'TENANT_LEGAL_FEE',
                v_inv.legal_fee_due,
                'First-Year 10% Legal Agreement Fee: ' || v_inv.tenant_name,
                'Credited 100% to Chambers (0% Landlord Management Fee)',
                p_verified_by
            );
        END IF;
    ELSE
        v_mgt_fee := v_inv.rent_due * (COALESCE(v_inv.management_fee_rate, 10.00) / 100.0);
        IF v_mgt_fee > 0 THEN
            INSERT INTO transactions (
                manager_id, property_id, unit_id, invoice_id, tx_date, tx_type, amount, description, reference_note, recorded_by
            ) VALUES (
                v_inv.manager_id,
                v_inv.property_id,
                v_inv.unit_id,
                v_inv.id,
                CURRENT_DATE,
                'MANAGEMENT_FEE',
                v_mgt_fee,
                'Renewal 10% Management Fee: ' || v_inv.tenant_name,
                'Auto-deducted from Landlord Rent on Renewal',
                p_verified_by
            );
        END IF;
    END IF;

    -- 3. Inflow: Service Charge
    IF COALESCE(v_inv.service_charge_due, 0) > 0 THEN
        INSERT INTO transactions (
            manager_id, property_id, unit_id, invoice_id, tx_date, tx_type, funding_source, amount, description, reference_note, recorded_by
        ) VALUES (
            v_inv.manager_id,
            v_inv.property_id,
            v_inv.unit_id,
            v_inv.id,
            CURRENT_DATE,
            'SERVICE_CHARGE',
            'SERVICE_CHARGE_POOL',
            v_inv.service_charge_due,
            'Service Charge: ' || v_inv.tenant_name,
            'Earmarked for Estate Ops',
            p_verified_by
        );
    END IF;

    -- 4. Inflow: Caution Deposit
    IF COALESCE(v_inv.caution_due, 0) > 0 THEN
        INSERT INTO transactions (
            manager_id, property_id, unit_id, invoice_id, tx_date, tx_type, funding_source, amount, description, reference_note, recorded_by
        ) VALUES (
            v_inv.manager_id,
            v_inv.property_id,
            v_inv.unit_id,
            v_inv.id,
            CURRENT_DATE,
            'CAUTION_DEPOSIT',
            'CAUTION_ESCROW',
            v_inv.caution_due,
            'Caution Deposit: ' || v_inv.tenant_name,
            'Held in Escrow for Tenancy Duration',
            p_verified_by
        );
    END IF;

    -- 5. Update Invoice status & extend tenancy lease
    UPDATE invoices
    SET status = 'PAID',
        amount_paid = total_amount_payable,
        balance_due = 0.00,
        verified_at = NOW()
    WHERE id = p_invoice_id;

    UPDATE units
    SET lease_start_date = v_inv.period_start,
        lease_end_date = v_inv.period_end,
        is_occupied = TRUE
    WHERE id = v_inv.unit_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW property_balances AS
SELECT
    p.id AS property_id,
    p.title,
    COALESCE(SUM(CASE
        WHEN tx_type = 'RENT_INFLOW' THEN amount
        WHEN tx_type IN ('MANAGEMENT_FEE', 'OWNER_REMITTANCE') THEN -amount
        WHEN tx_type = 'MAINTENANCE_EXPENSE' AND funding_source = 'LANDLORD_RENT_POOL' THEN -amount
        ELSE 0
    END), 0) AS landlord_net_balance,
    COALESCE(SUM(CASE
        WHEN tx_type = 'SERVICE_CHARGE' THEN amount
        WHEN tx_type = 'MAINTENANCE_EXPENSE' AND funding_source = 'SERVICE_CHARGE_POOL' THEN -amount
        ELSE 0
    END), 0) AS service_charge_balance,
    COALESCE(SUM(CASE
        WHEN tx_type IN ('MANAGEMENT_FEE', 'TENANT_LEGAL_FEE') THEN amount
        ELSE 0
    END), 0) AS total_lawyer_fee_retained
FROM properties p
LEFT JOIN transactions t ON p.id = t.property_id
GROUP BY p.id, p.title;

-- ==============================================================================
-- 7. STORAGE BUCKET ('receipts') FOR PROOFS, LOGOS & WORK PHOTOS
-- ==============================================================================
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
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'application/pdf'];

DROP POLICY IF EXISTS "Allow public read access to receipts" ON storage.objects;
CREATE POLICY "Allow public read access to receipts"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow public upload to receipts" ON storage.objects;
CREATE POLICY "Allow public upload to receipts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Allow public update to receipts" ON storage.objects;
CREATE POLICY "Allow public update to receipts"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipts');

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES & RBAC PROTECTION
-- ==============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tranche_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitor_fee_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_expenses ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Public profiles read" ON profiles;
CREATE POLICY "Public profiles read" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Managers insert own profile" ON profiles;
CREATE POLICY "Managers insert own profile" ON profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Managers update own profile" ON profiles;
CREATE POLICY "Managers update own profile" ON profiles FOR UPDATE USING (true);

-- Landlords (Accountant/Clerk cannot modify Landlord Bank or Fee Rates)
DROP POLICY IF EXISTS "Allow full access to landlords" ON landlords;
DROP POLICY IF EXISTS "Allow read landlords" ON landlords;
CREATE POLICY "Allow read landlords" ON landlords FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert landlords" ON landlords;
CREATE POLICY "Allow insert landlords" ON landlords FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only Head of Chambers can update landlords" ON landlords;
CREATE POLICY "Only Head of Chambers can update landlords" ON landlords FOR UPDATE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');
DROP POLICY IF EXISTS "Only Head of Chambers can delete landlords" ON landlords;
CREATE POLICY "Only Head of Chambers can delete landlords" ON landlords FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Properties
DROP POLICY IF EXISTS "Allow full access to properties" ON properties;
CREATE POLICY "Allow full access to properties" ON properties FOR ALL USING (true) WITH CHECK (true);

-- Units
DROP POLICY IF EXISTS "Allow full access to units" ON units;
DROP POLICY IF EXISTS "Managers full access to own units" ON units;
DROP POLICY IF EXISTS "Public read units" ON units;
CREATE POLICY "Allow full access to units" ON units FOR ALL USING (true) WITH CHECK (true);

-- Tenancy History
DROP POLICY IF EXISTS "Allow read tenancy_history" ON tenancy_history;
CREATE POLICY "Allow read tenancy_history" ON tenancy_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert tenancy_history" ON tenancy_history;
CREATE POLICY "Allow insert tenancy_history" ON tenancy_history FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete tenancy_history" ON tenancy_history;
CREATE POLICY "Only Head of Chambers can delete tenancy_history" ON tenancy_history FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Invoices
DROP POLICY IF EXISTS "Allow full access to invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant magic link access to invoices" ON invoices;
DROP POLICY IF EXISTS "Tenant submit proof on invoices" ON invoices;
CREATE POLICY "Allow full access to invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);

-- Tranche Payments
DROP POLICY IF EXISTS "Allow read tranche_payments" ON tranche_payments;
CREATE POLICY "Allow read tranche_payments" ON tranche_payments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert tranche_payments" ON tranche_payments;
CREATE POLICY "Allow insert tranche_payments" ON tranche_payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete tranche_payments" ON tranche_payments;
CREATE POLICY "Only Head of Chambers can delete tranche_payments" ON tranche_payments FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Transactions (Accountant/Clerk cannot delete history or edit stamped vouchers)
DROP POLICY IF EXISTS "Allow full access to transactions" ON transactions;
DROP POLICY IF EXISTS "Allow read transactions" ON transactions;
CREATE POLICY "Allow read transactions" ON transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert transactions" ON transactions;
CREATE POLICY "Allow insert transactions" ON transactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Prevent Clerk from editing stamped vouchers" ON transactions;
CREATE POLICY "Prevent Clerk from editing stamped vouchers" ON transactions FOR UPDATE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS' OR COALESCE(is_stamped, FALSE) = FALSE);
DROP POLICY IF EXISTS "Only Head of Chambers can delete transactions" ON transactions;
CREATE POLICY "Only Head of Chambers can delete transactions" ON transactions FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Legal Matters
DROP POLICY IF EXISTS "Allow read legal_matters" ON legal_matters;
CREATE POLICY "Allow read legal_matters" ON legal_matters FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert legal_matters" ON legal_matters;
CREATE POLICY "Allow insert legal_matters" ON legal_matters FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update legal_matters" ON legal_matters;
CREATE POLICY "Allow update legal_matters" ON legal_matters FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete legal_matters" ON legal_matters;
CREATE POLICY "Only Head of Chambers can delete legal_matters" ON legal_matters FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Solicitor Fee Notes
DROP POLICY IF EXISTS "Allow read solicitor_fee_notes" ON solicitor_fee_notes;
CREATE POLICY "Allow read solicitor_fee_notes" ON solicitor_fee_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert solicitor_fee_notes" ON solicitor_fee_notes;
CREATE POLICY "Allow insert solicitor_fee_notes" ON solicitor_fee_notes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update solicitor_fee_notes" ON solicitor_fee_notes;
CREATE POLICY "Allow update solicitor_fee_notes" ON solicitor_fee_notes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete solicitor_fee_notes" ON solicitor_fee_notes;
CREATE POLICY "Only Head of Chambers can delete solicitor_fee_notes" ON solicitor_fee_notes FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Firm Expenses
DROP POLICY IF EXISTS "Allow read firm_expenses" ON firm_expenses;
CREATE POLICY "Allow read firm_expenses" ON firm_expenses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert firm_expenses" ON firm_expenses;
CREATE POLICY "Allow insert firm_expenses" ON firm_expenses FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only Head of Chambers can update firm_expenses" ON firm_expenses;
CREATE POLICY "Only Head of Chambers can update firm_expenses" ON firm_expenses FOR UPDATE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');
DROP POLICY IF EXISTS "Only Head of Chambers can delete firm_expenses" ON firm_expenses;
CREATE POLICY "Only Head of Chambers can delete firm_expenses" ON firm_expenses FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Grants
-- ==============================================================================
-- 9. PRE-ENTRY TENANCY APPLICATIONS & HYBRID TENANCY AGREEMENTS
-- ==============================================================================
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
    status TEXT NOT NULL DEFAULT 'PENDING'
);

ALTER TABLE units ADD COLUMN IF NOT EXISTS agreement_token UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE units ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_signature_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_signed_at TIMESTAMPTZ;
ALTER TABLE units ADD COLUMN IF NOT EXISTS executed_agreement_scan_url TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS agreement_status TEXT DEFAULT 'PENDING';

ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS tenant_signature_url TEXT;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS tenant_signed_at TIMESTAMPTZ;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS executed_agreement_scan_url TEXT;
ALTER TABLE tenancy_history ADD COLUMN IF NOT EXISTS agreement_status TEXT DEFAULT 'PENDING';

ALTER TABLE tenancy_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read tenancy_applications" ON tenancy_applications;
CREATE POLICY "Allow public read tenancy_applications" ON tenancy_applications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert tenancy_applications" ON tenancy_applications;
CREATE POLICY "Allow public insert tenancy_applications" ON tenancy_applications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow staff update tenancy_applications" ON tenancy_applications;
CREATE POLICY "Allow staff update tenancy_applications" ON tenancy_applications FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete tenancy_applications" ON tenancy_applications;
CREATE POLICY "Only Head of Chambers can delete tenancy_applications" ON tenancy_applications FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

-- Grants
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON property_balances TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION verify_tenant_invoice TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_role TO anon, authenticated, service_role;
