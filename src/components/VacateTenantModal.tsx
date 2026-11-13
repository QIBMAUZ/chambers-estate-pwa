'use client';

import React, { useState, useEffect } from 'react';
import {
  LogOut,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Calculator,
  Archive,
} from 'lucide-react';
import { Unit } from '@/types/database';
import { EstateStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';

interface VacateTenantModalProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onVacated?: () => void;
}

export function VacateTenantModal({
  unit,
  isOpen,
  onClose,
  onVacated,
}: VacateTenantModalProps) {
  const [moveOutDate, setMoveOutDate] = useState('');
  const [cautionHeld, setCautionHeld] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);
  const [settlementNotes, setSettlementNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (unit && isOpen) {
      setMoveOutDate(new Date().toISOString().slice(0, 10));
      setCautionHeld(Number(unit.caution_fee) || 0);
      setDeductions(0);
      setSettlementNotes('Joint exit inspection completed. Keys handed over to Chambers.');
    }
  }, [unit, isOpen]);

  if (!isOpen || !unit) return null;

  const refundAmount = Math.max(0, Number(cautionHeld || 0) - Number(deductions || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`Confirm vacating ${unit.current_tenant_name} from ${unit.unit_name}? This will archive their full KYC/guarantor history and reset the unit to VACANT.`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await EstateStore.vacateAndArchiveTenant({
        unit_id: unit.id,
        move_out_date: moveOutDate,
        caution_deposit_held: cautionHeld,
        deductions_amount: deductions,
        refund_amount: refundAmount,
        settlement_notes: settlementNotes,
      });

      if (onVacated) onVacated();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Error vacating tenant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-rose-950 px-5 py-4 text-white flex items-center justify-between border-b border-rose-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-rose-950 font-bold">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                End Tenancy &amp; Soft-Archive Occupant
              </h3>
              <p className="text-xs text-rose-200">
                {unit.unit_name} • {unit.property?.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-rose-200 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {/* Snapshot of Tenant Being Archived */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              Vacating Tenant KYC Snapshot (To be preserved in tenancy_history)
            </span>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {unit.current_tenant_name}
            </div>
            <div className="text-slate-500 flex flex-wrap gap-3">
              <span>Tel: {unit.tenant_phone || '—'}</span>
              <span>•</span>
              <span>NIN/ID: {unit.tenant_nin_or_id || 'Recorded'}</span>
              <span>•</span>
              <span>Guarantor: {unit.guarantor_name || 'Recorded'}</span>
            </div>
            <div className="text-slate-500">
              Lease Cycle: {formatDate(unit.lease_start_date)} → {formatDate(unit.lease_end_date)}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Effective Move-Out / Handover Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={moveOutDate}
              onChange={(e) => setMoveOutDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm"
            />
          </div>

          {/* Caution Deposit Reconciliation */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-emerald-600" />
              Caution Deposit Escrow Settlement
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Caution Deposit Held (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cautionHeld}
                  onChange={(e) => setCautionHeld(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-rose-600 dark:text-rose-400 mb-1">
                  Less: Damages / Deductions (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  max={cautionHeld}
                  value={deductions}
                  onChange={(e) => setDeductions(Number(e.target.value))}
                  className="w-full rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 p-2 font-bold text-rose-600"
                />
              </div>
            </div>

            <div className="bg-emerald-950 text-white p-3 rounded-lg flex items-center justify-between">
              <span className="font-semibold text-emerald-200">Net Caution Refund Payable to Tenant:</span>
              <span className="font-black text-sm text-amber-300">{formatNaira(refundAmount)}</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Exit Inspection &amp; Settlement Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              placeholder="Detail exit inspection findings, meter readings, dilapidation deductions, and key handover..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold shadow-md transition disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Archiving Tenancy...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Archive Tenant &amp; Mark Unit VACANT</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
