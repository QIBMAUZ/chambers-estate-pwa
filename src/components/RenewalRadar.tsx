'use client';

import React, { useState } from 'react';
import {
  Radio,
  AlertTriangle,
  Clock,
  Calendar,
  Send,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Invoice } from '@/types/database';
import { EstateStore } from '@/lib/store';
import {
  formatNaira,
  formatDate,
  buildWhatsAppShareUrl,
  generate9MonthRenewalNotice,
  generate30DayDemandNotice,
  generateDailyReminderNotice,
  NoticeGeneratorParams,
} from '@/lib/utils';

interface RenewalRadarProps {
  invoices: Invoice[];
  onRefresh?: () => void;
}

export function RenewalRadar({ invoices, onRefresh }: RenewalRadarProps) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'OVERDUE' | '30D' | '9M'>('ALL');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Helper to calculate days until due (negative if overdue)
  const getDaysUntilDue = (dateStr: string): number => {
    if (!dateStr) return 999;
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const target = new Date(y, m - 1, d);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffTime = target.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 999;
    }
  };

  // Only consider active unpaid or pending invoices
  const activeInvoices = invoices.filter(
    (inv) => inv.status !== 'PAID' && (inv.due_date || inv.period_end)
  );

  // Categorize invoices into 3 tiers
  const overdueItems = activeInvoices.filter((inv) => {
    const targetDate = inv.due_date || inv.period_end;
    const days = getDaysUntilDue(targetDate);
    return days < 0;
  });

  const demand30dItems = activeInvoices.filter((inv) => {
    const targetDate = inv.due_date || inv.period_end;
    const days = getDaysUntilDue(targetDate);
    return days >= 0 && days <= 30;
  });

  const advance9mItems = activeInvoices.filter((inv) => {
    const targetDate = inv.due_date || inv.period_end;
    const days = getDaysUntilDue(targetDate);
    return days > 30 && days <= 90;
  });

  const totalActionable = overdueItems.length + demand30dItems.length + advance9mItems.length;

  const handleSendNotice = async (invoice: Invoice, tier: '9M' | '30D' | 'DAILY') => {
    try {
      setSendingId(`${invoice.id}-${tier}`);

      const profile = EstateStore.getChamberProfile();
      const appBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== 'undefined' ? window.location.origin : '');
      const paymentLink = `${appBaseUrl}/pay/${invoice.access_token || invoice.id}`;

      const accountDetails = {
        bankName: profile?.bank_name || 'Zenith Bank',
        accountNumber: profile?.account_number || '',
        accountName: profile?.account_name || profile?.firm_name || 'Chambers Client Escrow',
      };

      const params: NoticeGeneratorParams = {
        tenantName: invoice.tenant_name,
        propertyTitle: invoice.property?.title || 'Managed Estate',
        unitName: invoice.unit?.unit_name || 'Tenancy Unit',
        rentDue: invoice.rent_due,
        serviceChargeDue: invoice.service_charge_due || 0,
        cautionDue: invoice.caution_due || 0,
        totalDue:
          invoice.total_amount_payable ||
          invoice.rent_due + (invoice.service_charge_due || 0) + (invoice.caution_due || 0),
        dueDate: invoice.due_date,
        periodEnd: invoice.period_end,
        paymentLink,
        accountDetails,
        firmName: profile?.firm_name,
        solicitorName: profile?.solicitor_name,
      };

      let encodedText = '';
      if (tier === '9M') {
        encodedText = generate9MonthRenewalNotice(params);
      } else if (tier === '30D') {
        encodedText = generate30DayDemandNotice(params);
      } else {
        encodedText = generateDailyReminderNotice(params);
      }

      const phone = invoice.unit?.tenant_phone;
      const shareUrl = buildWhatsAppShareUrl(phone, encodedText);

      // Open WhatsApp in new window
      if (typeof window !== 'undefined') {
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
      }

      // Mark notification as sent in Store & Supabase
      await EstateStore.markNotificationSent(invoice.id, tier);

      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Error dispatching renewal notice:', err);
    } finally {
      setSendingId(null);
    }
  };

  // Render notice item card
  const renderItemCard = (
    inv: Invoice,
    tier: '9M' | '30D' | 'DAILY',
    badgeColor: string,
    tierLabel: string,
    urgencyText: string
  ) => {
    const isSending = sendingId === `${inv.id}-${tier}`;
    const wasSent =
      tier === '9M'
        ? inv.notice_9m_sent
        : tier === '30D'
        ? inv.notice_30d_sent
        : Boolean(inv.last_daily_reminder_sent_at);

    const sentAt =
      tier === '9M'
        ? inv.notice_9m_sent_at
        : tier === '30D'
        ? inv.notice_30d_sent_at
        : inv.last_daily_reminder_sent_at;

    const totalDue =
      inv.total_amount_payable ||
      inv.rent_due + (inv.service_charge_due || 0) + (inv.caution_due || 0);

    return (
      <div
        key={`${inv.id}-${tier}`}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition hover:border-slate-300 dark:hover:border-slate-700"
      >
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
              {tierLabel}
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
              {inv.tenant_name}
            </span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {inv.unit?.unit_name || 'Unit'}
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-bold ml-auto sm:ml-0">
              {urgencyText}
            </span>
          </div>

          <p className="text-xs text-slate-500 truncate">
            {inv.property?.title || 'Property'} • Due: <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(inv.due_date)}</span> • Total: <span className="font-bold text-slate-900 dark:text-slate-100">{formatNaira(totalDue)}</span>
          </p>

          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            {inv.unit?.tenant_phone && (
              <span className="font-mono text-slate-600 dark:text-slate-400">
                📞 {inv.unit.tenant_phone}
              </span>
            )}
            {wasSent && (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Dispatched {formatDate(sentAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => handleSendNotice(inv, tier)}
            disabled={isSending}
            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs ${
              tier === 'DAILY'
                ? 'bg-rose-700 hover:bg-rose-800 text-white'
                : tier === '30D'
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-sky-600 hover:bg-sky-700 text-white'
            } disabled:opacity-50`}
          >
            {isSending ? (
              <Clock className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>
              {tier === 'DAILY'
                ? wasSent
                  ? 'Re-Send Daily Overdue Chaser'
                  : 'Send Daily Overdue Chaser'
                : tier === '30D'
                ? wasSent
                  ? 'Re-Send 30-Day Demand'
                  : 'Send 30-Day Demand'
                : wasSent
                ? 'Re-Send 9-Month Notice'
                : 'Send 9-Month Notice'}
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl overflow-hidden p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Renewal Radar &amp; Statutory Demands
              </h2>
              {totalActionable > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {totalActionable} Actionable
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Automated 3-tier notice engine: early 9-month advance advisory, 30-day statutory demand, and daily overdue chaser.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Filter Tabs */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-xl text-xs border border-slate-700/60">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                activeTab === 'ALL'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              All ({totalActionable})
            </button>
            <button
              onClick={() => setActiveTab('OVERDUE')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                activeTab === 'OVERDUE'
                  ? 'bg-rose-600 text-white font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Overdue ({overdueItems.length})
            </button>
            <button
              onClick={() => setActiveTab('30D')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                activeTab === '30D'
                  ? 'bg-amber-600 text-white font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              30-Day ({demand30dItems.length})
            </button>
            <button
              onClick={() => setActiveTab('9M')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                activeTab === '9M'
                  ? 'bg-sky-600 text-white font-black shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              9-Month ({advance9mItems.length})
            </button>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title={isCollapsed ? 'Expand Radar' : 'Collapse Radar'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {totalActionable === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-200">
                All Tenancies are Up to Date
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No active leases fall within the overdue, 30-day statutory demand, or 9-month advance expiration windows.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overdue Section */}
              {(activeTab === 'ALL' || activeTab === 'OVERDUE') && overdueItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    Tier 3: Overdue Rent Demands ({overdueItems.length})
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {overdueItems.map((inv) => {
                      const days = Math.abs(getDaysUntilDue(inv.due_date || inv.period_end));
                      return renderItemCard(
                        inv,
                        'DAILY',
                        'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700',
                        '🚨 Overdue Demand',
                        `${days} days overdue`
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 30-Day Critical Demand Section */}
              {(activeTab === 'ALL' || activeTab === '30D') && demand30dItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Tier 2: Statutory 30-Day Pre-Expiry Window ({demand30dItems.length})
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {demand30dItems.map((inv) => {
                      const days = getDaysUntilDue(inv.due_date || inv.period_end);
                      return renderItemCard(
                        inv,
                        '30D',
                        'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
                        '⚠️ 30-Day Demand',
                        days === 0 ? 'Due Today' : `${days} days left`
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 9-Month Advance Window Section */}
              {(activeTab === 'ALL' || activeTab === '9M') && advance9mItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                    <Calendar className="w-4 h-4 text-sky-500" />
                    Tier 1: 9-Month Early Expiration Advisory ({advance9mItems.length})
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {advance9mItems.map((inv) => {
                      const days = getDaysUntilDue(inv.due_date || inv.period_end);
                      return renderItemCard(
                        inv,
                        '9M',
                        'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-700',
                        '📅 9-Month Notice',
                        `Due in ${days} days`
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
