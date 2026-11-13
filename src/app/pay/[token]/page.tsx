'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Scale,
  Receipt,
  Copy,
  Check,
  Building,
  CreditCard,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  RefreshCw,
  Download,
  Loader2,
} from 'lucide-react';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';
import { CameraCapture } from '@/components/CameraCapture';
import { Invoice, ChamberProfile } from '@/types/database';
import { INITIAL_CHAMBER_PROFILE } from '@/lib/initialData';
import { supabase } from '@/lib/supabase';

export default function TenantPaymentPortalPage({
  params: _params,
}: {
  params?: Promise<{ token: string }>;
}) {
  const routeParams = useParams();
  const token = (routeParams?.token as string) || '';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [profile, setProfile] = useState<ChamberProfile>(INITIAL_CHAMBER_PROFILE);
  const [loading, setLoading] = useState(true);
  const [proofImage, setProofImage] = useState<string>('');
  const [bankSessionId, setBankSessionId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  useEffect(() => {
    if (profile?.firm_name) {
      document.title = `${profile.firm_name} | Tenancy Payment Portal`;
    }
  }, [profile?.firm_name]);

  const handleDownloadReceipt = async () => {
    if (!invoice) return;
    setIsDownloadingReceipt(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { RentReceiptDocument } = await import('@/components/RentReceiptPDF');

      const blob = await pdf(<RentReceiptDocument invoice={invoice} profile={profile} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Rent_Receipt_${invoice.tenant_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating receipt PDF:', err);
      alert('Could not generate receipt PDF.');
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setProfile(EstateStore.getChamberProfile());

    async function loadInvoice() {
      if (!token) return;
      setLoading(true);
      try {
        const inv = await EstateStore.fetchInvoiceByToken(token);
        if (!isMounted) return;
        setInvoice(inv || null);
        if (inv?.status === 'AWAITING_VERIFICATION' || inv?.status === 'PAID') {
          setSubmitted(true);
        }

        // Fetch the manager's profile linked to that invoice's manager_id
        const targetManagerId = inv?.manager_id || (inv?.property as any)?.manager_id;
        if (targetManagerId && supabase) {
          try {
            const { data: profData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', targetManagerId)
              .maybeSingle();

            if (profData && isMounted) {
              setProfile((prev) => ({
                ...prev,
                ...profData,
              }));
            }
          } catch (profErr) {
            console.warn('Could not load manager profile for invoice:', profErr);
          }
        }
      } catch (err) {
        console.error('Error loading invoice in portal:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInvoice();

    // Re-check if store updates
    const unsub = subscribeToStore(() => {
      if (isMounted) {
        setProfile(EstateStore.getChamberProfile());
        if (token) {
          const updated = EstateStore.getInvoiceByToken(token);
          if (updated) setInvoice(updated);
        }
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [token]);

  const handleCopyAccount = (accountNo: string) => {
    navigator.clipboard.writeText(accountNo);
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (!proofImage && !bankSessionId) {
      alert('Please either snap your transfer receipt or enter your Bank Session ID / NIP Reference.');
      return;
    }

    setIsSubmitting(true);
    try {
      await EstateStore.submitProofOfPayment(
        invoice.id,
        proofImage || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
        bankSessionId || 'NIP-DIRECT-VERIFY'
      );
      setSubmitted(true);
      const updated = EstateStore.getInvoiceByToken(token);
      setInvoice(updated || null);
    } catch (err: any) {
      alert(err?.message || 'Error submitting proof');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-sm font-semibold animate-pulse">
          Loading Tenant Demand Portal...
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 text-white rounded-2xl p-6 max-w-md text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold">Demand Notice Not Found</h2>
          <p className="text-xs text-slate-400">
            The payment link may have expired or is invalid. Please contact your property manager or legal solicitor.
          </p>
        </div>
      </div>
    );
  }

  const landlord = invoice.property?.landlord;
  const isPaid = invoice.status === 'PAID';
  const isPending = invoice.status === 'AWAITING_VERIFICATION';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-6 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden space-y-0">
        {/* Chambers Legal Header */}
        <div className="bg-emerald-950 border-b border-emerald-800 p-6 text-center space-y-2">
          {profile.letterhead_logo_url ? (
            <div className="flex justify-center mb-1">
              <img
                src={profile.letterhead_logo_url}
                alt={profile.firm_name || 'Chamber Logo'}
                className="h-12 w-auto object-contain max-w-[200px]"
              />
            </div>
          ) : null}
          <div className="inline-flex items-center justify-center gap-2">
            {!profile.letterhead_logo_url && (
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
                <Scale className="w-5 h-5" />
              </div>
            )}
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
              {profile.firm_name || 'LEGAL PROPERTY MANAGERS'}
            </h1>
          </div>
          <p className="text-[11px] text-amber-300 font-bold tracking-wide uppercase">
            Legal Practitioners &amp; Property Solicitors of the Supreme Court of Nigeria
          </p>
          <div className="inline-block bg-emerald-900/80 text-emerald-200 text-[10px] font-semibold px-3 py-1 rounded-full border border-emerald-700">
            Official Tenancy Rent Demand Notice
          </div>
        </div>

        {/* Status Callout */}
        {isPaid ? (
          <div className="bg-emerald-950 border-b border-emerald-800 p-4 text-center text-emerald-200 text-xs font-semibold flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>This rent demand has been verified and marked as PAID. Lease extended.</span>
            </div>
            <button
              onClick={handleDownloadReceipt}
              disabled={isDownloadingReceipt}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 font-extrabold text-xs shadow transition active:scale-95 shrink-0"
            >
              {isDownloadingReceipt ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Rent Receipt</span>
                </>
              )}
            </button>
          </div>
        ) : isPending ? (
          <div className="bg-amber-950/70 border-b border-amber-800/80 p-4 text-center text-amber-200 text-xs font-semibold flex items-center justify-center gap-2">
            <Clock className="w-5 h-5 text-amber-400 animate-spin" />
            <span>Proof of payment received! Chambers is verifying transfer with bank records.</span>
          </div>
        ) : null}

        {/* Invoice Summary */}
        <div className="p-6 space-y-5">
          {/* Greeting */}
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium">Tenant / Demanded Party:</span>
            <h2 className="text-xl font-black text-white">{invoice.tenant_name}</h2>
            <p className="text-xs text-slate-400">
              {invoice.unit?.unit_name} • {invoice.property?.title} ({invoice.property?.address})
            </p>
          </div>

          {/* Breakdown Box */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
              <span>Lease Tenancy Cycle:</span>
              <span className="font-semibold text-slate-200">
                {formatDate(invoice.period_start)} → {formatDate(invoice.period_end)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>Annual Rent Due:</span>
              <span className="font-bold">{formatNaira(invoice.rent_due)}</span>
            </div>
            {(invoice.legal_fee_due || 0) > 0 && (
              <div className="flex justify-between items-center text-amber-400">
                <span>10% First-Year Legal Agreement Fee:</span>
                <span className="font-bold">+{formatNaira(invoice.legal_fee_due || 0)}</span>
              </div>
            )}
            {invoice.service_charge_due > 0 && (
              <div className="flex justify-between items-center text-sky-400">
                <span>Estate Service Charge:</span>
                <span className="font-bold">+{formatNaira(invoice.service_charge_due)}</span>
              </div>
            )}
            {invoice.caution_due > 0 && (
              <div className="flex justify-between items-center text-violet-400">
                <span>Refundable Caution Escrow:</span>
                <span className="font-bold">+{formatNaira(invoice.caution_due)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-emerald-400 font-black text-sm sm:text-base">
              <span>TOTAL AMOUNT DEMANDED:</span>
              <span className="font-mono">{formatNaira(invoice.total_amount_payable)}</span>
            </div>
            {(invoice.amount_paid || 0) > 0 && (
              <>
                <div className="flex justify-between items-center text-emerald-300">
                  <span>Amount Paid to Date:</span>
                  <span className="font-bold">-{formatNaira(invoice.amount_paid || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-300 font-extrabold">
                  <span>OUTSTANDING BALANCE DUE:</span>
                  <span className="font-mono">
                    {formatNaira(
                      typeof invoice.balance_due === 'number'
                        ? invoice.balance_due
                        : Math.max(0, invoice.total_amount_payable - (invoice.amount_paid || 0))
                    )}
                  </span>
                </div>
              </>
            )}
            <div className="text-[11px] text-amber-400 text-right">
              Due Date: {formatDate(invoice.due_date)}
            </div>
          </div>

          {/* Bank Payment Instructions */}
          {!isPaid && (() => {
            const displayBankName = profile.bank_name || landlord?.bank_name || 'Zenith Bank PLC';
            const displayAccountName = profile.account_name || landlord?.account_name || profile.firm_name || 'Legal Client Trust Account';
            const displayAccountNo = profile.account_number || landlord?.account_number || '1012345678';

            return (
              <div className="bg-emerald-950/70 border border-emerald-800 p-4 rounded-2xl space-y-2 text-xs">
                <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400 block">
                  Official Designated Bank Account to Pay Into:
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Bank Name</span>
                    <span className="font-bold text-white text-sm">
                      {displayBankName}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">Account Name</span>
                    <span className="font-semibold text-emerald-200 text-xs">
                      {displayAccountName}
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-900/60 p-2.5 rounded-xl border border-emerald-700/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-300 uppercase block font-semibold">
                      Account Number
                    </span>
                    <span className="font-mono font-black text-lg text-amber-300 tracking-wider">
                      {displayAccountNo}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyAccount(displayAccountNo)}
                    className="inline-flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition"
                  >
                    {copiedAcc ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Proof of Payment Submission (With Native Camera Support) */}
          {!isPaid && !isPending && (
            <form onSubmit={handleSubmitProof} className="space-y-4 pt-2">
              <div className="border-t border-slate-800 pt-4">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Submit Proof of Bank Transfer</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Snap your physical bank teller, debit receipt, or upload transfer screenshot.
                </p>
              </div>

              {/* Native Camera Capture Component */}
              <CameraCapture
                onCapture={(img) => setProofImage(img)}
                initialImage={proofImage}
                label="Take Photo of Transfer Receipt (Native Camera Support)"
                helperText="Tap Snap to trigger your device camera, or select from your photo gallery."
              />

              {/* NIP Session ID Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Bank Transfer Reference / NIP Session ID
                </label>
                <input
                  type="text"
                  value={bankSessionId}
                  onChange={(e) => setBankSessionId(e.target.value)}
                  placeholder="e.g. 0000132408011234567890 or ZENITH-NIP-9988"
                  className="w-full text-xs sm:text-sm bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-amber-300" />
                <span>
                  {isSubmitting ? 'Uploading Evidence...' : 'Submit Payment Proof for Verification'}
                </span>
              </button>
            </form>
          )}

          {/* Confirmation Message */}
          {submitted && (
            <div className="bg-emerald-950/90 border border-emerald-700 p-5 rounded-2xl text-center space-y-2">
              <div className="w-10 h-10 bg-emerald-800 text-emerald-200 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="font-bold text-white text-base">Payment Proof Submitted</h4>
              <p className="text-xs text-emerald-200">
                Your payment reference has been recorded to the chambers ledger. You will receive an official legal rent receipt once the bank credit is verified.
              </p>
            </div>
          )}

          {/* Footer Legal Note */}
          <div className="pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 space-y-1">
            <p>Issued pursuant to the Tenancy Law of Lagos State.</p>
            <p>Solicitors: Barr. T. A. Babatunde &amp; Associates, Lekki Phase 1, Lagos.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
