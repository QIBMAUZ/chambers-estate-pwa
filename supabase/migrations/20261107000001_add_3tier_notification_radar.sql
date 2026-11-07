-- 20261107000001_add_3tier_notification_radar.sql
-- Add 3-tier notification radar tracking fields to invoices

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notice_9m_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notice_9m_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notice_30d_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notice_30d_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_daily_reminder_sent_at TIMESTAMPTZ;
