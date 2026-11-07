# EstateAdvocate — Legal Property & Rent Management PWA

A Progressive Web Application (PWA) tailored for **Nigerian Legal Property Managers and Estate Solicitors**. The system automates rent demands, proof-of-payment verification, strict 10% statutory legal fee deductions, artisan maintenance tracking, and 1-click landlord statement generation.

---

## 🏛️ Nigerian Legal & Accounting Domain Rules

1. **Gross Rent & Inflow Itemization:**
   - **`ST RENT` (Sitting Tenant Renewal)** or **`NEW RENT` (New Lease)**.
   - **`S/CHARGE` (Estate Service Charge)**: Typical default ₦100k, earmarked for estate running costs (Security, Borehole pump servicing, Waste levies).
   - **`CAUTION` (Refundable Escrow)**: Tenant security deposit held in trust.

2. **Strict Automatic 10% Legal Management Fee:**
   - On payment verification, the system calculates and deducts:
     $$\text{Management Fee} = \text{Rent} \times 0.10$$
   - **Service Charge and Caution fees are strictly exempt** from the 10% legal fee.

3. **Multi-Pool Fund Separation (No Co-mingling):**
   - **Landlord Net Pool:** $\text{Gross Rent} - \text{10\% Legal Fee} - \text{Landlord Repairs} - \text{Owner Remittances}$.
   - **Service Charge Reserve Pool:** $\text{Service Charges Collected} - \text{Shared Running Expenses}$.
   - **Lawyer's Retained Fee Ledger:** Accumulated 10% commissions.

---

## 🛠️ Tech Stack & Architecture

- **Frontend / Fullstack:** Next.js 15+ (App Router, Server Components, Client Actions)
- **Styling & UI:** Tailwind CSS, Lucide Icons, responsive legal theme (Nigerian Emerald Green `#064e3b` & Gold Accents `#d97706`).
- **PWA Tooling:** `manifest.json` (`display: standalone`), Service Worker offline caching (`sw.js`), and native mobile camera capture (`input type="file" accept="image/*" capture="environment"`).
- **Backend & Database:** Supabase (PostgreSQL with RLS, Storage Buckets, and PL/pgSQL RPC `verify_tenant_invoice`) + local reactive vault for offline capability.
- **PDF Generation:** `@react-pdf/renderer` for client/server PDF generation with printable legal letterhead.

---

## 🚀 Quick Start

### 1. Environment Configuration
The project is configured with live Supabase credentials in `.env.local` and `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://jzpgknlbroofetpwsicp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6cGdrbmxicm9vZmV0cHdzaWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NDYyOTAsImV4cCI6MjEwOTEyMjI5MH0.qpDiFItDQshyvmxnXTChBpjK4DsyOeB6ZOEs2hU7z1A
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your mobile or desktop browser.

### 3. Production Build
```bash
npm run build
npm start
```

---

## 📦 Database Migrations (Supabase)

The SQL migrations are located in `supabase/migrations/`:
1. [`20261101000000_init_legal_property_pwa.sql`](./supabase/migrations/20261101000000_init_legal_property_pwa.sql):
   - **Enums:** `invoice_status`, `transaction_type`, `funding_source`.
   - **Tables:** `landlords`, `properties`, `units`, `invoices`, `transactions`.
   - **RPC Function:** `verify_tenant_invoice(p_invoice_id, p_verified_by)`.
   - **Real-Time View:** `property_balances` (segregates Landlord Net, Service Charge, and Lawyer commissions).

2. [`20261101000001_enable_rls_policies_and_storage.sql`](./supabase/migrations/20261101000001_enable_rls_policies_and_storage.sql):
   - **Storage Bucket:** Creates the `receipts` storage bucket with 10MB limit and image/pdf MIME types.
   - **Storage Policies:** Public read and upload access for payment proofs and artisan invoices.
   - **Table RLS Policies:** Row Level Security policies on `landlords`, `properties`, `units`, `invoices`, and `transactions`.
   - **Permissions:** Grants `SELECT` on `property_balances` and `EXECUTE` on `verify_tenant_invoice`.

---

## 📱 PWA & Native Camera Capture

- **Standalone Mode:** Can be installed on iOS & Android home screens.
- **Native Camera Snap:** Tenants can snap bank transfer receipts or upload screenshots directly using their smartphone camera.
- **WhatsApp Integration:** Instant 1-click sharing of legal demand notices with tenant magic links.
