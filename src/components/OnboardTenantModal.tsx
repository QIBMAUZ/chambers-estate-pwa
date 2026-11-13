'use client';

import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  X,
  ShieldCheck,
  Phone,
  Mail,
  Briefcase,
  CreditCard,
  Users,
  Calendar,
  Calculator,
  CheckCircle2,
  Loader2,
  MapPin,
  Camera,
} from 'lucide-react';
import { Unit, TenancyApplication } from '@/types/database';
import { EstateStore } from '@/lib/store';
import { formatNaira } from '@/lib/utils';
import { CameraCapture } from '@/components/CameraCapture';
import { uploadReceiptToStorage } from '@/lib/supabase';

interface OnboardTenantModalProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onOnboarded?: () => void;
  prefilledApplication?: TenancyApplication | null;
}

export function OnboardTenantModal({
  unit,
  isOpen,
  onClose,
  onOnboarded,
  prefilledApplication,
}: OnboardTenantModalProps) {
  // Tenant KYC
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantNinOrId, setTenantNinOrId] = useState('');
  const [tenantOccupation, setTenantOccupation] = useState('');
  const [tenantEmployer, setTenantEmployer] = useState('');
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string | null>(null);
  const [validIdUrl, setValidIdUrl] = useState<string | null>(null);

  // Guarantor KYC
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [guarantorOccupation, setGuarantorOccupation] = useState('');
  const [guarantorAddress, setGuarantorAddress] = useState('');

  // Financial & Lease Dates
  const [annualRent, setAnnualRent] = useState<number>(3500000);
  const [serviceCharge, setServiceCharge] = useState<number>(250000);
  const [cautionFee, setCautionFee] = useState<number>(200000);
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [raiseMoveInInvoice, setRaiseMoveInInvoice] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (unit && isOpen) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const nextYearIso = nextYear.toISOString().slice(0, 10);

      if (prefilledApplication) {
        setTenantName(prefilledApplication.applicant_name || '');
        setTenantPhone(prefilledApplication.applicant_phone || '');
        setTenantEmail(prefilledApplication.applicant_email || '');
        setTenantNinOrId(prefilledApplication.nin_or_id_number || 'Verified via Uploaded ID');
        setTenantOccupation(prefilledApplication.occupation || '');
        setTenantEmployer(prefilledApplication.employer || '');
        setPassportPhotoUrl(prefilledApplication.passport_photo_url || null);
        setValidIdUrl(prefilledApplication.valid_id_url || null);
        setGuarantorName(prefilledApplication.guarantor_name || '');
        setGuarantorPhone(prefilledApplication.guarantor_phone || '');
        setGuarantorOccupation(prefilledApplication.guarantor_occupation || '');
        setGuarantorAddress(prefilledApplication.guarantor_address || '');
      } else {
        setTenantName('');
        setTenantPhone('');
        setTenantEmail('');
        setTenantNinOrId('');
        setTenantOccupation('');
        setTenantEmployer('');
        setPassportPhotoUrl(null);
        setValidIdUrl(null);
        setGuarantorName('');
        setGuarantorPhone('');
        setGuarantorOccupation('');
        setGuarantorAddress('');
      }

      setAnnualRent(Number(unit.annual_rent) || 3500000);
      setServiceCharge(Number(unit.annual_service_charge) || 200000);
      setCautionFee(Number(unit.caution_fee) || 200000);
      setLeaseStartDate(todayIso);
      setLeaseEndDate(nextYearIso);
      setRaiseMoveInInvoice(true);
    }
  }, [unit, isOpen, prefilledApplication]);

  if (!isOpen || !unit) return null;

  // Requirement 5: FIRST_YEAR tenancy automatically bills 10% Legal/Agreement Fee to tenant (100% to Law Firm)
  // and 0% Landlord Management Fee
  const firstYearLegalFee = Math.round(Number(annualRent || 0) * 0.1);
  const totalMoveInPayable =
    Number(annualRent || 0) +
    firstYearLegalFee +
    Number(serviceCharge || 0) +
    Number(cautionFee || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim() || !tenantPhone.trim() || !guarantorName.trim()) {
      alert('Please enter Tenant Full Name, Phone Number, and Guarantor Details.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalPassportUrl = passportPhotoUrl;
      let finalIdUrl = validIdUrl;

      if (passportPhotoUrl && passportPhotoUrl.startsWith('data:')) {
        const uploaded = await uploadReceiptToStorage(passportPhotoUrl, 'kyc-documents/passports');
        if (uploaded) finalPassportUrl = uploaded;
      }

      if (validIdUrl && validIdUrl.startsWith('data:')) {
        const uploaded = await uploadReceiptToStorage(validIdUrl, 'kyc-documents/ids');
        if (uploaded) finalIdUrl = uploaded;
      }

      await EstateStore.onboardNewTenant({
        unit_id: unit.id,
        tenant_name: tenantName,
        tenant_phone: tenantPhone,
        tenant_email: tenantEmail,
        tenant_nin_or_id: tenantNinOrId,
        tenant_occupation: tenantOccupation,
        tenant_employer: tenantEmployer,
        guarantor_name: guarantorName,
        guarantor_phone: guarantorPhone,
        guarantor_address: guarantorAddress,
        guarantor_occupation: guarantorOccupation,
        annual_rent: annualRent,
        annual_service_charge: serviceCharge,
        caution_fee: cautionFee,
        lease_start_date: leaseStartDate,
        lease_end_date: leaseEndDate,
        raise_first_year_invoice: raiseMoveInInvoice,
        passport_photo_url: finalPassportUrl,
        valid_id_url: finalIdUrl,
        application_id: prefilledApplication?.id || null,
      });

      if (onOnboarded) onOnboarded();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Could not onboard tenant.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Onboard New Tenant &amp; KYC Intake ({unit.unit_name})
              </h3>
              <p className="text-xs text-emerald-300">
                {prefilledApplication
                  ? `Pre-filled from Approved Pre-Entry Application (${prefilledApplication.applicant_name})`
                  : `${unit.property?.title} • First-Year Move-In Package (10% Tenant Legal Agreement Fee)`}
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto text-xs">
          {prefilledApplication && (
            <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Pre-Entry KYC Application Loaded ({prefilledApplication.applicant_name}). Completing onboarding will mark this application as APPROVED.
                </span>
              </div>
            </div>
          )}

          {/* Section 1: Tenant KYC & Identification */}
          <div className="space-y-3">
            <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <CreditCard className="w-4 h-4" />
              1. Tenant Bio-Data &amp; Statutory KYC
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tenant Full Legal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Barr. Chinedu Okafor"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  National ID (NIN) / Passport / Driver&apos;s License <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tenantNinOrId}
                  onChange={(e) => setTenantNinOrId(e.target.value)}
                  placeholder="e.g. NIN-48291039481"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone / WhatsApp Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  placeholder="+234 803 000 0000"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address (For Zoho SMTP Receipts)
                </label>
                <input
                  type="email"
                  value={tenantEmail}
                  onChange={(e) => setTenantEmail(e.target.value)}
                  placeholder="tenant@company.ng"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Occupation / Profession <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={tenantOccupation}
                  onChange={(e) => setTenantOccupation(e.target.value)}
                  placeholder="e.g. Senior Petroleum Engineer"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employer / Business Name &amp; Address
                </label>
                <input
                  type="text"
                  value={tenantEmployer}
                  onChange={(e) => setTenantEmployer(e.target.value)}
                  placeholder="e.g. NLNG Limited, Victoria Island, Lagos"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm"
                />
              </div>
            </div>

            {/* Optional KYC Uploads (Passport Photo & Valid ID) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Passport Photograph (KYC File)
                </label>
                {passportPhotoUrl && !passportPhotoUrl.startsWith('data:') ? (
                  <div className="flex items-center justify-between gap-2">
                    <img
                      src={passportPhotoUrl}
                      alt="Passport Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setPassportPhotoUrl(null)}
                      className="text-rose-600 text-[11px] font-bold"
                    >
                      Replace Photo
                    </button>
                  </div>
                ) : (
                  <CameraCapture
                    onCapture={(dataUrl) => setPassportPhotoUrl(dataUrl)}
                    label="Capture / Upload Passport"
                  />
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Government Valid ID Card
                </label>
                {validIdUrl && !validIdUrl.startsWith('data:') ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px]">
                      ✓ Valid ID Attached from Application
                    </span>
                    <button
                      type="button"
                      onClick={() => setValidIdUrl(null)}
                      className="text-rose-600 text-[11px] font-bold"
                    >
                      Replace ID
                    </button>
                  </div>
                ) : (
                  <CameraCapture
                    onCapture={(dataUrl) => setValidIdUrl(dataUrl)}
                    label="Capture / Upload Valid ID"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Guarantor Details */}
          <div className="space-y-3">
            <h4 className="font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <Users className="w-4 h-4" />
              2. Guarantor Undertaking &amp; Contact Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Guarantor Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guarantorName}
                  onChange={(e) => setGuarantorName(e.target.value)}
                  placeholder="e.g. Chief Kunle Adeyemi"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Guarantor Phone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={guarantorPhone}
                  onChange={(e) => setGuarantorPhone(e.target.value)}
                  placeholder="+234 802 000 0000"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Guarantor Occupation
                </label>
                <input
                  type="text"
                  value={guarantorOccupation}
                  onChange={(e) => setGuarantorOccupation(e.target.value)}
                  placeholder="e.g. Chartered Accountant"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Guarantor Residential / Office Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={guarantorAddress}
                onChange={(e) => setGuarantorAddress(e.target.value)}
                placeholder="e.g. 12 Glover Road, Ikoyi, Lagos State"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm"
              />
            </div>
          </div>

          {/* Section 3: Lease Dates & Automated Move-In Breakdown */}
          <div className="space-y-3">
            <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <Calculator className="w-4 h-4" />
              3. Lease Term &amp; Automated First-Year Move-In Breakdown
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lease Commencement Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lease Expiration Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={leaseEndDate}
                  onChange={(e) => setLeaseEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Annual Rent (₦)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={annualRent}
                  onChange={(e) => setAnnualRent(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Service Charge (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Caution Deposit (₦)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cautionFee}
                  onChange={(e) => setCautionFee(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-bold"
                />
              </div>
            </div>

            {/* Automated First-Year Breakdown Preview */}
            <div className="bg-emerald-950 text-emerald-100 p-4 rounded-xl border border-emerald-800 space-y-1.5">
              <div className="flex items-center justify-between text-amber-300 font-bold border-b border-emerald-800 pb-1.5">
                <span>FIRST-YEAR MOVE-IN PACKAGE BREAKDOWN</span>
                <span className="text-[10px] bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded">
                  0% Landlord Mgt Deduction
                </span>
              </div>
              <div className="flex justify-between">
                <span>• Base Annual Rent (100% Credited to Landlord Pool):</span>
                <span className="font-bold text-white">{formatNaira(annualRent)}</span>
              </div>
              <div className="flex justify-between text-amber-300">
                <span>• 10% Legal / Tenancy Agreement Fee (100% Credited to Law Firm):</span>
                <span className="font-bold">+{formatNaira(firstYearLegalFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>• Estate Service Charge (Service Charge Pool):</span>
                <span className="font-bold text-sky-300">+{formatNaira(serviceCharge)}</span>
              </div>
              <div className="flex justify-between">
                <span>• Refundable Caution Deposit (Caution Escrow):</span>
                <span className="font-bold text-violet-300">+{formatNaira(cautionFee)}</span>
              </div>
              <div className="pt-2 border-t border-emerald-800 flex justify-between items-center text-sm font-black text-white">
                <span>TOTAL MOVE-IN INVOICE PAYABLE BY TENANT:</span>
                <span className="text-base text-amber-300">{formatNaira(totalMoveInPayable)}</span>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={raiseMoveInInvoice}
                onChange={(e) => setRaiseMoveInInvoice(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 w-4 h-4"
              />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Automatically raise First-Year Move-In Invoice &amp; Magic Link upon onboarding
              </span>
            </label>
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
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold shadow-md transition disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Onboarding Tenant...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span>Complete Onboarding &amp; Activate Lease</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
