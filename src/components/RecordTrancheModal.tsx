'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  CreditCard,
  Calendar,
  Mail,
  CheckCircle2,
  Loader2,
  Download,
  Send,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Invoice, SolicitorFeeNote, TranchePayment } from '@/types/database';
import { EstateStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';
import { CameraCapture } from './CameraCapture';

interface RecordTrancheModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: Invoice | null;
  feeNote?: SolicitorFeeNote | null;
  onSuccess?: () => void;
}

export function RecordTrancheModal({
  isOpen,
  onClose,
  invoice,
  feeNote,
  onSuccess,
}: RecordTrancheModalProps) {
  const isFeeNote = Boolean(feeNote);
  const totalBilled = isFeeNote
    ? Number(feeNote?.agreed_fee) || 0
    : Number(invoice?.total_amount_payable) || 0;
  const alreadyPaid = isFeeNote
    ? Number(feeNote?.amount_paid) || 0
    : Number(invoice?.amount_paid) || 0;
  const currentBalance = Math.max(0, totalBilled - alreadyPaid);

  const [trancheAmount, setTrancheAmount] = useState<number>(currentBalance);
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [promiseToPayDate, setPromiseToPayDate] = useState<string>('');
  const [bankReference, setBankReference] = useState<string>('');
  const [payerEmail, setPayerEmail] = useState<string>('');
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [sendZohoEmail, setSendZohoEmail] = useState<boolean>(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedTranche, setCompletedTranche] = useState<TranchePayment | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const nextMonth = new Date();
      nextMonth.setDate(nextMonth.getDate() + 30);

      setTrancheAmount(currentBalance);
      setPaymentDate(todayIso);
      setPromiseToPayDate(nextMonth.toISOString().slice(0, 10));
      setBankReference(invoice?.bank_session_id || '');
      setPayerEmail(
        isFeeNote
          ? feeNote?.client_email || ''
          : invoice?.unit?.tenant_email || ''
      );
      setProofUrl(invoice?.proof_image_url || null);
      setCompletedTranche(null);
      setEmailStatus(null);
    }
  }, [isOpen, invoice, feeNote, currentBalance, isFeeNote]);

  if (!isOpen || (!invoice && !feeNote)) return null;

  const projectedBalance = Math.max(0, currentBalance - Number(trancheAmount || 0));
  const willBePartial = projectedBalance > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trancheAmount <= 0 || trancheAmount > currentBalance) {
      alert(`Please enter a valid tranche amount between ₦1 and ${formatNaira(currentBalance)}.`);
      return;
    }

    setIsSubmitting(true);
    try {
      let createdTranche: TranchePayment;
      let itemDescription = '';

      if (isFeeNote && feeNote) {
        const res = await EstateStore.recordFeeNoteTranchePayment({
          fee_note_id: feeNote.id,
          amount: trancheAmount,
          payment_date: paymentDate,
          bank_reference: bankReference || 'Chambers Bank Transfer',
          promise_to_pay_date: willBePartial ? promiseToPayDate : null,
          proof_url: proofUrl,
        });
        createdTranche = res.tranche;
        itemDescription = `${feeNote.matter_title} (${feeNote.fee_note_number})`;
      } else if (invoice) {
        const res = await EstateStore.recordInvoiceTranchePayment({
          invoice_id: invoice.id,
          amount: trancheAmount,
          payment_date: paymentDate,
          bank_reference: bankReference || 'Tenant Bank Transfer',
          promise_to_pay_date: willBePartial ? promiseToPayDate : null,
          proof_url: proofUrl,
        });
        createdTranche = res.tranche;
        itemDescription = `${invoice.unit?.unit_name || 'Unit'} — ${invoice.property?.title || 'Managed Estate'}`;
      } else {
        throw new Error('No target invoice or fee note provided.');
      }

      // Dispatch Zoho SMTP Receipt Email if email provided
      if (sendZohoEmail && payerEmail && payerEmail.includes('@')) {
        try {
          const profile = EstateStore.getChamberProfile();
          const resp = await fetch('/api/receipts/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: payerEmail.trim(),
              payerName: createdTranche.payer_name,
              receiptNumber: createdTranche.receipt_number,
              paymentScope: createdTranche.payment_scope,
              itemDescription,
              totalBilled,
              trancheAmountPaid: createdTranche.amount,
              cumulativeAmountPaid: createdTranche.cumulative_paid,
              balanceRemaining: createdTranche.balance_remaining,
              paymentDate: createdTranche.payment_date,
              promiseToPayDate: createdTranche.promise_to_pay_date,
              bankReference: createdTranche.bank_reference,
              recordedByName: createdTranche.created_by_name,
              firmName: profile.firm_name,
              solicitorName: profile.solicitor_name,
            }),
          });
          const json = await resp.json();
          if (json.skipped) {
            setEmailStatus('Receipt logged. (Zoho SMTP env credentials not set; skipped email dispatch)');
          } else {
            setEmailStatus(`Official Receipt ${createdTranche.receipt_number} emailed to ${payerEmail} via Zoho Mail!`);
          }
        } catch {
          setEmailStatus('Receipt logged locally. Could not reach email server.');
        }
      }

      try {
        confetti({
          particleCount: 80,
          spread: 65,
          origin: { y: 0.6 },
        });
      } catch {}

      setCompletedTranche(createdTranche);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err?.message || 'Could not record tranche payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadTrancheReceiptPdf = async () => {
    if (!completedTranche) return;
    setIsDownloadingPdf(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { RentReceiptDocument } = await import('@/components/RentReceiptPDF');
      const profile = EstateStore.getChamberProfile();

      const targetInvoice: Invoice =
        invoice ||
        ({
          id: feeNote?.id || completedTranche.id,
          access_token: '',
          property_id: '',
          unit_id: '',
          tenant_name: completedTranche.payer_name,
          rent_due: totalBilled,
          service_charge_due: 0,
          caution_due: 0,
          total_amount_payable: totalBilled,
          amount_paid: completedTranche.cumulative_paid,
          balance_due: completedTranche.balance_remaining,
          promise_to_pay_date: completedTranche.promise_to_pay_date,
          due_date: completedTranche.payment_date,
          period_start: completedTranche.payment_date,
          period_end: completedTranche.payment_date,
          status: completedTranche.balance_remaining <= 0 ? 'PAID' : 'PARTIALLY_PAID',
          proof_image_url: null,
          bank_session_id: completedTranche.bank_reference,
          verified_at: completedTranche.created_at,
          created_at: completedTranche.created_at,
        } as Invoice);

      const blob = await pdf(
        <RentReceiptDocument
          invoice={targetInvoice}
          tranche={completedTranche}
          profile={profile}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${completedTranche.receipt_number}_${completedTranche.payer_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error generating tranche PDF:', e);
      alert('Failed to download PDF receipt.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                {isFeeNote ? 'Record Fee Note Deposit / Tranche' : 'Record Part-Payment / Tranche Receipt'}
              </h3>
              <p className="text-xs text-emerald-300">
                Issues individual tranche receipt (RCT-...) &amp; dispatches via Zoho SMTP
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

        {completedTranche ? (
          <div className="p-6 text-center space-y-4 text-xs">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                {completedTranche.receipt_number}
              </span>
              <h4 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-2">
                Tranche Payment Recorded!
              </h4>
              <p className="text-slate-500 mt-1">
                Received <strong>{formatNaira(completedTranche.amount)}</strong> from{' '}
                <strong>{completedTranche.payer_name}</strong>.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-bold">{formatNaira(totalBilled)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>This Tranche Receipt ({completedTranche.receipt_number}):</span>
                <span className="font-black">{formatNaira(completedTranche.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cumulative Paid to Date:</span>
                <span className="font-bold">{formatNaira(completedTranche.cumulative_paid)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 font-bold text-amber-600">
                <span>Remaining Balance Due:</span>
                <span>{formatNaira(completedTranche.balance_remaining)}</span>
              </div>
              {completedTranche.promise_to_pay_date && (
                <div className="flex justify-between text-slate-500">
                  <span>Promise-to-Pay Next Date:</span>
                  <span className="font-bold">{formatDate(completedTranche.promise_to_pay_date)}</span>
                </div>
              )}
            </div>

            {emailStatus && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-medium">
                {emailStatus}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleDownloadTrancheReceiptPdf}
                disabled={isDownloadingPdf}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold shadow transition"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-amber-300" />
                )}
                <span>Download {completedTranche.receipt_number} PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
            {/* Summary Card */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Client / Tenant:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {isFeeNote ? feeNote?.client_name : invoice?.tenant_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-bold">{formatNaira(totalBilled)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already Paid:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {formatNaira(alreadyPaid)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700 font-extrabold text-amber-600">
                <span>Current Balance Due:</span>
                <span>{formatNaira(currentBalance)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tranche Amount Received (₦) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={currentBalance}
                  value={trancheAmount}
                  onChange={(e) => setTrancheAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm font-black text-emerald-700 dark:text-emerald-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-sm"
                />
              </div>
            </div>

            {/* Projected Balance & Promise-to-Pay Date */}
            <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3.5 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 dark:text-amber-200">
                  Remaining Balance After This Tranche:
                </span>
                <span className="font-black text-sm text-amber-700 dark:text-amber-300">
                  {formatNaira(projectedBalance)}
                </span>
              </div>

              {willBePartial && (
                <div>
                  <label className="block font-semibold text-amber-900 dark:text-amber-300 mb-1">
                    Promise-to-Pay Date for Balance ({formatNaira(projectedBalance)}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required={willBePartial}
                    value={promiseToPayDate}
                    onChange={(e) => setPromiseToPayDate(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 p-2 text-xs font-semibold"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Transfer / NIP Session Reference
                </label>
                <input
                  type="text"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  placeholder="e.g. ZENITH-NIP-882910"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Email (Zoho SMTP Receipt)
                </label>
                <input
                  type="email"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="client@email.com"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5"
                />
              </div>
            </div>

            <CameraCapture
              onCapture={(img) => setProofUrl(img)}
              initialImage={proofUrl}
              label="Optional Bank Teller / Transfer Screenshot"
              helperText="Attach transfer confirmation if available"
            />

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendZohoEmail}
                onChange={(e) => setSendZohoEmail(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 w-4 h-4"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Automatically email official tranche receipt (RCT-...) via Zoho SMTP
              </span>
            </label>

            <div className="pt-2 flex justify-end gap-2.5">
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
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold shadow-md transition disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Issuing Receipt...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-amber-300" />
                    <span>Issue Tranche Receipt (RCT-...)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
