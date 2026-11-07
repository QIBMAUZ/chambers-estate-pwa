'use client';

import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Building,
  CheckCircle2,
  Calendar,
  Eye,
  X,
  CreditCard,
  User,
  ShieldCheck,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { LogExpenseModal } from '@/components/LogExpenseModal';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';
import { Transaction, FundingSource, PropertyBalances } from '@/types/database';

export default function ExpensesPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balances, setBalances] = useState<PropertyBalances[]>([]);
  const [poolFilter, setPoolFilter] = useState<string>('ALL');

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshData = () => {
    const allTx = EstateStore.getTransactions(selectedPropertyId || undefined);
    setTransactions(allTx.filter((t) => t.tx_type === 'MAINTENANCE_EXPENSE'));
    setBalances(EstateStore.getPropertyBalances(selectedPropertyId || undefined));
  };

  const handleDeleteExpense = async (tx: Transaction) => {
    const poolName = tx.funding_source === 'SERVICE_CHARGE_POOL' ? 'Service Charge Pool' : 'Landlord Net Pool';
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
                Artisan &amp; Estate Maintenance Tracking
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Itemized maintenance ledger strictly segregated into Service Charge Pool vs Landlord Rent Pool.
              </p>
            </div>

            <button
              onClick={() => setIsLogOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl shadow-md transition text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Log Artisan Expense</span>
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
              { key: 'ALL', label: 'All Artisan Expenses' },
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
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              Artisan Disbursements ({filteredExpenses.length})
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Funding Pool</th>
                    <th className="py-3 px-3">Description &amp; Artisan</th>
                    <th className="py-3 px-3">Estate / Unit</th>
                    <th className="py-3 px-3">Receipt</th>
                    <th className="py-3 px-3 text-right">Amount (₦)</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No maintenance expenses recorded in this category.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">
                          {formatDate(t.tx_date)}
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
                          {t.reference_note && (
                            <span className="text-[11px] text-slate-500 font-medium block">
                              {t.reference_note}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          <span>{t.property?.title}</span>
                          {t.unit && <span className="block text-[11px] text-slate-500">{t.unit.unit_name}</span>}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {t.receipt_url ? (
                            <button
                              onClick={() => setPreviewImage(t.receipt_url)}
                              className="text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Receipt</span>
                            </button>
                          ) : (
                            <span className="text-slate-400">Direct Invoice</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          -{formatNaira(t.amount)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteExpense(t)}
                            disabled={deletingId === t.id}
                            title="Delete expense and restore balance"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
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
              <img src={previewImage} alt="Receipt preview" className="w-full h-auto rounded-lg" />
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
