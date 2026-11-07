'use client';

import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Eye,
  Building,
  Calendar,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Invoice } from '@/types/database';
import { EstateStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';

interface VerifyInvoiceModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onVerified?: () => void;
}

export function VerifyInvoiceModal({
  invoice,
  isOpen,
  onClose,
  onVerified,
}: VerifyInvoiceModalProps) {
  const [verifying, setVerifying] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [verifierName, setVerifierName] = useState('Barr. T. A. Babatunde (Principal Solicitor)');

  if (!isOpen || !invoice) return null;

  const rentDue = Number(invoice.rent_due);
  const serviceChargeDue = Number(invoice.service_charge_due || 0);
  const cautionDue = Number(invoice.caution_due || 0);
  const feeRate = typeof invoice.management_fee_rate === 'number'
    ? invoice.management_fee_rate
    : typeof invoice.property?.landlord?.default_mgt_rate === 'number'
    ? invoice.property.landlord.default_mgt_rate
    : 10.0;
  const mgtFee = rentDue * (feeRate / 100);
  const landlordNet = rentDue - mgtFee;

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await EstateStore.verifyTenantInvoice(invoice.id, verifierName);

      // Trigger celebratory confetti for successfully verified legal payment
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#047857', '#d97706', '#10b981', '#f59e0b'],
        });
      } catch (e) {
        // confetti fallback
      }

      setTimeout(() => {
        setVerifying(false);
        if (onVerified) onVerified();
        onClose();
      }, 500);
    } catch (err: any) {
      alert(err?.message || 'Verification failed. Please try again.');
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Proof of Payment Verification & Accounting Split
              </h3>
              <p className="text-xs text-emerald-300">
                Execute automated 10% legal fee deduction & multi-pool fund separation
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

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Tenant & Property Overview */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium">Tenant Name</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {invoice.tenant_name}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium">Unit & Property</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {invoice.unit?.unit_name || 'Unit'} • {invoice.property?.title || 'Estate'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium">Lease Tenancy Cycle</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formatDate(invoice.period_start)} → {formatDate(invoice.period_end)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block font-medium">Total Invoiced Amount</span>
              <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                {formatNaira(invoice.total_amount_payable)}
              </span>
            </div>
          </div>

          {/* Proof of Payment View */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                Submitted Bank Transfer Evidence
              </span>
              {invoice.bank_session_id && (
                <span className="text-[11px] font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                  Ref: {invoice.bank_session_id}
                </span>
              )}
            </div>

            {invoice.proof_image_url ? (
              <div className="relative border-2 border-emerald-500/80 rounded-xl overflow-hidden bg-slate-900 group max-h-56">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={invoice.proof_image_url}
                  alt="Proof of payment"
                  className="w-full h-56 object-cover object-center group-hover:scale-[1.02] transition duration-300 cursor-pointer"
                  onClick={() => setShowFullImage(true)}
                />
                <button
                  type="button"
                  onClick={() => setShowFullImage(true)}
                  className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm flex items-center gap-1.5 transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Full Receipt</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  No physical receipt image attached. Tenant verified via direct bank statement credit (Session Ref:{' '}
                  {invoice.bank_session_id || 'Direct Verification'}).
                </span>
              </div>
            )}
          </div>

          {/* RPC Accounting Split Breakdown */}
          <div className="border border-emerald-800/40 rounded-xl bg-emerald-950 text-white p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-800/80 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Automated Domain Ledger Execution
              </span>
              <span className="text-[11px] text-emerald-300">Agreed {feeRate}% Legal Fee</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-emerald-200">1. Gross Rent Inflow (Landlord Pool):</span>
                <span className="font-bold text-white">+{formatNaira(rentDue)}</span>
              </div>

              <div className="flex items-center justify-between text-amber-300 font-semibold bg-emerald-900/60 p-2 rounded-lg border border-emerald-800">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>2. Lawyer {feeRate}% Management Fee:</span>
                </div>
                <span className="font-mono text-sm">+{formatNaira(mgtFee)}</span>
              </div>

              <div className="flex items-center justify-between text-emerald-200">
                <span>3. Net Inflow to Landlord Rent Pool:</span>
                <span className="font-bold text-emerald-300">{formatNaira(landlordNet)}</span>
              </div>

              {serviceChargeDue > 0 && (
                <div className="flex items-center justify-between text-emerald-200">
                  <span>4. Estate Service Charge (Reserve Pool):</span>
                  <span className="font-bold text-sky-300">+{formatNaira(serviceChargeDue)}</span>
                </div>
              )}

              {cautionDue > 0 && (
                <div className="flex items-center justify-between text-emerald-200">
                  <span>5. Caution Deposit (Escrow Fund):</span>
                  <span className="font-bold text-violet-300">+{formatNaira(cautionDue)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-emerald-300 pt-1 border-t border-emerald-800/60 text-[11px]">
                <span>• Automatic Unit Lease Extension:</span>
                <span className="font-mono">
                  Extended to {formatDate(invoice.period_end)}
                </span>
              </div>
            </div>
          </div>

          {/* Verifier Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Legal Practitioner / Verified By
            </label>
            <input
              type="text"
              value={verifierName}
              onChange={(e) => setVerifierName(e.target.value)}
              className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={verifying}
              className="w-1/3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3 px-4 rounded-xl text-xs sm:text-sm transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying}
              className="w-2/3 bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              {verifying ? (
                <span>Executing Ledger Split...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span>Verify & Execute 10% Accounting Split</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Full Image Zoom Modal */}
      {showFullImage && invoice.proof_image_url && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={invoice.proof_image_url}
              alt="Payment proof zoom"
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute top-2 right-2 bg-black/80 hover:bg-black text-white p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
