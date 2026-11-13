-- ==============================================================================
-- CHAMBERS & ESTATE MANAGEMENT PWA UPGRADE MIGRATION
-- Covers:
-- 1. Multi-User RBAC (HEAD_OF_CHAMBERS vs ACCOUNTANT_CLERK) & Audit Trails (created_by)
-- 2. Part-Payments & Installment Tranche Ledger (amount_paid, balance_due, promise_to_pay_date, RCT-...)
-- 3. Tenant Vacating & Soft-Archiving (tenancy_history)
-- 4. Seamless New Tenant KYC & Guarantor Onboarding
-- 5. First-Year 10% Tenant Legal Fee vs Renewal 10% Landlord Management Fee
-- 6. No-Receipt Artisan Vouchers (VCH-..., is_stamped, work_photo_url)
-- 7. Property Onboarding & Soft-Archiving (is_archived)
-- 8. Chambers / Solicitors Fee Note Module (legal_matters, solicitor_fee_notes)
-- 9. Firm Running Costs vs Client Case Disbursements (firm_expenses)
-- ==============================================================================

-- 1. EXTEND ENUMS & CREATE NEW DOMAIN ENUMS
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'DRAFT', 'SENT', 'PARTIALLY_PAID', 'AWAITING_VERIFICATION', 'PAID', 'OVERDUE'
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
        'RENT_INFLOW', 'SERVICE_CHARGE', 'CAUTION_DEPOSIT', 'MAINTENANCE_EXPENSE',
        'MANAGEMENT_FEE', 'TENANT_LEGAL_FEE', 'CAUTION_REFUND', 'OWNER_REMITTANCE'
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

-- 2. UPGRADE PROFILES FOR RBAC
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'HEAD_OF_CHAMBERS';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chambers_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 3. UPGRADE LANDLORDS & PROPERTIES (Audit Trails & Archiving)
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE landlords ADD COLUMN IF NOT EXISTS created_by_name TEXT;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS default_mgt_rate NUMERIC(5, 2) DEFAULT 10.00;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- 4. UPGRADE UNITS FOR TENANT KYC & GUARANTOR ONBOARDING
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

-- 5. CREATE TENANCY HISTORY TABLE (Vacating & Soft-Archiving)
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

