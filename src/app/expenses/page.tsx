'use client';

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Eye,
  X,
  Trash2,
  FileBadge,
  Lock,
  Loader2,
  UserCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { LogExpenseModal } from '@/components/LogExpenseModal';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';
import { Transaction, PropertyBalances } from '@/types/database';

export default function ExpensesPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<PropertyBalances[]>([]);
  const [poolFilter, setPoolFilter] = useState<string>('ALL');
  const [isAccountant, setIsAccountant] = useState(false);

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingVoucherId, setDownloadingVoucherId] = useState<string | null>(null);

  const refreshData = () => {
    const allTx = EstateStore.getTransactions(selectedPropertyId || undefined);
    setTransactions(allTx.filter((t) => t.tx_type === 'MAINTENANCE_EXPENSE'));
    setBalances(EstateStore.getPropertyBalances(selectedPropertyId || undefined));
    setIsAccountant(EstateStore.isAccountantClerk());
  };

  const handleDownloadVoucher = async (tx: Transaction) => {
    setDownloadingVoucherId(tx.id);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { ArtisanVoucherDocument } = await import('@/components/ArtisanVoucherPDF');
      const currentProf = EstateStore.getChamberProfile();

      const blob = await pdf(
        <ArtisanVoucherDocument transaction={tx} profile={currentProf} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const serial = tx.voucher_number || `VCH-${tx.id.slice(0, 6).toUpperCase()}`;
      link.download = `Stamped_Payment_Voucher_${serial}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating voucher PDF:', err);
      alert('Could not generate voucher PDF.');
    } finally {
      setDownloadingVoucherId(null);
    }
  };

  const handleDeleteExpense = async (tx: Transaction) => {
    if (EstateStore.isAccountantClerk()) {
      alert('RBAC Restriction: Accountant / Clerk cannot delete stamped payment vouchers.');
      return;
    }
    const poolName =
      tx.funding_source === 'SERVICE_CHARGE_POOL' ? 'Service Charge Pool' : 'Landlord Net Pool';
    const confirmDelete = confirm(
      `Are you sure you want to delete this expense record (${formatNaira(tx.amount)} - ${tx.description})? This will restore the deducted balance to the ${poolName}.`
    );
    if (!confirmDelete) return;

    setDeletingId(tx.id);
    try {
      await EstateStore.deleteTransaction(tx.id);
      refreshData();
    } catch (err: any) {
      console.error('Error deleting expense:', err);
      alert(`Could not delete expense: ${err?.message || 'Database error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    setMounted(true);
    refreshData();
    const unsub = subscribeToStore(() => refreshData());
    return () => unsub();
  }, [selectedPropertyId]);

  const filteredExpenses = transactions.filter((t) => {
    if (poolFilter === 'ALL') return true;
    return t.funding_source === poolFilter;
  });

  const totalServiceChargePool = balances.reduce((sum, b) => sum + b.service_charge_balance, 0);
  const totalLandlordRentPool = balances.reduce((sum, b) => sum + b.landlord_net_balance, 0);

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
                <Wrench className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                Artisan Maintenance &amp; Stamped Payment Vouchers (VCH-...)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                No-receipt artisan disbursements backed by internal Stamped Digital Payment Vouchers (`VCH-...`) and optional work photo proof.
              </p>
            </div>

            <button
              onClick={() => setIsLogOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Log Artisan Expense &amp; Stamp Voucher</span>
            </button>
          </div>

          {/* Available Reserves Pill Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-sky-950 text-sky-100 p-5 rounded-2xl border border-sky-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-sky-300">
                  Service Charge Reserve Balance
                </span>
                <div className="text-2xl font-black mt-1 text-white">
                  {formatNaira(totalServiceChargePool)}
                </div>
                <p className="text-[11px] text-sky-200 mt-0.5">
                  Shared running pool for Security, Borehole, Gen &amp; Waste
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-800 flex items-center justify-center text-sky-200 font-bold">
                SC
              </div>
            </div>

            <div className="bg-emerald-950 text-emerald-100 p-5 rounded-2xl border border-emerald-800 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-bold text-amber-300">
                  Landlord Net Rent Balance
                </span>
                <div className="text-2xl font-black mt-1 text-white">
                  {formatNaira(totalLandlordRentPool)}
                </div>
                <p className="text-[11px] text-emerald-300 mt-0.5">
                  Available for Landlord-approved flat repairs &amp; disbursements
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-800 flex items-center justify-center text-emerald-200 font-bold">
                LP
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: 'ALL', label: 'All Artisan Vouchers' },
              { key: 'SERVICE_CHARGE_POOL', label: 'Service Charge Pool (Estate Ops)' },
              { key: 'LANDLORD_RENT_POOL', label: 'Landlord Rent Pool (Flat Repairs)' },
              { key: 'CAUTION_ESCROW', label: 'Caution Escrow (Move-out repairs)' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setPoolFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                  poolFilter === f.key
                    ? 'bg-emerald-950 text-amber-300 border-emerald-800 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Expenses Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Stamped Artisan Payment Vouchers ({filteredExpenses.length})
              </h3>
              {isAccountant && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300">
                  <Lock className="w-3 h-3" /> Stamped Vouchers Locked (Accountant Role)
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-3">Date &amp; Voucher</th>
                    <th className="py-3 px-3">Funding Pool</th>
                    <th className="py-3 px-3">Description &amp; Artisan</th>
                    <th className="py-3 px-3">Estate / Unit</th>
                    <th className="py-3 px-3">Evidence / Voucher PDF</th>
                    <th className="py-3 px-3 text-right">Amount (₦)</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {!mounted ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading vouchers...
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No maintenance expenses recorded in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((t) => {
                      const voucherNo =
                        t.voucher_number ||
                        `VCH-${new Date(t.tx_date).getFullYear()}-${t.id.slice(0, 5).toUpperCase()}`;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 block">
                              {voucherNo}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {formatDate(t.tx_date)}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            {t.funding_source === 'SERVICE_CHARGE_POOL' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300">
                                SERVICE CHARGE POOL
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                                LANDLORD RENT POOL
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              {t.description}
                            </span>
                            {(t.artisan_name || t.reference_note) && (
                              <span className="text-[11px] text-slate-500 font-medium block">
                                {t.artisan_name
                                  ? `Artisan: ${t.artisan_name}${t.artisan_phone ? ` (${t.artisan_phone})` : ''}`
                                  : t.reference_note}
                              </span>
                            )}
                            {t.created_by_name && (
                              <span className="text-[10px] text-slate-400 inline-flex items-center gap-1 mt-0.5">
                                <UserCheck className="w-3 h-3 text-emerald-600" />
                                Logged by: {t.created_by_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <span>{t.property?.title}</span>
                            {t.unit && (
                              <span className="block text-[11px] text-slate-500">
                                {t.unit.unit_name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap space-y-1">
                            <button
                              type="button"
                              onClick={() => handleDownloadVoucher(t)}
                              disabled={downloadingVoucherId === t.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold transition"
                            >
                              {downloadingVoucherId === t.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <FileBadge className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              <span>Stamped Voucher PDF</span>
                            </button>
                            <div className="flex items-center gap-2">
                              {t.work_photo_url && (
                                <button
                                  onClick={() => setPreviewImage(t.work_photo_url || null)}
                                  className="text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 text-[11px] font-semibold"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  <span>Work Photo</span>
                                </button>
                              )}
                              {t.receipt_url && (
                                <button
                                  onClick={() => setPreviewImage(t.receipt_url)}
                                  className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 text-[11px] font-semibold"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>Paper Receipt</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            -{formatNaira(t.amount)}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {isAccountant ? (
                              <span
                                title="Stamped vouchers cannot be modified or deleted by Accountant / Clerk"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800"
                              >
                                <Lock className="w-3 h-3" /> Locked
                              </span>
                            ) : (
                              <button
                                onClick={() => handleDeleteExpense(t)}
                                disabled={deletingId === t.id}
                                title="Delete expense and restore balance (Head of Chambers only)"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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

        <LogExpenseModal
          isOpen={isLogOpen}
          onClose={() => setIsLogOpen(false)}
          defaultPropertyId={selectedPropertyId}
          onSaved={refreshData}
        />

        {previewImage && (
          <div
            className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-2xl max-h-[90vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImage} alt="Evidence preview" className="w-full h-auto rounded-lg" />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white p-2 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </PWAProvider>
  );
}
