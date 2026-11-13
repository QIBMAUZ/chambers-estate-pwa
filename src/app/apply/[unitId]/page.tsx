'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Scale,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  CreditCard,
  Users,
  Building2,
} from 'lucide-react';
import { EstateStore } from '@/lib/store';
import { formatNaira } from '@/lib/utils';
import { CameraCapture } from '@/components/CameraCapture';
import { Unit, ChamberProfile, TenancyApplication } from '@/types/database';
import { INITIAL_CHAMBER_PROFILE } from '@/lib/initialData';

export default function PublicTenancyApplicationPage() {
  const routeParams = useParams();
  const unitId = (routeParams?.unitId as string) || '';

  const [unit, setUnit] = useState<Unit | null>(null);
  const [profile, setProfile] = useState<ChamberProfile>(INITIAL_CHAMBER_PROFILE);
  const [loading, setLoading] = useState(true);

  // Applicant Form State
  const [applicantName, setApplicantName] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [ninOrIdNumber, setNinOrIdNumber] = useState('');
  const [occupation, setOccupation] = useState('');
  const [employer, setEmployer] = useState('');
  const [previousAddress, setPreviousAddress] = useState('');

  // Guarantor Form State
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [guarantorOccupation, setGuarantorOccupation] = useState('');
  const [guarantorAddress, setGuarantorAddress] = useState('');

  // KYC Uploads
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string>('');
  const [validIdUrl, setValidIdUrl] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<TenancyApplication | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadUnit() {
      if (!unitId) return;
      setLoading(true);
      try {
        const res = await EstateStore.fetchUnitForPublicPortal(unitId);
        if (!isMounted) return;
        if (res) {
          setUnit(res.unit);
          setProfile(res.profile);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadUnit();
    return () => {
      isMounted = false;
    };
  }, [unitId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unit) return;
    if (!applicantName.trim() || !applicantPhone.trim() || !guarantorName.trim()) {
      alert('Please fill out your Full Name, Phone Number, and Guarantor details.');
      return;
    }
    if (!passportPhotoUrl || !validIdUrl) {
      alert('Please upload both your Passport Photograph and a Valid Government ID.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await EstateStore.submitTenancyApplication({
        unit_id: unit.id,
        property_id: unit.property_id,
        manager_id: unit.manager_id || unit.property?.manager_id || null,
        applicant_name: applicantName,
        applicant_phone: applicantPhone,
        applicant_email: applicantEmail,
        nin_or_id_number: ninOrIdNumber,
        occupation,
        employer,
        previous_address: previousAddress,
        guarantor_name: guarantorName,
        guarantor_phone: guarantorPhone,
        guarantor_address: guarantorAddress,
        guarantor_occupation: guarantorOccupation,
        passport_photo_url: passportPhotoUrl,
        valid_id_url: validIdUrl,
      });
      setSubmittedApp(created);
    } catch (err: any) {
      alert(err?.message || 'Could not submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-white text-sm font-semibold flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <span>Loading Chambers Pre-Entry Tenancy Application Portal...</span>
        </div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-6 max-w-md text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold">Tenancy Unit Not Found</h2>
          <p className="text-xs text-slate-400">
            This application link is invalid or no longer active. Please contact the managing law chambers.
          </p>
        </div>
      </div>
    );
  }

  const legalFee = Math.round(Number(unit.annual_rent || 0) * 0.1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 px-4 sm:px-6 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Chambers Letterhead Header */}
        <div className="bg-emerald-950 border-b border-emerald-800 p-6 text-center space-y-2">
          {profile.letterhead_logo_url ? (
            <div className="flex justify-center mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.letterhead_logo_url}
                alt={profile.firm_name}
                className="h-12 w-auto object-contain max-w-[200px]"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-emerald-950 font-bold mx-auto">
              <Scale className="w-6 h-6" />
            </div>
          )}
          <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase">
            {profile.firm_name || 'BARR. T. A. BABATUNDE & ASSOCIATES'}
          </h1>
          <p className="text-[11px] text-amber-300 font-bold tracking-wide uppercase">
            Legal Practitioners &amp; Property Solicitors of the Supreme Court of Nigeria
          </p>
          <div className="inline-block bg-emerald-900/80 text-emerald-200 text-[10px] font-semibold px-3 py-1 rounded-full border border-emerald-700">
            Pre-Entry Tenancy Application &amp; KYC Verification Form
          </div>
        </div>

        {/* Target Unit Overview Banner */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
              Applying For Demised Unit
            </span>
            <span className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" />
              {unit.unit_name} • {unit.property?.title || 'Managed Estate'}
            </span>
            <span className="text-[11px] text-slate-400 block">
              {unit.property?.address}
            </span>
          </div>
          <div className="text-left sm:text-right bg-emerald-950/50 border border-emerald-800/60 px-3.5 py-2 rounded-xl">
            <span className="text-[10px] text-emerald-300 uppercase font-bold block">
              Annual Rent
            </span>
            <span className="text-sm font-black text-amber-300 font-mono">
              {formatNaira(unit.annual_rent)}/yr
            </span>
            <span className="text-[10px] text-slate-400 block">
              +10% Agreement Fee ({formatNaira(legalFee)})
            </span>
          </div>
        </div>

        {submittedApp ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-900/80 border border-emerald-600 text-emerald-300 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white">
              Tenancy Application &amp; KYC Submitted!
            </h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Thank you, <strong>{submittedApp.applicant_name}</strong>. Your pre-entry KYC form, passport photograph, and identification have been transmitted to{' '}
              <strong>{profile.firm_name}</strong> for review.
            </p>
            <div className="inline-block bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-xs font-mono text-amber-300">
              Application Reference: APP-{submittedApp.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs">
            {/* 1. Applicant Bio-Data */}
            <div className="space-y-3">
              <h3 className="font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <CreditCard className="w-4 h-4" />
                1. Applicant Bio-Data &amp; Employment Particulars
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Full Legal Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    placeholder="e.g. Barr. Chinedu Okafor"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Phone / WhatsApp Number <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    placeholder="+234 803 000 0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    placeholder="applicant@email.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    NIN / Driver&apos;s License / Passport No <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ninOrIdNumber}
                    onChange={(e) => setNinOrIdNumber(e.target.value)}
                    placeholder="e.g. NIN-48291039481"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Occupation / Profession <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Senior Petroleum Engineer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Employer / Business Name &amp; Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={employer}
                    onChange={(e) => setEmployer(e.target.value)}
                    placeholder="e.g. NLNG Limited, Victoria Island, Lagos"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Current / Previous Residential Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={previousAddress}
                  onChange={(e) => setPreviousAddress(e.target.value)}
                  placeholder="e.g. 14B Admiralty Road, Lekki Phase 1, Lagos"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            {/* 2. Guarantor Details */}
            <div className="space-y-3">
              <h3 className="font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <Users className="w-4 h-4" />
                2. Guarantor Undertaking &amp; Contact Details
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Guarantor Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guarantorName}
                    onChange={(e) => setGuarantorName(e.target.value)}
                    placeholder="e.g. Chief Kunle Adeyemi"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Guarantor Phone <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={guarantorPhone}
                    onChange={(e) => setGuarantorPhone(e.target.value)}
                    placeholder="+234 802 000 0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Guarantor Occupation <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={guarantorOccupation}
                    onChange={(e) => setGuarantorOccupation(e.target.value)}
                    placeholder="e.g. Chartered Accountant"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Guarantor Residential / Office Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guarantorAddress}
                  onChange={(e) => setGuarantorAddress(e.target.value)}
                  placeholder="e.g. 12 Glover Road, Ikoyi, Lagos State"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                />
              </div>
            </div>

            {/* 3. Mandatory KYC Uploads: Passport Photo & Valid ID */}
            <div className="space-y-3">
              <h3 className="font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                <Upload className="w-4 h-4" />
                3. Mandatory KYC Uploads (Passport Photograph &amp; Valid ID)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CameraCapture
                  onCapture={(img) => setPassportPhotoUrl(img)}
                  initialImage={passportPhotoUrl}
                  label="1. Passport Photograph *"
                  helperText="Snap a clear headshot or upload passport photo"
                />
                <CameraCapture
                  onCapture={(img) => setValidIdUrl(img)}
                  initialImage={validIdUrl}
                  label="2. Valid Government ID (NIN / Passport / Driver's License) *"
                  helperText="Snap or upload your NIN slip, Driver's License, Voter's Card, or Passport"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-black py-3.5 px-4 rounded-xl shadow-lg transition text-xs sm:text-sm flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Uploading KYC Documents &amp; Submitting Application...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Submit Official Tenancy Application &amp; KYC</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
