'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Receipt,
  Wrench,
  SendHorizontal,
  FileText,
  Scale,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Eye,
  Camera,
  Share2,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { CreateInvoiceModal } from '@/components/CreateInvoiceModal';
import { VerifyInvoiceModal } from '@/components/VerifyInvoiceModal';
import { LogExpenseModal } from '@/components/LogExpenseModal';
import { RecordRemittanceModal } from '@/components/RecordRemittanceModal';
import { RenewalRadar } from '@/components/RenewalRadar';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate, generateWhatsAppDemandText } from '@/lib/utils';
import { Invoice, Transaction, PropertyBalances } from '@/types/database';

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<PropertyBalances[]>([]);

  // Modals state
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isLogExpenseOpen, setIsLogExpenseOpen] = useState(false);
  const [isRecordRemittanceOpen, setIsRecordRemittanceOpen] = useState(false);
  const [verifyInvoice, setVerifyInvoice] = useState<Invoice | null>(null);

  // Ledger Filter
  const [txFilter, setTxFilter] = useState<string>('ALL');

  // Load state and subscribe
  const refreshData = () => {
    setInvoices(EstateStore.getInvoices(selectedPropertyId || undefined));
    setTransactions(EstateStore.getTransactions(selectedPropertyId || undefined));
    setBalances(EstateStore.getPropertyBalances(selectedPropertyId || undefined));
  };

  useEffect(() => {
    setMounted(true);
    refreshData();
    const unsubscribe = subscribeToStore(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [selectedPropertyId]);

  // Aggregate stats across filtered properties
  const totalLandlordNet = balances.reduce((sum, b) => sum + b.landlord_net_balance, 0);
  const totalServiceCharge = balances.reduce((sum, b) => sum + b.service_charge_balance, 0);
  const totalLawyerFees = balances.reduce((sum, b) => sum + b.total_lawyer_fee_retained, 0);
  const firmProfit = EstateStore.getFirmProfitSummary();

  const pendingVerificationInvoices = invoices.filter(
    (i) => i.status === 'AWAITING_VERIFICATION'
  );

  const filteredTransactions = transactions.filter((t) => {
    if (txFilter === 'ALL') return true;
    if (txFilter === 'RENT_INFLOW') return t.tx_type === 'RENT_INFLOW';
    if (txFilter === 'MANAGEMENT_FEE')
      return t.tx_type === 'MANAGEMENT_FEE' || t.tx_type === 'TENANT_LEGAL_FEE';
    if (txFilter === 'SERVICE_CHARGE') return t.tx_type === 'SERVICE_CHARGE';
    if (txFilter === 'MAINTENANCE_EXPENSE') return t.tx_type === 'MAINTENANCE_EXPENSE';
    if (txFilter === 'OWNER_REMITTANCE') return t.tx_type === 'OWNER_REMITTANCE';
    return true;
  });

  return (
    <PWAProvider>
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12">
        <Navigation
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={setSelectedPropertyId}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Executive Hero Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-2xl p-6 sm:p-8 shadow-lg border border-slate-800/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Commercial &amp; Residential Portfolio
                </span>
                <span className="text-xs text-slate-400">Automated Multi-Pool Trust Accounting</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Property &amp; Tenancy Financial Overview
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Automated management commission calculation on rent collections, strict multi-pool fund separation (Landlord Net, Service Charge &amp; Caution Escrow), and instant 1-click financial statements.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
              <button
                onClick={() => setIsCreateInvoiceOpen(true)}
                className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs sm:text-sm"
              >
                <Receipt className="w-4 h-4" />
                <span>+ Rent Demand</span>
              </button>
              <button
                onClick={() => setIsLogExpenseOpen(true)}
                className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium px-4 py-2.5 rounded-xl border border-slate-700 shadow-2xs transition-all text-xs sm:text-sm"
              >
                <Wrench className="w-4 h-4 text-slate-300" />
                <span>+ Artisan Expense</span>
              </button>
              <button
                onClick={() => setIsRecordRemittanceOpen(true)}
                className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium px-4 py-2.5 rounded-xl border border-slate-700 shadow-2xs transition-all text-xs sm:text-sm"
              >
                <SendHorizontal className="w-4 h-4 text-slate-300" />
                <span>+ Remittance</span>
              </button>
              <Link
                href="/statement"
                className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-1.5 bg-white text-slate-900 hover:bg-slate-100 font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs sm:text-sm"
              >
                <FileText className="w-4 h-4 text-emerald-800" />
                <span>1-Click Statement</span>
              </Link>
            </div>
          </div>

          {/* Key Financial Metrics (Segregated Pools) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Metric 1: Landlord Net Pool */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Landlord Net Pool
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatNaira(totalLandlordNet)}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Gross Rent less Management Fee &amp; Landlord Repairs
              </p>
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">Available for Remittance</span>
                <button
                  onClick={() => setIsRecordRemittanceOpen(true)}
                  className="text-slate-700 dark:text-slate-300 hover:text-emerald-700 font-semibold flex items-center gap-0.5 transition-colors"
                >
                  Disburse &rarr;
                </button>
              </div>
            </div>

            {/* Metric 2: Service Charge Reserve Pool */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Service Charge Reserve
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5 text-2xl font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                {formatNaira(totalServiceCharge)}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Earmarked for Estate Operations (Security, Borehole, Levies)
              </p>
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-sky-600 font-medium">Exempt from Mgt Fee</span>
                <button
                  onClick={() => setIsLogExpenseOpen(true)}
                  className="text-sky-600 hover:underline font-semibold"
                >
                  Log Expense &rarr;
                </button>
              </div>
            </div>

            {/* Metric 3: Chambers Net Profit & Retained Legal Fees */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Real-Time Firm Net Profit
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800 flex items-center justify-center">
                  <Scale className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5 text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {mounted ? formatNaira(firmProfit.netFirmProfit) : formatNaira(totalLawyerFees)}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                1st-Yr Legal + Renewal Mgt + Fee Notes less Disbursements
              </p>
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                <span>Estate Fees: {formatNaira(totalLawyerFees)}</span>
                <Link
                  href="/chambers"
                  className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Chambers Ledger &rarr;
                </Link>
              </div>
            </div>

            {/* Metric 4: Verification Queue */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Verification Queue
                </span>
                <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-800 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5 text-2xl font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                {pendingVerificationInvoices.length} Pending
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Bank receipts submitted awaiting Manager approval
              </p>
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Total Demands: {invoices.length}</span>
                {pendingVerificationInvoices.length > 0 && (
                  <span className="text-amber-600 font-bold animate-pulse">Action Required</span>
                )}
              </div>
            </div>
          </div>

          {/* Urgent Verification Queue (If any proofs pending) */}
          {pendingVerificationInvoices.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600 animate-spin" />
                  <h3 className="font-bold text-sm sm:text-base text-amber-950 dark:text-amber-200">
                    Urgent: Proof of Payment Awaiting Verification ({pendingVerificationInvoices.length})
                  </h3>
                </div>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium hidden sm:inline">
                  Click to inspect proof &amp; trigger 10% legal split
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingVerificationInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {inv.tenant_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
                          {inv.unit?.unit_name || 'Flat'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {inv.property?.title} • Rent: {formatNaira(inv.rent_due)} + S/Charge: {formatNaira(inv.service_charge_due)}
                      </p>
                      {inv.bank_session_id && (
                        <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                          Session Ref: {inv.bank_session_id}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => setVerifyInvoice(inv)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow transition"
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-300" />
                        <span>Inspect &amp; Verify</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Renewal Radar & 3-Tier Statutory Demands Engine */}
          <RenewalRadar invoices={invoices} onRefresh={refreshData} />

          {/* Properties Segregated Balances Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Estate Multi-Pool Balances (Real-time View)
                </h3>
                <p className="text-xs text-slate-500">
                  Separate bank ledgers preventing co-mingling of Landlord rent, Service charge reserves, and Lawyer commission.
                </p>
              </div>
              <Link
                href="/properties"
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                Manage Units &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {balances.length === 0 ? (
                <div className="col-span-full py-8 px-4 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="font-semibold text-sm">No Managed Properties Registered</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Add a landlord and register properties under &quot;Properties &amp; Units&quot; to begin tracking segregated funds.
                  </p>
                  <Link
                    href="/properties"
                    className="inline-block mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
                  >
                    + Register First Property
                  </Link>
                </div>
              ) : (
                balances.map((b) => (
                <div
                  key={b.property_id}
                  className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      {b.title}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">Lagos</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">• Landlord Net Rent Balance:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {formatNaira(b.landlord_net_balance)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">• Service Charge Reserve:</span>
                      <span className="font-bold text-sky-600 dark:text-sky-400">
                        {formatNaira(b.service_charge_balance)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600 dark:text-slate-400">• Lawyer Retained Legal Fees:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">
                        {formatNaira(b.total_lawyer_fee_retained)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-end gap-2">
                    <Link
                      href={`/statement?property=${b.property_id}`}
                      className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Generate Statement
                    </Link>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>

          {/* Ledger of Transactions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Transactions Ledger
                </h3>
                <p className="text-xs text-slate-500">
                  Audit trail of rent inflows, 10% legal fee deductions, artisan maintenance expenses, and owner remittances.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1 text-xs">
                {[
                  { key: 'ALL', label: 'All' },
                  { key: 'RENT_INFLOW', label: 'Rent Inflow' },
                  { key: 'MANAGEMENT_FEE', label: 'Legal Management Fees' },
                  { key: 'SERVICE_CHARGE', label: 'Service Charge' },
                  { key: 'MAINTENANCE_EXPENSE', label: 'Artisans' },
                  { key: 'OWNER_REMITTANCE', label: 'Remittances' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setTxFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${
                      txFilter === f.key
                        ? 'bg-emerald-800 text-amber-300 font-bold shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Fund Pool</th>
                    <th className="py-3 px-3 text-right">Amount (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No transactions found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isInflow =
                        tx.tx_type === 'RENT_INFLOW' ||
                        tx.tx_type === 'SERVICE_CHARGE' ||
                        tx.tx_type === 'CAUTION_DEPOSIT' ||
                        tx.tx_type === 'MANAGEMENT_FEE';

                      const isLegalFee =
                        tx.tx_type === 'MANAGEMENT_FEE' || tx.tx_type === 'TENANT_LEGAL_FEE';
                      const isExpense =
                        tx.tx_type === 'MAINTENANCE_EXPENSE' || tx.tx_type === 'CAUTION_REFUND';
                      const isRemittance = tx.tx_type === 'OWNER_REMITTANCE';

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition"
                        >
                          <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">
                            {formatDate(tx.tx_date)}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {tx.tx_type === 'TENANT_LEGAL_FEE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                <Scale className="w-3 h-3" /> 1ST-YR 10% LEGAL FEE
                              </span>
                            ) : isLegalFee ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                <Scale className="w-3 h-3" /> RENEWAL 10% MGT FEE
                              </span>
                            ) : tx.tx_type === 'RENT_INFLOW' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                                <ArrowUpRight className="w-3 h-3 text-emerald-600" /> RENT INFLOW
                              </span>
                            ) : tx.tx_type === 'SERVICE_CHARGE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300">
                                S/CHARGE INFLOW
                              </span>
                            ) : tx.tx_type === 'CAUTION_REFUND' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300 border border-violet-300">
                                CAUTION REFUND
                              </span>
                            ) : isExpense ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300">
                                <ArrowDownRight className="w-3 h-3 text-rose-600" /> ARTISAN VOUCHER
                              </span>
                            ) : isRemittance ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300">
                                OWNER REMITTANCE
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800">
                                {tx.tx_type}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              {tx.description}
                            </span>
                            {tx.reference_note && (
                              <span className="text-[11px] text-slate-500 font-mono block">
                                {tx.reference_note}
                              </span>
                            )}
                            {tx.created_by_name && (
                              <span className="text-[10px] text-slate-400 block">
                                Audited by: {tx.created_by_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {tx.funding_source === 'SERVICE_CHARGE_POOL' ? (
                              <span className="text-sky-600 dark:text-sky-400 font-medium">Service Charge Pool</span>
                            ) : tx.funding_source === 'LANDLORD_RENT_POOL' ? (
                              <span className="text-emerald-700 dark:text-emerald-400 font-medium">Landlord Rent Pool</span>
                            ) : tx.funding_source === 'CAUTION_ESCROW' ? (
                              <span className="text-violet-600 font-medium">Caution Escrow</span>
                            ) : isLegalFee ? (
                              <span className="text-amber-600 font-medium">Lawyer Retained Ledger</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold whitespace-nowrap">
                            <span
                              className={
                                isExpense || isRemittance
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isLegalFee
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }
                            >
                              {isExpense || isRemittance ? '-' : '+'}
                              {formatNaira(tx.amount)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Modals */}
        <CreateInvoiceModal
          isOpen={isCreateInvoiceOpen}
          onClose={() => setIsCreateInvoiceOpen(false)}
          defaultPropertyId={selectedPropertyId}
        />

        <VerifyInvoiceModal
          isOpen={Boolean(verifyInvoice)}
          invoice={verifyInvoice}
          onClose={() => setVerifyInvoice(null)}
          onVerified={refreshData}
        />

        <LogExpenseModal
          isOpen={isLogExpenseOpen}
          onClose={() => setIsLogExpenseOpen(false)}
          defaultPropertyId={selectedPropertyId}
          onSaved={refreshData}
        />

        <RecordRemittanceModal
          isOpen={isRecordRemittanceOpen}
          onClose={() => setIsRecordRemittanceOpen(false)}
          defaultPropertyId={selectedPropertyId}
          onSaved={refreshData}
        />
      </div>
    </PWAProvider>
  );
}
