'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Scale,
  FileSignature,
  CheckCircle2,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
  Building2,
  Calendar,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { EstateStore } from '@/lib/store';
import { Unit, ChamberProfile } from '@/types/database';
import { formatNaira, formatDate } from '@/lib/utils';
import { TenancyAgreementDocument } from '@/components/TenancyAgreementPDF';

export default function TenantESignaturePage() {
  const params = useParams();
  const token = String(params?.token || '');

  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [profile, setProfile] = useState<ChamberProfile>(EstateStore.getChamberProfile());

  // Signature Canvas State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadAgreement() {
      setLoading(true);
      try {
        const res = await EstateStore.fetchUnitForPublicPortal(token);
        if (!active) return;
        if (res) {
          setUnit(res.unit);
          setProfile(res.profile);
        }
      } catch (err: any) {
        if (active) setErrorMsg(err?.message || 'Could not load tenancy agreement.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (token) loadAgreement();
    return () => {
      active = false;
    };
  }, [token]);

  // Initialize Canvas resolution for crisp signature
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [loading, unit]);

  const getCanvasCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleAdoptAndSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) return;
    if (!hasDrawn) {
      alert('Please draw your signature inside the signature box before submitting.');
      return;
    }
    if (!agreedTerms) {
      alert('Please tick the box confirming that you have read and agreed to the Tenancy Agreement covenants.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const updatedUnit = await EstateStore.submitTenantESignature(token, dataUrl);
      if (updatedUnit) setUnit(updatedUnit);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save electronic signature.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!unit) return;
    setIsExportingPDF(true);
    try {
      const blob = await pdf(
        <TenancyAgreementDocument unit={unit} profile={profile} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tenancy_Agreement_${unit.unit_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || 'Could not generate Tenancy Agreement PDF.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
        <p className="text-sm font-semibold text-emerald-200">
          Loading Official Chambers Tenancy Agreement...
        </p>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h1 className="text-lg font-bold">Tenancy Agreement Link Not Found</h1>
          <p className="text-xs text-slate-400">
            This signing link (<code className="font-mono">{token}</code>) is invalid or has expired. Please contact {profile.firm_name} for an active link.
          </p>
        </div>
      </div>
    );
  }

  const annualRent = Number(unit.annual_rent || 0);
  const firstYearLegalFee = Math.round(annualRent * 0.1);
  const isAlreadySigned = Boolean(unit.tenant_signature_url);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-6 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Chambers Letterhead Banner */}
        <div className="bg-emerald-950 text-white rounded-2xl p-5 sm:p-6 border border-emerald-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-emerald-950 flex items-center justify-center font-black shadow-md shrink-0">
                <Scale className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                  Hybrid E-Signature &amp; Wet-Ink Tenancy Execution Portal
                </span>
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
                  {profile.firm_name}
                </h1>
                <p className="text-xs text-emerald-300">
                  {profile.solicitor_name} • Enrolment #{profile.enrollment_no}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isExportingPDF}
              onClick={handleDownloadPDF}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-emerald-950 font-extrabold text-xs shadow-md transition shrink-0"
            >
              {isExportingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Agreement PDF</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-emerald-900/50 border border-emerald-800 rounded-xl p-3">
              <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">
                Demised Premises
              </span>
              <div className="font-bold text-white text-sm mt-0.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{unit.unit_name}</span>
              </div>
              <p className="text-[11px] text-emerald-200 mt-0.5">
                {unit.property?.title}
              </p>
            </div>

            <div className="bg-emerald-900/50 border border-emerald-800 rounded-xl p-3">
              <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">
                Tenant In Occupation
              </span>
              <div className="font-bold text-white text-sm mt-0.5">
                {unit.current_tenant_name || 'Prospective Tenant'}
              </div>
              <p className="text-[11px] text-emerald-200 mt-0.5">
                {unit.tenant_phone || '—'}
              </p>
            </div>

            <div className="bg-emerald-900/50 border border-emerald-800 rounded-xl p-3">
              <span className="text-[10px] uppercase tracking-wider text-emerald-300 block">
                Fixed Lease Term
              </span>
              <div className="font-bold text-amber-300 text-xs mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {formatDate(unit.lease_start_date)} → {formatDate(unit.lease_end_date)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-200 mt-1">
                Status: <strong>{unit.agreement_status || 'PENDING'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Full Readable Tenancy Agreement Document Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-5 sm:p-7 space-y-5 text-xs sm:text-sm leading-relaxed">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-slate-100 uppercase">
                Formal Tenancy Agreement Covenants
              </h2>
              <p className="text-xs text-slate-500">
                Please review all clauses carefully before signing electronically below
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {unit.property?.state || 'Lagos'} State Tenancy Law
            </span>
          </div>

          <div className="space-y-3 text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
            <p>
              <strong>THIS TENANCY AGREEMENT</strong> is made between{' '}
              <strong>{unit.property?.landlord?.name || 'THE REGISTERED LANDLORD'}</strong> of{' '}
              {unit.property?.address} (acting through his Legal Practitioners &amp; Chartered Property Managers,{' '}
              <strong>{profile.firm_name}</strong>, hereinafter called <strong>&quot;THE LANDLORD&quot;</strong>) of the first part, AND{' '}
              <strong>{unit.current_tenant_name || 'THE TENANT'}</strong> (NIN/ID:{' '}
              {unit.tenant_nin_or_id || 'Verified'}, Tel: {unit.tenant_phone || '—'}, hereinafter called{' '}
              <strong>&quot;THE TENANT&quot;</strong>) of the second part.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">
                  Annual Rent
                </span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {formatNaira(annualRent)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">
                  10% Legal Fee (Yr 1)
                </span>
                <span className="font-extrabold text-sm text-amber-700 dark:text-amber-400">
                  {formatNaira(firstYearLegalFee)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">
                  Service Charge
                </span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {formatNaira(unit.annual_service_charge)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-bold block">
                  Caution Deposit
                </span>
                <span className="font-extrabold text-sm text-emerald-700 dark:text-emerald-400">
                  {formatNaira(unit.caution_fee)}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                Key Statutory &amp; Express Covenants
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs">
                <li>
                  <strong>Demised Premises &amp; Term:</strong> The Landlord lets and the Tenant takes{' '}
                  <strong>{unit.unit_name}, {unit.property?.title}</strong> for a fixed term commencing on{' '}
                  <strong>{formatDate(unit.lease_start_date)}</strong> and expiring on{' '}
                  <strong>{formatDate(unit.lease_end_date)}</strong>.
                </li>
                <li>
                  <strong>Private Residential Use Only:</strong> The Tenant covenants to use the Demised Premises strictly for private residential living and shall not sublet, assign, or operate commercial short-lets without written consent from the Landlord and {profile.firm_name}.
                </li>
                <li>
                  <strong>Maintenance &amp; Caution Deposit:</strong> The Tenant shall maintain the interior fixtures, plumbing, and electrical fittings in good and tenantable repair. Any verified dilapidation upon vacating shall be deducted from the Refundable Caution Deposit ({formatNaira(unit.caution_fee)}).
                </li>
                {unit.guarantor_name && (
                  <li>
                    <strong>Guarantor Undertaking:</strong> Guaranteed by{' '}
                    <strong>{unit.guarantor_name}</strong> ({unit.guarantor_phone}, {unit.guarantor_address}).
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* E-Signature Section */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            {isAlreadySigned ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-200">
                        Tenant Electronic Signature Recorded
                      </h3>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        Signed electronically by <strong>{unit.current_tenant_name}</strong> on{' '}
                        {unit.tenant_signed_at ? formatDate(unit.tenant_signed_at.slice(0, 10)) : 'file'}.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isExportingPDF}
                    onClick={handleDownloadPDF}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow transition"
                  >
                    <Download className="w-4 h-4 text-amber-300" />
                    <span>Download E-Signed PDF Copy</span>
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Embedded Electronic Signature
                    </span>
                    <img
                      src={unit.tenant_signature_url!}
                      alt="Tenant E-Signature"
                      className="h-16 w-auto object-contain bg-white p-1.5 rounded border border-slate-200"
                    />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 max-w-sm">
                    <strong>Next Step (Hybrid Execution):</strong> {profile.firm_name} will print two hard copies of this Agreement with your embedded e-signature for the Landlord&apos;s physical wet-ink signature and upload the final executed scan.
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdoptAndSign} className="space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <FileSignature className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>Sign Inside the Box Below (Finger, Stylus, or Mouse)</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Your signature will be embedded directly into the Tenancy Agreement PDF
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={clearSignature}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Pad</span>
                  </button>
                </div>

                <div className="border-2 border-dashed border-emerald-700/60 dark:border-emerald-600/60 rounded-2xl bg-white p-2 shadow-inner">
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={200}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-44 bg-white rounded-xl cursor-crosshair touch-none"
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/70 text-xs">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-emerald-400 text-emerald-700 focus:ring-emerald-600 w-4 h-4"
                  />
                  <span className="text-slate-700 dark:text-slate-300">
                    I, <strong>{unit.current_tenant_name || 'the Tenant'}</strong>, confirm that I have read this Tenancy Agreement and consent to execute it electronically pursuant to Section 93 of the Nigerian Evidence Act 2011.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Embedding Signature &amp; Executing Agreement...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 text-amber-300" />
                      <span>Adopt E-Signature &amp; Execute Tenancy Agreement</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
