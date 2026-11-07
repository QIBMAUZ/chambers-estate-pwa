'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Share2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Building,
  User,
  Calendar,
  FileText,
  Loader2,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { CreateInvoiceModal } from '@/components/CreateInvoiceModal';
import { VerifyInvoiceModal } from '@/components/VerifyInvoiceModal';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate, generateWhatsAppDemandText, buildWhatsAppShareUrl } from '@/lib/utils';
import { Invoice, InvoiceStatus } from '@/types/database';

export default function InvoicesPage() {
  const [mounted, setMounted] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [profile, setProfile] = useState(EstateStore.getChamberProfile());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [verifyingInvoice, setVerifyingInvoice] = useState<Invoice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  const handleDownloadReceipt = async (inv: Invoice) => {
    setDownloadingReceiptId(inv.id);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { RentReceiptDocument } = await import('@/components/RentReceiptPDF');
      const currentProf = EstateStore.getChamberProfile();

      const blob = await pdf(<RentReceiptDocument invoice={inv} profile={currentProf} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Rent_Receipt_${inv.tenant_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading receipt PDF:', err);
      alert('Could not generate receipt PDF.');
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const refreshData = () => {
    setInvoices(EstateStore.getInvoices(selectedPropertyId || undefined));
    setProfile(EstateStore.getChamberProfile());
  };

  useEffect(() => {
    setMounted(true);
    refreshData();
    const unsub = subscribeToStore(() => refreshData());
    return () => unsub();
  }, [selectedPropertyId]);

  const filteredInvoices = invoices.filter((i) => {
    if (statusFilter === 'ALL') return true;
    return i.status === statusFilter;
  });

  const handleCopyLink = (token: string, id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/pay/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <PWAProvider>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12">
        <Navigation
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={setSelectedPropertyId}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                Rent Demand Notices &amp; Magic Links
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Automated legal demand notices, proof-of-payment verification, and statutory 10% legal fee collection.
              </p>
            </div>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-emerald-950 font-bold px-4 py-2.5 rounded-xl shadow-md transition text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Rent Demand</span>
            </button>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: 'All Invoices' },
              { key: 'AWAITING_VERIFICATION', label: 'Awaiting Verification' },
              { key: 'SENT', label: 'Sent / Pending' },
              { key: 'PAID', label: 'Paid & Verified' },
              { key: 'OVERDUE', label: 'Overdue' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                  statusFilter === f.key
                    ? 'bg-emerald-950 text-amber-300 border-emerald-800 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Invoices List */}
          <div className="space-y-4">
            {!mounted ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
                <div className="inline-block animate-spin w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full mb-2"></div>
                <p className="text-xs">Loading rent demands ledger...</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
                No invoices found for this filter.
              </div>
            ) : (
              filteredInvoices.map((inv) => {
                const totalPayable = Number(inv.total_amount_payable);
                const rentDue = Number(inv.rent_due);
                const sChargeDue = Number(inv.service_charge_due || 0);
                const cautionDue = Number(inv.caution_due || 0);
                const feeRate = typeof inv.management_fee_rate === 'number'
                  ? inv.management_fee_rate
                  : typeof inv.property?.landlord?.default_mgt_rate === 'number'
                  ? inv.property.landlord.default_mgt_rate
                  : 10.0;
                const legalFee = rentDue * (feeRate / 100);

                const origin = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                const magicLink = `${origin}/pay/${inv.access_token}`;

                return (
                  <div
                    key={inv.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-emerald-500 transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                            {inv.tenant_name}
                          </h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {inv.unit?.unit_name || 'Unit'}
                          </span>
                          {inv.status === 'PAID' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> PAID &amp; SPLIT
                            </span>
                          ) : inv.status === 'AWAITING_VERIFICATION' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 animate-pulse">
                              <Clock className="w-3.5 h-3.5" /> AWAITING VERIFICATION
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300">
                              SENT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                          <span>{inv.property?.title}</span>
                          <span>•</span>
                          <span>Due: {formatDate(inv.due_date)}</span>
                          <span>•</span>
                          <span>
                            Cycle: {formatDate(inv.period_start)} → {formatDate(inv.period_end)}
                          </span>
                        </p>
                      </div>

                      {/* Total and Legal Fee Tag */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 uppercase font-semibold block">
                            Total Demand
                          </span>
                          <span className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400">
                            {formatNaira(totalPayable)}
                          </span>
                        </div>
                        <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-4">
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 uppercase font-bold block">
                            {feeRate}% Legal Fee
                          </span>
                          <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                            {formatNaira(legalFee)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown & Proof Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-500 block">Gross Rent:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {formatNaira(rentDue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Estate S/Charge:</span>
                        <span className="font-bold text-sky-600 dark:text-sky-400">
                          {formatNaira(sChargeDue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Caution Deposit:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {formatNaira(cautionDue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Transfer Session Ref:</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {inv.bank_session_id || 'Pending submission'}
                        </span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        {/* Copy Link */}
                        <button
                          onClick={() => handleCopyLink(inv.access_token, inv.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          {copiedId === inv.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Link Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Copy Magic Link</span>
                            </>
                          )}
                        </button>

                        {/* Open Magic Link */}
                        <a
                          href={`/pay/${inv.access_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-emerald-600 text-xs font-semibold transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Preview Portal</span>
                        </a>

                        {/* WhatsApp Share */}
                        <a
                          href={buildWhatsAppShareUrl(
                            inv.unit?.tenant_phone,
                            generateWhatsAppDemandText({
                              tenantName: inv.tenant_name,
                              propertyTitle: inv.property?.title || 'Estate',
                              unitName: inv.unit?.unit_name || 'Unit',
                              rentDue,
                              serviceChargeDue: sChargeDue,
                              cautionDue,
                              totalDue: totalPayable,
                              dueDate: inv.due_date,
                              paymentLink: magicLink,
                              accountDetails: {
                                bankName: profile.bank_name || inv.property?.landlord?.bank_name || 'Zenith Bank PLC',
                                accountNumber: profile.account_number || inv.property?.landlord?.account_number || '1012345678',
                                accountName: profile.account_name || inv.property?.landlord?.account_name || profile.firm_name,
                              },
                              firmName: profile.firm_name,
                              solicitorName: profile.solicitor_name,
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 text-xs font-bold transition"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>WhatsApp Notice</span>
                        </a>

                        {/* Download Receipt if Paid */}
                        {inv.status === 'PAID' && (
                          <button
                            onClick={() => handleDownloadReceipt(inv)}
                            disabled={downloadingReceiptId === inv.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-bold transition"
                          >
                            {downloadingReceiptId === inv.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Generating...</span>
                              </>
                            ) : (
                              <>
                                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Official Receipt</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Verification button */}
                      {inv.status === 'AWAITING_VERIFICATION' && (
                        <button
                          onClick={() => setVerifyingInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition"
                        >
                          <ShieldCheck className="w-4 h-4 text-amber-300" />
                          <span>Verify Payment &amp; Split 10% Fee</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>

        <CreateInvoiceModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          defaultPropertyId={selectedPropertyId}
        />

        <VerifyInvoiceModal
          isOpen={Boolean(verifyingInvoice)}
          invoice={verifyingInvoice}
          onClose={() => setVerifyingInvoice(null)}
          onVerified={refreshData}
        />
      </div>
    </PWAProvider>
  );
}
