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
  FileText,
  Loader2,
  Coins,
  UserCheck,
  CalendarClock,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { CreateInvoiceModal } from '@/components/CreateInvoiceModal';
import { VerifyInvoiceModal } from '@/components/VerifyInvoiceModal';
import { RecordTrancheModal } from '@/components/RecordTrancheModal';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate, generateWhatsAppDemandText, buildWhatsAppShareUrl } from '@/lib/utils';
import { Invoice, TranchePayment } from '@/types/database';

export default function InvoicesPage() {
  const [mounted, setMounted] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [profile, setProfile] = useState(EstateStore.getChamberProfile());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [verifyingInvoice, setVerifyingInvoice] = useState<Invoice | null>(null);
  const [trancheInvoice, setTrancheInvoice] = useState<Invoice | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  const handleDownloadReceipt = async (inv: Invoice, tranche?: TranchePayment) => {
    const key = tranche ? tranche.id : inv.id;
    setDownloadingReceiptId(key);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { RentReceiptDocument } = await import('@/components/RentReceiptPDF');
      const currentProf = EstateStore.getChamberProfile();

      const blob = await pdf(
        <RentReceiptDocument invoice={inv} profile={currentProf} tranche={tranche} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const serial = tranche?.receipt_number || inv.id.slice(0, 8).toUpperCase();
      link.download = `Rent_Receipt_${serial}_${inv.tenant_name.replace(/\s+/g, '_')}.pdf`;
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
                Rent Demand Notices &amp; Installment Ledger
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                First-Year (+10% Tenant Legal Fee) vs. Renewal (10% Landlord Management Fee) demands, tranche receipts (RCT-...), and magic links.
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
              { key: 'PARTIALLY_PAID', label: 'Partially Paid (Tranches)' },
              { key: 'AWAITING_VERIFICATION', label: 'Awaiting Verification' },
              { key: 'SENT', label: 'Sent / Pending' },
              { key: 'PAID', label: 'Paid & Settled' },
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
                const isFirstYear = inv.tenancy_type === 'FIRST_YEAR';
                const totalPayable = Number(inv.total_amount_payable);
                const rentDue = Number(inv.rent_due);
                const sChargeDue = Number(inv.service_charge_due || 0);
                const cautionDue = Number(inv.caution_due || 0);
                const legalFeeDue = Number(inv.legal_fee_due || 0);
                const amountPaid = Number(inv.amount_paid || 0);
                const balanceDue =
                  typeof inv.balance_due === 'number'
                    ? inv.balance_due
                    : Math.max(0, totalPayable - amountPaid);

                const feeRate = isFirstYear
                  ? 0
                  : typeof inv.management_fee_rate === 'number'
                  ? inv.management_fee_rate
                  : typeof inv.property?.landlord?.default_mgt_rate === 'number'
                  ? inv.property.landlord.default_mgt_rate
                  : 10.0;
                const renewalMgtFee = isFirstYear ? 0 : rentDue * (feeRate / 100);
                const tranches = EstateStore.getTranchePayments(inv.id);

                const origin =
                  process.env.NEXT_PUBLIC_APP_URL ||
                  (typeof window !== 'undefined' ? window.location.origin : '');
                const magicLink = `${origin}/pay/${inv.access_token}`;

                return (
                  <div
                    key={inv.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-emerald-500 transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                            {inv.tenant_name}
                          </h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {inv.unit?.unit_name || 'Unit'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              isFirstYear
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            }`}
                          >
                            {isFirstYear ? 'FIRST-YEAR INTAKE' : 'RENEWAL TENANCY'}
                          </span>
                          {inv.status === 'PAID' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5" /> PAID &amp; SETTLED
                            </span>
                          ) : inv.status === 'PARTIALLY_PAID' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
                              <Coins className="w-3.5 h-3.5" /> PARTIALLY PAID
                            </span>
                          ) : inv.status === 'AWAITING_VERIFICATION' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 animate-pulse">
                              <Clock className="w-3.5 h-3.5" /> AWAITING VERIFICATION
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300">
                              {inv.status}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                          <span>{inv.property?.title}</span>
                          <span>•</span>
                          <span>Due: {formatDate(inv.due_date)}</span>
                          <span>•</span>
                          <span>
                            Cycle: {formatDate(inv.period_start)} → {formatDate(inv.period_end)}
                          </span>
                          {inv.created_by_name && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                                <UserCheck className="w-3 h-3 text-emerald-600" />
                                Issued by: {inv.created_by_name}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Total, Paid, Balance & Legal Fee Tag */}
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                            Total Demand
                          </span>
                          <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                            {formatNaira(totalPayable)}
                          </span>
                        </div>
                        <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-3">
                          <span className="text-[10px] text-emerald-600 uppercase font-bold block">
                            Paid to Date
                          </span>
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatNaira(amountPaid)}
                          </span>
                        </div>
                        <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-3">
                          <span className="text-[10px] text-amber-600 uppercase font-bold block">
                            Balance Due
                          </span>
                          <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                            {formatNaira(balanceDue)}
                          </span>
                        </div>
                        <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-3">
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold block">
                            {isFirstYear ? '10% Tenant Legal Fee' : `${feeRate}% Renewal Mgt Fee`}
                          </span>
                          <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                            {formatNaira(isFirstYear ? legalFeeDue : renewalMgtFee)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown & Proof Status */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-500 block">Gross Rent:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {formatNaira(rentDue)}
                        </span>
                      </div>
                      {isFirstYear && (
                        <div>
                          <span className="text-amber-600 dark:text-amber-400 block">10% Legal Fee:</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            +{formatNaira(legalFeeDue)}
                          </span>
                        </div>
                      )}
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
                        <span className="text-slate-500 block">
                          {inv.promise_to_pay_date && balanceDue > 0
                            ? 'Promise-to-Pay Date:'
                            : 'Transfer Session Ref:'}
                        </span>
                        {inv.promise_to_pay_date && balanceDue > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                            <CalendarClock className="w-3.5 h-3.5" />
                            {formatDate(inv.promise_to_pay_date)}
                          </span>
                        ) : (
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {inv.bank_session_id || 'Pending submission'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tranche Receipts History */}
                    {tranches.length > 0 && (
                      <div className="bg-emerald-950/5 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                          Issued Tranche Receipts ({tranches.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {tranches.map((tr) => (
                            <div
                              key={tr.id}
                              className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs"
                            >
                              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                {tr.receipt_number}
                              </span>
                              <span className="font-extrabold text-slate-800 dark:text-slate-100">
                                {formatNaira(tr.amount)}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDate(tr.payment_date)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDownloadReceipt(inv, tr)}
                                disabled={downloadingReceiptId === tr.id}
                                className="text-[11px] font-bold text-emerald-600 hover:text-emerald-500 underline ml-1"
                              >
                                {downloadingReceiptId === tr.id ? '...' : 'PDF'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
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
                              totalDue: balanceDue > 0 ? balanceDue : totalPayable,
                              dueDate: inv.due_date,
                              paymentLink: magicLink,
                              accountDetails: {
                                bankName:
                                  profile.bank_name ||
                                  inv.property?.landlord?.bank_name ||
                                  'Zenith Bank PLC',
                                accountNumber:
                                  profile.account_number ||
                                  inv.property?.landlord?.account_number ||
                                  '1012345678',
                                accountName:
                                  profile.account_name ||
                                  inv.property?.landlord?.account_name ||
                                  profile.firm_name,
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

                        {/* Download Receipt if Paid or Partially Paid */}
                        {(inv.status === 'PAID' || inv.status === 'PARTIALLY_PAID') && (
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

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Record Tranche / Part-Payment button */}
                        {inv.status !== 'PAID' && balanceDue > 0 && (
                          <button
                            onClick={() => setTrancheInvoice(inv)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold text-xs shadow-sm transition"
                          >
                            <Coins className="w-4 h-4" />
                            <span>+ Record Tranche / Part-Payment</span>
                          </button>
                        )}

                        {/* Verification button */}
                        {inv.status === 'AWAITING_VERIFICATION' && (
                          <button
                            onClick={() => setVerifyingInvoice(inv)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition"
                          >
                            <ShieldCheck className="w-4 h-4 text-amber-300" />
                            <span>Verify Full Balance</span>
                          </button>
                        )}
                      </div>
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

        <RecordTrancheModal
          isOpen={Boolean(trancheInvoice)}
          invoice={trancheInvoice}
          onClose={() => setTrancheInvoice(null)}
          onSuccess={refreshData}
        />
      </div>
    </PWAProvider>
  );
}