-- 6. UPGRADE INVOICES FOR FIRST-YEAR vs RENEWAL & PART-PAYMENTS
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenancy_type TEXT DEFAULT 'RENEWAL';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS legal_fee_due NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS management_fee_rate NUMERIC(5, 2) DEFAULT 10.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC(12, 2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS promise_to_pay_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- Replace generated total_amount_payable so it includes legal_fee_due (Rent + Legal Fee + Service Charge + Caution)
DO $$ BEGIN
    ALTER TABLE invoices DROP COLUMN IF EXISTS total_amount_payable;
    ALTER TABLE invoices ADD COLUMN total_amount_payable NUMERIC(12, 2)
        GENERATED ALWAYS AS (COALESCE(rent_due, 0) + COALESCE(legal_fee_due, 0) + COALESCE(service_charge_due, 0) + COALESCE(caution_due, 0)) STORED;
EXCEPTION
    WHEN others THEN null;
END $$;

-- 7. CREATE TRANCHE PAYMENTS TABLE (Installments for Invoices & Solicitor Fee Notes)
CREATE TABLE IF NOT EXISTS tranche_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL UNIQUE, -- e.g. RCT-20261112-8492
    payment_scope TEXT NOT NULL DEFAULT 'ESTATE_INVOICE', -- 'ESTATE_INVOICE' | 'SOLICITOR_FEE_NOTE'
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    fee_note_id UUID, -- references solicitor_fee_notes(id)
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

-- 8. UPGRADE TRANSACTIONS FOR ARTISAN VOUCHERS & AUDIT TRAILS
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS voucher_number TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_stamped BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS work_photo_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS artisan_name TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS artisan_phone TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS created_by_name TEXT;

-- 9. CHAMBERS LEGAL MATTERS & SOLICITOR FEE NOTES (ISOLATED FROM LANDLORD ESCROW)
CREATE TABLE IF NOT EXISTS legal_matters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    matter_number TEXT NOT NULL, -- e.g. MAT-2026-001
    title TEXT NOT NULL,
    category matter_category NOT NULL DEFAULT 'GENERAL_SOLICITOR',
    client_name TEXT NOT NULL,
    client_phone TEXT,
    client_email TEXT,
    client_address TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
    opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS solicitor_fee_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    fee_note_number TEXT NOT NULL UNIQUE, -- e.g. FN-20261112-1042
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

-- 10. FIRM RUNNING COSTS vs CLIENT CASE DISBURSEMENTS
CREATE TABLE IF NOT EXISTS firm_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    voucher_number TEXT NOT NULL, -- e.g. FVCH-20261112-001
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

-- 11. HELPER FUNCTION FOR RBAC ROLE CHECK
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(v_role, 'HEAD_OF_CHAMBERS');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. ROW LEVEL SECURITY (RLS) ENFORCEMENT FOR RBAC
ALTER TABLE tenancy_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tranche_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitor_fee_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_expenses ENABLE ROW LEVEL SECURITY;

-- Public/Authenticated Select & Insert Policies
DROP POLICY IF EXISTS "Allow read tenancy_history" ON tenancy_history;
CREATE POLICY "Allow read tenancy_history" ON tenancy_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert tenancy_history" ON tenancy_history;
CREATE POLICY "Allow insert tenancy_history" ON tenancy_history FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete tenancy_history" ON tenancy_history;
CREATE POLICY "Only Head of Chambers can delete tenancy_history" ON tenancy_history FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

DROP POLICY IF EXISTS "Allow read tranche_payments" ON tranche_payments;
CREATE POLICY "Allow read tranche_payments" ON tranche_payments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert tranche_payments" ON tranche_payments;
CREATE POLICY "Allow insert tranche_payments" ON tranche_payments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete tranche_payments" ON tranche_payments;
CREATE POLICY "Only Head of Chambers can delete tranche_payments" ON tranche_payments FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

DROP POLICY IF EXISTS "Allow read legal_matters" ON legal_matters;
CREATE POLICY "Allow read legal_matters" ON legal_matters FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert legal_matters" ON legal_matters;
CREATE POLICY "Allow insert legal_matters" ON legal_matters FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update legal_matters" ON legal_matters;
CREATE POLICY "Allow update legal_matters" ON legal_matters FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete legal_matters" ON legal_matters;
CREATE POLICY "Only Head of Chambers can delete legal_matters" ON legal_matters FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

DROP POLICY IF EXISTS "Allow read solicitor_fee_notes" ON solicitor_fee_notes;
CREATE POLICY "Allow read solicitor_fee_notes" ON solicitor_fee_notes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert solicitor_fee_notes" ON solicitor_fee_notes;
CREATE POLICY "Allow insert solicitor_fee_notes" ON solicitor_fee_notes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update solicitor_fee_notes" ON solicitor_fee_notes;
CREATE POLICY "Allow update solicitor_fee_notes" ON solicitor_fee_notes FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Only Head of Chambers can delete solicitor_fee_notes" ON solicitor_fee_notes;
CREATE POLICY "Only Head of Chambers can delete solicitor_fee_notes" ON solicitor_fee_notes FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

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

-- Protect transactions deletion and stamped voucher edits from ACCOUNTANT_CLERK
DROP POLICY IF EXISTS "Only Head of Chambers can delete transactions" ON transactions;
CREATE POLICY "Only Head of Chambers can delete transactions" ON transactions FOR DELETE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');

DROP POLICY IF EXISTS "Prevent Clerk from editing stamped vouchers" ON transactions;
CREATE POLICY "Prevent Clerk from editing stamped vouchers" ON transactions FOR UPDATE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS' OR is_stamped = FALSE);

-- Protect Landlord bank & fee rate modifications from ACCOUNTANT_CLERK
DROP POLICY IF EXISTS "Only Head of Chambers can update landlords" ON landlords;
CREATE POLICY "Only Head of Chambers can update landlords" ON landlords FOR UPDATE
USING (public.get_current_user_role() = 'HEAD_OF_CHAMBERS');
