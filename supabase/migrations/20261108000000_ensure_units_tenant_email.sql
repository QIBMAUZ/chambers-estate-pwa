-- 20261108000000_ensure_units_tenant_email.sql
-- Ensure units table has tenant_email column for automated Zoho SMTP reminders

ALTER TABLE units ADD COLUMN IF NOT EXISTS tenant_email TEXT;
