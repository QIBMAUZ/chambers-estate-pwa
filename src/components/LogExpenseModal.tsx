'use client';

import React, { useState } from 'react';
import { X, Wrench, ShieldCheck, AlertCircle, Check, FileBadge } from 'lucide-react';
import { EstateStore } from '@/lib/store';
import { formatNaira } from '@/lib/utils';
import { FundingSource } from '@/types/database';
import { CameraCapture } from './CameraCapture';

interface LogExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPropertyId?: string;
  onSaved?: () => void;
}

export function LogExpenseModal({
  isOpen,
  onClose,
  defaultPropertyId,
  onSaved,
}: LogExpenseModalProps) {
  const properties = EstateStore.getProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    defaultPropertyId || properties[0]?.id || ''
  );
  const units = EstateStore.getUnits(selectedPropertyId);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  const [fundingSource, setFundingSource] = useState<FundingSource>('SERVICE_CHARGE_POOL');
  const [description, setDescription] = useState('');
  const [artisanName, setArtisanName] = useState('');
  const [artisanPhone, setArtisanPhone] = useState('');
  const [amount, setAmount] = useState<number>(45000);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [workPhotoUrl, setWorkPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const balances = EstateStore.getPropertyBalances(selectedPropertyId)[0] || {
    landlord_net_balance: 0,
    service_charge_balance: 0,
    total_lawyer_fee_retained: 0,
  };

  const poolCurrentBalance =
    fundingSource === 'SERVICE_CHARGE_POOL'
      ? balances.service_charge_balance
      : fundingSource === 'LANDLORD_RENT_POOL'
      ? balances.landlord_net_balance
      : 500000;

  const isLowBalance = amount > poolCurrentBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || !description || amount <= 0) {
      alert('Please fill out all required fields.');
      return;
    }

    if (isLowBalance) {
      const confirmProceed = confirm(
        `Warning: Selected pool currently holds ${formatNaira(
          poolCurrentBalance
        )}, which is less than expense amount ${formatNaira(amount)}. Proceed anyway?`
      );
      if (!confirmProceed) return;
    }

    setSaving(true);
    try {
      await EstateStore.logMaintenanceExpense({
        property_id: selectedPropertyId,
        unit_id: selectedUnitId || null,
        amount,
        description,
        funding_source: fundingSource,
        artisan_name: artisanName,
        artisan_phone: artisanPhone,
        receipt_url: receiptUrl,
        work_photo_url: workPhotoUrl,
      });

      if (onSaved) onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Log Artisan Expense &amp; Generate Stamped Voucher (VCH-...)
              </h3>
              <p className="text-xs text-emerald-300">
                No paper receipt required — generates an internal Stamped Digital Payment Voucher
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* No-Receipt Digital Voucher Callout */}
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <FileBadge className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Automated Internal Stamped Payment Voucher (VCH-...)</span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Informal artisans (plumbers, electricians, welders) rarely issue printed receipts. Submitting this form automatically stamps an immutable Chambers Digital Payment Voucher (`VCH-...`).
              </span>
            </div>
          </div>

          {/* Funding Source Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Funding Source Pool
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFundingSource('SERVICE_CHARGE_POOL')}
                className={`p-3 rounded-xl border text-left transition ${
                  fundingSource === 'SERVICE_CHARGE_POOL'
                    ? 'bg-sky-950 text-sky-200 border-sky-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Service Charge Pool</span>
                  {fundingSource === 'SERVICE_CHARGE_POOL' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Shared running expenses: Security, Borehole, Generator, Waste levies.
                </p>
                <div className="mt-2 text-[11px] font-mono font-semibold">
                  Avail: {formatNaira(balances.service_charge_balance)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFundingSource('LANDLORD_RENT_POOL')}
                className={`p-3 rounded-xl border text-left transition ${
                  fundingSource === 'LANDLORD_RENT_POOL'
                    ? 'bg-emerald-950 text-emerald-200 border-emerald-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>Landlord Rent Pool</span>
                  {fundingSource === 'LANDLORD_RENT_POOL' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Landlord-funded repairs inside specific flats or structural maintenance.
                </p>
                <div className="mt-2 text-[11px] font-mono font-semibold">
                  Avail: {formatNaira(balances.landlord_net_balance)}
                </div>
              </button>
            </div>
          </div>

          {/* Low Balance Warning */}
          {isLowBalance && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Expense amount ({formatNaira(amount)}) exceeds current balance in this pool ({formatNaira(poolCurrentBalance)}).
              </span>
            </div>
          )}

          {/* Property & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Property
              </label>
              <select
                value={selectedPropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value);
                  setSelectedUnitId('');
                }}
                suppressHydrationWarning
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
              >
                <option value="" disabled suppressHydrationWarning>
                  {properties.length === 0 ? 'No properties registered' : 'Select Property'}
                </option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id} suppressHydrationWarning>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Specific Unit (Optional)
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
              >
                <option value="">Shared / Entire Compound</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description & Artisan Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Job Description / Purpose of Expense *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Borehole submersible pump overhaul, Roof flashing repairs"
              className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Artisan / Technician Name *
              </label>
              <input
                type="text"
                required
                value={artisanName}
                onChange={(e) => setArtisanName(e.target.value)}
                placeholder="e.g. Engr. Musa Plumber"
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Artisan Phone Number
              </label>
              <input
                type="text"
                value={artisanPhone}
                onChange={(e) => setArtisanPhone(e.target.value)}
                placeholder="+234 803 000 1122"
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cost Incurred (₦) *
              </label>
              <input
                type="number"
                min="0"
                step="500"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full text-xs sm:text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
              />
            </div>
          </div>

          {/* Photo Proof of Completed Repair Work (Optional) & External Receipt (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CameraCapture
              onCapture={(img) => setWorkPhotoUrl(img)}
              initialImage={workPhotoUrl}
              label="Photo Proof of Completed Work (Optional)"
              helperText="Snap the repaired pump, pipe, or roof for Supabase Storage archive"
            />

            <CameraCapture
              onCapture={(img) => setReceiptUrl(img)}
              initialImage={receiptUrl}
              label="External Paper Receipt (Optional)"
              helperText="Leave blank if artisan did not provide a paper receipt"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl shadow-md transition text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>
                {saving
                  ? 'Stamping Voucher...'
                  : 'Stamp Digital Voucher (VCH-...) & Record Expense'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
