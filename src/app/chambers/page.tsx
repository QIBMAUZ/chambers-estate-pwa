'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Scale,
  Plus,
  Coins,
  FileText,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Trash2,
  Lock,
  Loader2,
  UserCheck,
  X,
  Building2,
  Gavel,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { RecordTrancheModal } from '@/components/RecordTrancheModal';
import { CameraCapture } from '@/components/CameraCapture';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';
import {
  LegalMatter,
  SolicitorFeeNote,
  FirmExpense,
  MatterCategory,
  FirmExpenseCategory,
  TranchePayment,
} from '@/types/database';

const MATTER_CATEGORIES: { value: MatterCategory; label: string }[] = [
  { value: 'LITIGATION', label: 'Litigation & Court Advocacy' },
  { value: 'LAND_PERFECTION', label: 'Land Title Perfection & Governor Consent' },
  { value: 'CAC', label: 'CAC Corporate Registration & Filings' },
  { value: 'CONSULTANCY', label: 'Legal Retainer & Advisory Consultancy' },
  { value: 'GENERAL_SOLICITOR', label: 'General Solicitor & Conveyancing' },
];

export default function ChambersPage() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'FEE_NOTES' | 'FIRM_EXPENSES' | 'MATTERS'>('FEE_NOTES');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const [matters, setMatters] = useState<LegalMatter[]>([]);
  const [feeNotes, setFeeNotes] = useState<SolicitorFeeNote[]>([]);
  const [firmExpenses, setFirmExpenses] = useState<FirmExpense[]>([]);
  const [profitSummary, setProfitSummary] = useState(EstateStore.getFirmProfitSummary());
  const [isAccountant, setIsAccountant] = useState(false);

  // Modals
  const [isNewMatterOpen, setIsNewMatterOpen] = useState(false);
  const [isNewFeeNoteOpen, setIsNewFeeNoteOpen] = useState(false);
  const [isNewFirmExpenseOpen, setIsNewFirmExpenseOpen] = useState(false);
  const [trancheFeeNote, setTrancheFeeNote] = useState<SolicitorFeeNote | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // New Matter Form State
  const [mTitle, setMTitle] = useState('');
  const [mClientName, setMClientName] = useState('');
  const [mClientPhone, setMClientPhone] = useState('');
  const [mClientEmail, setMClientEmail] = useState('');
  const [mCategory, setMCategory] = useState<MatterCategory>('LAND_PERFECTION');
  const [mCourtInfo, setMCourtInfo] = useState('');

  // New Fee Note Form State
  const [fnMatterId, setFnMatterId] = useState<string>('');
  const [fnClientName, setFnClientName] = useState('');
  const [fnClientPhone, setFnClientPhone] = useState('');
  const [fnClientEmail, setFnClientEmail] = useState('');
  const [fnCategory, setFnCategory] = useState<MatterCategory>('LAND_PERFECTION');
  const [fnDescription, setFnDescription] = useState('');
  const [fnAgreedFee, setFnAgreedFee] = useState<number>(1500000);
  const [fnInitialDeposit, setFnInitialDeposit] = useState<number>(0);
  const [fnDueDate, setFnDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [fnPromiseDate, setFnPromiseDate] = useState('');

  // New Firm Expense Form State
  const [feCategory, setFeCategory] = useState<FirmExpenseCategory>('COURT_REGISTRY_DISBURSEMENT');
  const [feMatterId, setFeMatterId] = useState<string>('');
  const [feTitle, setFeTitle] = useState('');
  const [feVendor, setFeVendor] = useState('');
  const [feAmount, setFeAmount] = useState<number>(35000);
  const [feDate, setFeDate] = useState(new Date().toISOString().split('T')[0]);
  const [feReceiptUrl, setFeReceiptUrl] = useState<string | null>(null);

  const refreshData = () => {
    setMatters(EstateStore.getLegalMatters());
    setFeeNotes(EstateStore.getSolicitorFeeNotes());
    setFirmExpenses(EstateStore.getFirmExpenses());
    setProfitSummary(EstateStore.getFirmProfitSummary());
    setIsAccountant(EstateStore.isAccountantClerk());
  };

  useEffect(() => {
    setMounted(true);
    refreshData();
    const unsub = subscribeToStore(() => refreshData());
    return () => unsub();
  }, []);

  const handleDownloadFeeNotePDF = async (fn: SolicitorFeeNote, tranche?: TranchePayment) => {
    const key = tranche ? tranche.id : fn.id;
    setDownloadingId(key);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { SolicitorFeeNoteDocument } = await import('@/components/SolicitorFeeNotePDF');
      const prof = EstateStore.getChamberProfile();

      const blob = await pdf(
        <SolicitorFeeNoteDocument feeNote={fn} profile={prof} tranche={tranche} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const serial = tranche?.receipt_number || fn.fee_note_number;
      link.download = `Solicitor_${serial}_${fn.client_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating Fee Note PDF:', err);
      alert('Could not generate Fee Note PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCreateMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitle || !mClientName) return;
    const created = await EstateStore.createLegalMatter({
      title: mTitle,
      client_name: mClientName,
      client_phone: mClientPhone,
      client_email: mClientEmail,
      category: mCategory,
      notes: mCourtInfo,
    });
    setFnMatterId(created.id);
    setFnClientName(created.client_name);
    setFnClientPhone(created.client_phone || '');
    setFnClientEmail(created.client_email || '');
    setFnCategory(created.category);
    setMTitle('');
    setMClientName('');
    setMClientPhone('');
    setMClientEmail('');
    setMCourtInfo('');
    setIsNewMatterOpen(false);
    refreshData();
  };

  const handleCreateFeeNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fnClientName || !fnDescription || fnAgreedFee <= 0) return;

    let targetMatterId = fnMatterId;
    if (!targetMatterId) {
      const autoMatter = await EstateStore.createLegalMatter({
        title: fnDescription,
        category: fnCategory,
        client_name: fnClientName,
        client_phone: fnClientPhone,
        client_email: fnClientEmail,
      });
      targetMatterId = autoMatter.id;
    }

    await EstateStore.createSolicitorFeeNote({
      matter_id: targetMatterId,
      description: fnDescription,
      agreed_fee: fnAgreedFee,
      initial_deposit: fnInitialDeposit,
      due_date: fnDueDate,
      promise_to_pay_date: fnPromiseDate || null,
    });
    setFnDescription('');
    setFnInitialDeposit(0);
    setIsNewFeeNoteOpen(false);
    refreshData();
  };

  const handleCreateFirmExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feTitle || feAmount <= 0) return;
    await EstateStore.logFirmExpense({
      matter_id: feMatterId || null,
      category: feCategory,
      title: feTitle,
      vendor_or_registry: feVendor,
      amount: feAmount,
      expense_date: feDate,
      receipt_url: feReceiptUrl,
    });
    setFeTitle('');
    setFeVendor('');
    setFeReceiptUrl(null);
    setIsNewFirmExpenseOpen(false);
    refreshData();
  };

  const handleDeleteFirmExpense = async (fe: FirmExpense) => {
    if (EstateStore.isAccountantClerk()) {
      alert('RBAC Restriction: Accountant / Clerk cannot delete firm expense records.');
      return;
    }
    if (!confirm(`Delete firm expense "${fe.title}" (${formatNaira(fe.amount)})?`)) return;
    try {
      await EstateStore.deleteFirmExpense(fe.id);
      refreshData();
    } catch (err: any) {
      alert(err?.message || 'Error deleting firm expense');
    }
  };

  const filteredFeeNotes = feeNotes.filter((fn) => {
    if (categoryFilter === 'ALL') return true;
    return fn.matter_category === categoryFilter;
  });

  return (
    <PWAProvider>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12">
        <Navigation />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950 text-amber-300 text-[11px] font-bold border border-emerald-800 mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ISOLATED FROM LANDLORD ESCROW ACCOUNTS</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Briefcase className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                Chambers &amp; Solicitors Fee Notes (`FN-...`) &amp; Firm Profit Ledger
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Manage Litigation, CAC, Land Perfection &amp; Consultancy Fee Notes alongside Court Disbursements and Firm Running Costs.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsNewMatterOpen(true)}
                className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold px-3.5 py-2.5 rounded-xl text-xs transition"
              >
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>+ New Legal Matter</span>
              </button>
              <button
                onClick={() => setIsNewFeeNoteOpen(true)}
                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold px-4 py-2.5 rounded-xl shadow-md text-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>Raise Solicitor Fee Note (FN-...)</span>
              </button>
              <button
                onClick={() => setIsNewFirmExpenseOpen(true)}
                className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3.5 py-2.5 rounded-xl shadow-md text-xs transition"
              >
                <Gavel className="w-4 h-4 text-amber-300" />
                <span>Log Court / Office Expense</span>
              </button>
            </div>
          </div>

          {/* Requirement 9: Real-Time Firm Net Profit Visibility Banner */}
          <div className="bg-emerald-950 text-white rounded-3xl border border-emerald-800 p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800/80 pb-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-400 block">
                  Chambers Executive Accounting (Isolated from Client Rent Escrow)
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  Real-Time Law Firm Inflows vs. Disbursements &amp; Net Profit
                </h2>
              </div>
              <div className="bg-emerald-900/80 border border-emerald-700 px-4 py-2.5 rounded-2xl text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                  Net Chambers Profit
                </span>
                <span
                  className={`text-xl sm:text-2xl font-black font-mono ${
                    profitSummary.netFirmProfit >= 0 ? 'text-amber-300' : 'text-rose-400'
                  }`}
                >
                  {mounted ? formatNaira(profitSummary.netFirmProfit) : '₦0.00'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Total Firm Inflows Box */}
              <div className="bg-emerald-900/40 border border-emerald-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Total Law Firm Earned Inflows
                  </span>
                  <span className="text-base font-black text-emerald-300 font-mono">
                    {mounted ? formatNaira(profitSummary.totalFirmInflows) : '₦0'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-800/60 text-[11px]">
                  <div>
                    <span className="text-emerald-300/80 block">1st-Yr 10% Legal Fees</span>
                    <span className="font-bold text-white font-mono">
                      {mounted ? formatNaira(profitSummary.firstYearLegalFees) : '₦0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-300/80 block">10% Renewal Mgt Fees</span>
                    <span className="font-bold text-white font-mono">
                      {mounted ? formatNaira(profitSummary.renewalManagementFees) : '₦0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-amber-300 block">Solicitor Fee Notes</span>
                    <span className="font-bold text-amber-300 font-mono">
                      {mounted ? formatNaira(profitSummary.solicitorFeeNotesCollected) : '₦0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Firm Outflows Box */}
              <div className="bg-emerald-900/40 border border-emerald-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                    Total Firm Running Costs &amp; Case Disbursements
                  </span>
                  <span className="text-base font-black text-rose-300 font-mono">
                    -{mounted ? formatNaira(profitSummary.totalFirmExpenses) : '₦0'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-800/60 text-[11px]">
                  <div>
                    <span className="text-emerald-300/80 block">
                      Court / Registry Disbursements (`COURT_REGISTRY_DISBURSEMENT`)
                    </span>
                    <span className="font-bold text-rose-200 font-mono">
                      {mounted ? formatNaira(profitSummary.courtRegistryDisbursements) : '₦0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-emerald-300/80 block">
                      Chambers Overheads (`FIRM_OVERHEAD`)
                    </span>
                    <span className="font-bold text-rose-200 font-mono">
                      {mounted ? formatNaira(profitSummary.firmOverheads) : '₦0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('FEE_NOTES')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'FEE_NOTES'
                  ? 'bg-emerald-950 text-amber-300 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Solicitor Fee Notes (`FN-...`) ({feeNotes.length})
            </button>
            <button
              onClick={() => setActiveTab('FIRM_EXPENSES')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'FIRM_EXPENSES'
                  ? 'bg-emerald-950 text-amber-300 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Court Disbursements vs. Office Overheads ({firmExpenses.length})
            </button>
            <button
              onClick={() => setActiveTab('MATTERS')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === 'MATTERS'
                  ? 'bg-emerald-950 text-amber-300 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              Client Legal Matters (`MAT-...`) ({matters.length})
            </button>
          </div>

          {/* TAB 1: SOLICITOR FEE NOTES */}
          {activeTab === 'FEE_NOTES' && (
            <div className="space-y-4">
              {/* Category Filter */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { key: 'ALL', label: 'All Practice Areas' },
                  { key: 'LITIGATION', label: 'Litigation' },
                  { key: 'LAND_PERFECTION', label: 'Land Perfection' },
                  { key: 'CAC', label: 'CAC Corporate' },
                  { key: 'CONSULTANCY', label: 'Consultancy' },
                  { key: 'GENERAL_SOLICITOR', label: 'General Solicitor' },
                ].map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategoryFilter(c.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                      categoryFilter === c.key
                        ? 'bg-amber-500 text-emerald-950 border-amber-500'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {filteredFeeNotes.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-400 text-xs">
                  No Solicitor Fee Notes found for this category. Click &ldquo;Raise Solicitor Fee Note (FN-...)&rdquo; above.
                </div>
              ) : (
                filteredFeeNotes.map((fn) => {
                  const tranches = EstateStore.getTranchePayments(undefined, fn.id);
                  return (
                    <div
                      key={fn.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 hover:border-emerald-500 transition"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded bg-emerald-950 text-amber-300 border border-emerald-800">
                              {fn.fee_note_number}
                            </span>
                            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                              {fn.client_name}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {(fn.matter_category || 'GENERAL_SOLICITOR').replace(/_/g, ' ')}
                            </span>
                            {fn.status === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" /> PAID IN FULL
                              </span>
                            ) : fn.status === 'PARTIALLY_PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
                                <Coins className="w-3.5 h-3.5" /> PARTIALLY PAID
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300">
                                <Clock className="w-3.5 h-3.5" /> SENT
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1.5">
                            {fn.description}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                            <span>Due: {formatDate(fn.due_date)}</span>
                            {fn.promise_to_pay_date && fn.balance_due > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600 font-bold">
                                  Promise-to-Pay: {formatDate(fn.promise_to_pay_date)}
                                </span>
                              </>
                            )}
                            {fn.created_by_name && (
                              <>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-emerald-600" />
                                  Issued by: {fn.created_by_name}
                                </span>
                              </>
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                              Agreed Fee
                            </span>
                            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                              {formatNaira(fn.agreed_fee)}
                            </span>
                          </div>
                          <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-3">
                            <span className="text-[10px] text-emerald-600 uppercase font-bold block">
                              Paid to Firm
                            </span>
                            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatNaira(fn.amount_paid)}
                            </span>
                          </div>
                          <div className="text-right border-l border-slate-200 dark:border-slate-800 pl-3">
                            <span className="text-[10px] text-amber-600 uppercase font-bold block">
                              Balance Due
                            </span>
                            <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                              {formatNaira(fn.balance_due)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tranche Receipts List */}
                      {tranches.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-500 block">
                            Issued Firm Tranche Receipts (`RCT-...`)
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {tranches.map((tr) => (
                              <div
                                key={tr.id}
                                className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg text-xs"
                              >
                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  {tr.receipt_number}
                                </span>
                                <span className="font-bold">{formatNaira(tr.amount)}</span>
                                <span className="text-[10px] text-slate-400">
                                  {formatDate(tr.payment_date)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadFeeNotePDF(fn, tr)}
                                  className="text-[11px] font-bold text-emerald-600 hover:underline"
                                >
                                  Receipt PDF
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          onClick={() => handleDownloadFeeNotePDF(fn)}
                          disabled={downloadingId === fn.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs transition"
                        >
                          {downloadingId === fn.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>Download Official Fee Note / Receipt PDF</span>
                        </button>

                        {fn.balance_due > 0 && (
                          <button
                            onClick={() => setTrancheFeeNote(fn)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold text-xs shadow-sm transition"
                          >
                            <Coins className="w-4 h-4" />
                            <span>+ Record Tranche Payment &amp; Issue RCT-...</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: FIRM RUNNING COSTS VS CLIENT CASE DISBURSEMENTS */}
          {activeTab === 'FIRM_EXPENSES' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Chambers Disbursements &amp; Running Overheads ({firmExpenses.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Deducted strictly from Law Firm Revenue — never from Landlord Rent or Service Charge pools.
                  </p>
                </div>
                {isAccountant && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300">
                    <Lock className="w-3 h-3" /> Deletion Locked (Accountant Role)
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                      <th className="py-3 px-3">Voucher &amp; Date</th>
                      <th className="py-3 px-3">Classification</th>
                      <th className="py-3 px-3">Particulars &amp; Registry/Vendor</th>
                      <th className="py-3 px-3">Linked Legal Matter</th>
                      <th className="py-3 px-3 text-right">Amount (₦)</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {firmExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No firm expenses logged yet.
                        </td>
                      </tr>
                    ) : (
                      firmExpenses.map((fe) => (
                        <tr key={fe.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 block">
                              {fe.voucher_number}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {formatDate(fe.expense_date)}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {fe.category === 'COURT_REGISTRY_DISBURSEMENT' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
                                COURT / REGISTRY DISBURSEMENT
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300">
                                FIRM RUNNING OVERHEAD
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              {fe.title}
                            </span>
                            {fe.vendor_or_registry && (
                              <span className="text-[11px] text-slate-500 block">
                                {fe.vendor_or_registry}
                              </span>
                            )}
                            {fe.created_by_name && (
                              <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-emerald-600" />
                                Logged by: {fe.created_by_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                            {fe.matter_title ? (
                              <div>
                                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
                                  {fe.matter_title}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">General Chambers Ops</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            -{formatNaira(fe.amount)}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {isAccountant ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDeleteFirmExpense(fe)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CLIENT LEGAL MATTERS */}
          {activeTab === 'MATTERS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matters.map((m) => (
                <div
                  key={m.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs px-2.5 py-0.5 rounded bg-emerald-950 text-amber-300">
                      {m.matter_number}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {m.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    {m.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Client: <strong className="text-slate-700 dark:text-slate-200">{m.client_name}</strong>{' '}
                    {m.client_phone ? `(${m.client_phone})` : ''}
                  </p>
                  {m.notes && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                      Registry / Court: {m.notes}
                    </p>
                  )}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setFnMatterId(m.id);
                        setFnClientName(m.client_name);
                        setFnClientPhone(m.client_phone || '');
                        setFnClientEmail(m.client_email || '');
                        setFnCategory(m.category);
                        setFnDescription(`Professional Legal Fees for ${m.title}`);
                        setIsNewFeeNoteOpen(true);
                      }}
                      className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      + Raise Fee Note for this Matter →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* MODAL 1: NEW LEGAL MATTER */}
        {isNewMatterOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
              <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between">
                <h3 className="font-bold text-base">Open New Client Legal Matter (`MAT-...`)</h3>
                <button onClick={() => setIsNewMatterOpen(false)}>
                  <X className="w-5 h-5 text-emerald-300" />
                </button>
              </div>
              <form onSubmit={handleCreateMatter} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold mb-1">Matter Title / Suit Reference *</label>
                  <input
                    type="text"
                    required
                    value={mTitle}
                    onChange={(e) => setMTitle(e.target.value)}
                    placeholder="e.g. Suit No. LD/4412/2026 - Land Recovery or Governor's Consent Perfection"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Practice Category *</label>
                    <select
                      value={mCategory}
                      onChange={(e) => setMCategory(e.target.value as MatterCategory)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    >
                      {MATTER_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Client Full Name *</label>
                    <input
                      type="text"
                      required
                      value={mClientName}
                      onChange={(e) => setMClientName(e.target.value)}
                      placeholder="e.g. Chief Adebayo Ogunlesi"
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Client Phone</label>
                    <input
                      type="text"
                      value={mClientPhone}
                      onChange={(e) => setMClientPhone(e.target.value)}
                      placeholder="+234 803..."
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Client Email</label>
                    <input
                      type="email"
                      value={mClientEmail}
                      onChange={(e) => setMClientEmail(e.target.value)}
                      placeholder="client@domain.ng"
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-bold mb-1">Court / Registry Details</label>
                  <input
                    type="text"
                    value={mCourtInfo}
                    onChange={(e) => setMCourtInfo(e.target.value)}
                    placeholder="e.g. Lagos High Court (Lands Division) / Alausa Lands Registry"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md"
                >
                  Register Client Legal Matter
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: RAISE SOLICITOR FEE NOTE */}
        {isNewFeeNoteOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl my-6">
              <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Raise Formal Solicitor Fee Note (`FN-...`)</h3>
                  <p className="text-[11px] text-emerald-300">
                    100% Chambers Legal Revenue — Isolated from Landlord Rent Escrow
                  </p>
                </div>
                <button onClick={() => setIsNewFeeNoteOpen(false)}>
                  <X className="w-5 h-5 text-emerald-300" />
                </button>
              </div>
              <form onSubmit={handleCreateFeeNote} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold mb-1">Link to Existing Legal Matter (Optional)</label>
                  <select
                    value={fnMatterId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setFnMatterId(id);
                      const found = matters.find((m) => m.id === id);
                      if (found) {
                        setFnClientName(found.client_name);
                        setFnClientPhone(found.client_phone || '');
                        setFnClientEmail(found.client_email || '');
                        setFnCategory(found.category);
                        setFnDescription(`Professional Legal Fees: ${found.title}`);
                      }
                    }}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="">-- Standalone Solicitor Fee Note --</option>
                    {matters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.matter_number} • {m.title} ({m.client_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Client Name *</label>
                    <input
                      type="text"
                      required
                      value={fnClientName}
                      onChange={(e) => setFnClientName(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Practice Category *</label>
                    <select
                      value={fnCategory}
                      onChange={(e) => setFnCategory(e.target.value as MatterCategory)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    >
                      {MATTER_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Client Phone</label>
                    <input
                      type="text"
                      value={fnClientPhone}
                      onChange={(e) => setFnClientPhone(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Client Email (For Zoho Receipt)</label>
                    <input
                      type="email"
                      value={fnClientEmail}
                      onChange={(e) => setFnClientEmail(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Fee Note Particulars / Brief Description *</label>
                  <input
                    type="text"
                    required
                    value={fnDescription}
                    onChange={(e) => setFnDescription(e.target.value)}
                    placeholder="e.g. Professional Fee for Deed of Assignment & Governor's Consent Perfection"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Total Agreed Fee (₦) *</label>
                    <input
                      type="number"
                      min="1000"
                      step="1000"
                      required
                      value={fnAgreedFee}
                      onChange={(e) => setFnAgreedFee(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Initial Deposit Paid Now (₦)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={fnInitialDeposit}
                      onChange={(e) => setFnInitialDeposit(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-emerald-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={fnDueDate}
                      onChange={(e) => setFnDueDate(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Promise-to-Pay Date (If Balance)</label>
                    <input
                      type="date"
                      value={fnPromiseDate}
                      onChange={(e) => setFnPromiseDate(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-emerald-950 font-black py-3 rounded-xl shadow-md"
                >
                  Issue Solicitor Fee Note (`FN-...`)
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: LOG FIRM EXPENSE (COURT DISBURSEMENT VS OVERHEAD) */}
        {isNewFirmExpenseOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl my-6">
              <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">
                    Log Court / Registry Disbursement or Office Overhead (`FVCH-...`)
                  </h3>
                  <p className="text-[11px] text-emerald-300">
                    Deducted strictly from Chambers Revenue for Net Profit visibility
                  </p>
                </div>
                <button onClick={() => setIsNewFirmExpenseOpen(false)}>
                  <X className="w-5 h-5 text-emerald-300" />
                </button>
              </div>
              <form onSubmit={handleCreateFirmExpense} className="p-5 space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFeCategory('COURT_REGISTRY_DISBURSEMENT')}
                    className={`p-3 rounded-xl border text-left transition ${
                      feCategory === 'COURT_REGISTRY_DISBURSEMENT'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-900 dark:text-amber-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">Client Case Disbursement</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Court filing fees, bailiff service, CAC/Land Registry search fees
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFeCategory('FIRM_OVERHEAD');
                      setFeMatterId('');
                    }}
                    className={`p-3 rounded-xl border text-left transition ${
                      feCategory === 'FIRM_OVERHEAD'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-900 dark:text-purple-300 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">Firm Running Overhead</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Chambers diesel/inverter, NBA practicing fees, stationery, internet
                    </div>
                  </button>
                </div>

                {feCategory === 'COURT_REGISTRY_DISBURSEMENT' && (
                  <div>
                    <label className="block font-bold mb-1">Linked Legal Matter (Optional)</label>
                    <select
                      value={feMatterId}
                      onChange={(e) => setFeMatterId(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    >
                      <option value="">-- General Court / Registry Filing --</option>
                      {matters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.matter_number} • {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-bold mb-1">Expense Title / Description *</label>
                  <input
                    type="text"
                    required
                    value={feTitle}
                    onChange={(e) => setFeTitle(e.target.value)}
                    placeholder="e.g. High Court Writ of Summons Filing & Bailiff Service"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Registry / Vendor Name</label>
                    <input
                      type="text"
                      value={feVendor}
                      onChange={(e) => setFeVendor(e.target.value)}
                      placeholder="e.g. Lagos High Court Registry"
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Amount (₦) *</label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      required
                      value={feAmount}
                      onChange={(e) => setFeAmount(Number(e.target.value))}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Date *</label>
                    <input
                      type="date"
                      required
                      value={feDate}
                      onChange={(e) => setFeDate(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <CameraCapture
                  onCapture={(img) => setFeReceiptUrl(img)}
                  initialImage={feReceiptUrl}
                  label="Court Revenue Receipt / Vendor Invoice (Optional)"
                  helperText="Snap or upload receipt if available"
                />

                <button
                  type="submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md"
                >
                  Stamp Firm Voucher (`FVCH-...`) &amp; Deduct from Firm Profit
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: RECORD TRANCHE PAYMENT ON FEE NOTE */}
        <RecordTrancheModal
          isOpen={Boolean(trancheFeeNote)}
          feeNote={trancheFeeNote}
          onClose={() => setTrancheFeeNote(null)}
          onSuccess={refreshData}
        />
      </div>
    </PWAProvider>
  );
}
