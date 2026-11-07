'use client';

import React, { useState } from 'react';
import { X, SendHorizontal, Building, CheckCircle2, AlertCircle } from 'lucide-react';
import { EstateStore } from '@/lib/store';
import { formatNaira } from '@/lib/utils';

interface RecordRemittanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPropertyId?: string;
  onSaved?: () => void;
}

export function RecordRemittanceModal({
  isOpen,
  onClose,
  defaultPropertyId,
  onSaved,
}: RecordRemittanceModalProps) {
  const properties = EstateStore.getProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState(
    defaultPropertyId || properties[0]?.id || ''
  );

  const currentProperty = properties.find((p) => p.id === selectedPropertyId);
  const landlord = currentProperty?.landlord;

  // Balances
  const balances = EstateStore.getPropertyBalances(selectedPropertyId)[0] || {
    landlord_net_balance: 0,
    service_charge_balance: 0,
    total_lawyer_fee_retained: 0,
  };

  const [amount, setAmount] = useState<number>(() =>
    Math.max(0, balances.landlord_net_balance)
  );
  const [referenceNote, setReferenceNote] = useState(
    'Interbank NIP Transfer from Chambers Client Trust Account'
  );

  if (!isOpen) return null;

  const isExceeding = amount > balances.landlord_net_balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || amount <= 0) {
      alert('Please enter a valid remittance amount.');
      return;
    }

    if (isExceeding) {
      const confirmOverdraw = confirm(
        `Warning: Remittance amount (${formatNaira(
          amount
        )}) exceeds available Landlord Net Pool (${formatNaira(
          balances.landlord_net_balance
        )}). Do you want to proceed?`
      );
      if (!confirmOverdraw) return;
    }

    await EstateStore.recordRemittance({
      property_id: selectedPropertyId,
      amount,
      reference_note: referenceNote,
      bank_name: landlord?.bank_name || 'Bank',
      account_number: landlord?.account_number || '',
    });

    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
              <SendHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Record Landlord Remittance
              </h3>
              <p className="text-xs text-emerald-300">
                Disburse verified net rent into Landlord&apos;s bank account
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Property Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Estate / Property
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => {
                setSelectedPropertyId(e.target.value);
                const newBal = EstateStore.getPropertyBalances(e.target.value)[0]?.landlord_net_balance || 0;
                setAmount(Math.max(0, newBal));
              }}
              suppressHydrationWarning
              className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
            >
              <option value="" disabled suppressHydrationWarning>
                {properties.length === 0 ? 'No properties registered' : 'Select Managed Property'}
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id} suppressHydrationWarning>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Landlord Verified Account Card */}
          <div className="bg-emerald-950 text-emerald-100 p-4 rounded-xl border border-emerald-800 text-xs space-y-2">
            <div className="flex justify-between items-center text-amber-300 font-bold border-b border-emerald-800 pb-1.5">
              <span>Landlord Disbursement Profile</span>
              <span className="text-[11px] bg-emerald-800 px-2 py-0.5 rounded text-white">Verified</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-300">Owner Name:</span>
              <span className="font-bold text-white">{landlord?.name || 'Chief Landlord'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-300">Bank Name:</span>
              <span className="font-semibold">{landlord?.bank_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-300">Account Number:</span>
              <span className="font-mono font-bold text-amber-300">{landlord?.account_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-300">Account Name:</span>
              <span className="font-semibold">{landlord?.account_name}</span>
            </div>
            <div className="pt-2 border-t border-emerald-800/80 flex justify-between items-center">
              <span className="text-emerald-200 font-medium">Available Net Rent Balance:</span>
              <span className="font-extrabold text-sm text-emerald-400">
                {formatNaira(balances.landlord_net_balance)}
              </span>
            </div>
          </div>

          {/* Amount to Remit */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Remittance Amount (₦)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full text-base font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-emerald-800 dark:text-emerald-400"
            />
          </div>

          {/* Reference / Bank Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transfer Reference / NIP Session
            </label>
            <input
              type="text"
              required
              value={referenceNote}
              onChange={(e) => setReferenceNote(e.target.value)}
              className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl shadow-md transition text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              <SendHorizontal className="w-4 h-4 text-amber-300" />
              <span>Record Owner Remittance</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
