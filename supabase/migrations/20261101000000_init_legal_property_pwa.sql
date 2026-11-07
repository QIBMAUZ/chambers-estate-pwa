-- ==============================================================================
-- NIGERIAN LEGAL PROPERTY & RENT MANAGEMENT PWA
-- Database Migration: Enums, Tables, Ledger, RPC & Balances View
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'DRAFT', 
        'SENT', 
        'AWAITING_VERIFICATION', 
        'PAID', 
        'OVERDUE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM (
        'RENT_INFLOW', 
        'SERVICE_CHARGE', 
        'CAUTION_DEPOSIT', 
        'MAINTENANCE_EXPENSE', 
        'MANAGEMENT_FEE', 
        'OWNER_REMITTANCE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
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

-- 2. LANDLORDS
CREATE TABLE IF NOT EXISTS landlords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    default_mgt_rate NUMERIC(5, 2) DEFAULT 10.00
);

-- 3. PROPERTIES
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    landlord_id UUID REFERENCES landlords(id) ON DELETE CASCADE,
    title TEXT NOT NULL, -- e.g., "Mr. Fred DV Estate"
    address TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'Lagos'
);

-- 4. UNITS / TENANCIES
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_name TEXT NOT NULL, -- e.g., "Flat 1", "Flat 3"
    current_tenant_name TEXT,
    tenant_phone TEXT,
    tenant_email TEXT,
    annual_rent NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    annual_service_charge NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    caution_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    lease_start_date DATE,
    lease_end_date DATE,
    is_occupied BOOLEAN DEFAULT TRUE
);

-- 5. INVOICES (Demands for Rent)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token UUID DEFAULT gen_random_uuid() UNIQUE, -- Token for magic payment link
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    tenant_name TEXT NOT NULL,
    rent_due NUMERIC(12, 2) NOT NULL,
    service_charge_due NUMERIC(12, 2) DEFAULT 0.00,
    caution_due NUMERIC(12, 2) DEFAULT 0.00,
    total_amount_payable NUMERIC(12, 2) GENERATED ALWAYS AS (rent_due + service_charge_due + caution_due) STORED,
    due_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status invoice_status DEFAULT 'SENT',
    proof_image_url TEXT,
    bank_session_id TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TRANSACTIONS LEDGER
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
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
    recorded_by UUID REFERENCES auth.users(id)
);

-- 7. AUTOMATED PAYMENT VERIFICATION RPC
CREATE OR REPLACE FUNCTION verify_tenant_invoice(
    p_invoice_id UUID,
    p_verified_by UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE 
    v_inv RECORD; 
    v_mgt_fee NUMERIC; 
BEGIN 
    SELECT * INTO v_inv FROM invoices WHERE id = p_invoice_id; 
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invoice not found with ID %', p_invoice_id;
    END IF;

    IF v_inv.status = 'PAID' THEN 
        RAISE EXCEPTION 'Invoice has already been marked as PAID.'; 
    END IF;      
    
    -- Strict 10% legal/management fee calculation on rent only
    v_mgt_fee := v_inv.rent_due * 0.10;      
    
    -- 1. Inflow: Gross Rent into Landlord Rent Pool
    INSERT INTO transactions (
        property_id, unit_id, invoice_id, tx_date, tx_type, amount, description, reference_note, recorded_by
    ) VALUES (
        v_inv.property_id, 
        v_inv.unit_id, 
        v_inv.id, 
        CURRENT_DATE, 
        'RENT_INFLOW', 
        v_inv.rent_due, 
        'Rent Payment: ' || v_inv.tenant_name, 
        COALESCE(v_inv.bank_session_id, 'Direct Verification'), 
        p_verified_by
    );      
    
    -- 2. Outflow: Lawyer 10% Retained Management Fee
    INSERT INTO transactions (
        property_id, unit_id, invoice_id, tx_date, tx_type, amount, description, reference_note, recorded_by
    ) VALUES (
        v_inv.property_id, 
        v_inv.unit_id, 
        v_inv.id, 
        CURRENT_DATE, 
        'MANAGEMENT_FEE', 
        v_mgt_fee, 
        '10% Legal Fee: ' || v_inv.tenant_name, 
        'Auto-calculated on verification (Strict 10% statutory)', 
        p_verified_by
    );      
    
    -- 3. Inflow: Service Charge (earmarked for estate running costs, exempt from 10% legal fee)
    IF v_inv.service_charge_due > 0 THEN 
        INSERT INTO transactions (
            property_id, unit_id, invoice_id, tx_date, tx_type, funding_source, amount, description, reference_note, recorded_by
        ) VALUES (
            v_inv.property_id, 
            v_inv.unit_id, 
            v_inv.id, 
            CURRENT_DATE, 
            'SERVICE_CHARGE', 
            'SERVICE_CHARGE_POOL', 
            v_inv.service_charge_due, 
            'Service Charge: ' || v_inv.tenant_name, 
            'Earmarked for Estate Ops (Exempt from 10% Legal Fee)', 
            p_verified_by
        ); 
    END IF;      
    
    -- 4. Inflow: Caution Deposit (held in escrow, exempt from 10% legal fee)
    IF v_inv.caution_due > 0 THEN 
        INSERT INTO transactions (
            property_id, unit_id, invoice_id, tx_date, tx_type, funding_source, amount, description, reference_note, recorded_by
        ) VALUES (
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
        verified_at = NOW() 
    WHERE id = p_invoice_id; 
    
    UPDATE units 
    SET lease_start_date = v_inv.period_start, 
        lease_end_date = v_inv.period_end,
        is_occupied = TRUE
    WHERE id = v_inv.unit_id; 
END; 
$$ LANGUAGE plpgsql;

-- 8. REAL-TIME BALANCES VIEW (Segregated Fund Pools)
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
    COALESCE(SUM(CASE WHEN tx_type = 'MANAGEMENT_FEE' THEN amount ELSE 0 END), 0) AS total_lawyer_fee_retained
FROM properties p
LEFT JOIN transactions t ON p.id = t.property_id
GROUP BY p.id, p.title;

-- 9. SEED DATA FOR LAGOS NIGERIAN LEGAL PROPERTIES
INSERT INTO landlords (id, name, email, phone, bank_name, account_number, account_name, default_mgt_rate)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Chief Fredrick Adeleke', 'f.adeleke@lagosproperties.ng', '+234 803 123 4567', 'Zenith Bank PLC', '1012345678', 'Adeleke Property Ventures', 10.00),
    ('22222222-2222-2222-2222-222222222222', 'Barrister (Mrs.) Folashade Bakare', 'folashade@bakarelaw.com', '+234 802 987 6543', 'Guaranty Trust Bank (GTBank)', '0123456789', 'Folashade Bakare Trust', 10.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO properties (id, landlord_id, title, address, state)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Fred DV Estate, Lekki Phase 1', 'Plot 14, Admiralty Way, Lekki Phase 1', 'Lagos'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Victoria Crest Court, Ikeja GRA', '18 Isaac John Street, Ikeja GRA', 'Lagos')
ON CONFLICT (id) DO NOTHING;

INSERT INTO units (id, property_id, unit_name, current_tenant_name, tenant_phone, tenant_email, annual_rent, annual_service_charge, caution_fee, lease_start_date, lease_end_date, is_occupied)
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Flat 1 (3-Bedroom Luxury)', 'Dr. Babatunde Sanusi', '+234 805 222 3344', 'babatunde.sanusi@healthcorp.ng', 4500000.00, 350000.00, 250000.00, '2025-11-01', '2026-10-31', TRUE),
    ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Flat 2 (2-Bedroom Apartment)', 'Engr. Emeka Okonkwo', '+234 814 555 7890', 'emeka.okonkwo@buildtech.ng', 3200000.00, 250000.00, 200000.00, '2025-12-01', '2026-11-30', TRUE),
    ('c3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Penthouse (4-Bedroom)', 'Madam Ngozi Alabi', '+234 809 111 2233', 'ngozi.alabi@tradinggroup.com', 7000000.00, 500000.00, 400000.00, '2025-10-01', '2026-09-30', TRUE),
    ('c4444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Wing A (Duplex)', 'Captain Tunde Balogun', '+234 802 333 9988', 'tunde.balogun@aviation.ng', 6000000.00, 400000.00, 300000.00, '2025-08-01', '2026-07-31', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (id, access_token, property_id, unit_id, tenant_name, rent_due, service_charge_due, caution_due, due_date, period_start, period_end, status, proof_image_url, bank_session_id)
VALUES 
    (
        'd1111111-1111-1111-1111-111111111111', 
        '10000000-0000-0000-0000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
        'c1111111-1111-1111-1111-111111111111', 
        'Dr. Babatunde Sanusi', 
        4500000.00, 
        350000.00, 
        0.00, 
        '2026-11-15', 
        '2026-11-01', 
        '2027-10-31', 
        'AWAITING_VERIFICATION',
        'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60',
        'ZENITH-NIP-20261101-98765432'
    ),
    (
        'd2222222-2222-2222-2222-222222222222', 
        '20000000-0000-0000-0000-000000000002',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
        'c2222222-2222-2222-2222-222222222222', 
        'Engr. Emeka Okonkwo', 
        3200000.00, 
        250000.00, 
        0.00, 
        '2026-11-30', 
        '2026-12-01', 
        '2027-11-30', 
        'SENT',
        NULL,
        NULL
    )
ON CONFLICT (id) DO NOTHING;

-- Seed initial transactions
INSERT INTO transactions (id, property_id, unit_id, invoice_id, tx_date, tx_type, funding_source, amount, description, reference_note)
VALUES 
    ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', NULL, '2026-10-02', 'RENT_INFLOW', 'LANDLORD_RENT_POOL', 7000000.00, 'Rent Payment: Madam Ngozi Alabi (Penthouse)', 'Direct Bank Transfer Ref: GTB-8839201'),
    ('e2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', NULL, '2026-10-02', 'MANAGEMENT_FEE', NULL, 700000.00, '10% Legal Fee: Madam Ngozi Alabi', 'Auto-calculated on verification'),
    ('e3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', NULL, '2026-10-02', 'SERVICE_CHARGE', 'SERVICE_CHARGE_POOL', 500000.00, 'Service Charge: Madam Ngozi Alabi', 'Estate Running Costs 2026/2027'),
    ('e4444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, NULL, '2026-10-15', 'MAINTENANCE_EXPENSE', 'SERVICE_CHARGE_POOL', 180000.00, 'Estate Borehole Pump Overhaul & Descaling', 'Artisan: Engr. Musa Plumbing & Water Services'),
    ('e5555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', NULL, '2026-10-18', 'MAINTENANCE_EXPENSE', 'LANDLORD_RENT_POOL', 85000.00, 'Penthouse Master Bath Shower Mixer Replacement', 'Paid from Landlord Net Balance'),
    ('e6666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, NULL, '2026-10-25', 'OWNER_REMITTANCE', 'LANDLORD_RENT_POOL', 5000000.00, 'Remittance to Chief Fredrick Adeleke (Zenith 1012345678)', 'Partial Rent Remittance for Penthouse Inflow')
ON CONFLICT (id) DO NOTHING;
