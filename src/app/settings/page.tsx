'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Scale,
  Trash2,
  Save,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  FileBadge,
  Eye,
  Loader2,
  LogOut,
  CreditCard,
  User,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { uploadLogoToStorage, isSupabaseConfigured, supabase, clearAuthCookie } from '@/lib/supabase';
import { ChamberProfile } from '@/types/database';
import { INITIAL_CHAMBER_PROFILE } from '@/lib/initialData';

const NIGERIAN_BANKS = [
  'Zenith Bank PLC',
  'Guaranty Trust Bank (GTBank)',
  'Access Bank PLC',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Stanbic IBTC Bank',
  'Fidelity Bank PLC',
  'Sterling Bank',
  'Wema Bank / ALAT',
  'Providus Bank',
  'Kuda Bank',
  'Moniepoint MFB',
  'OPay Digital Services',
];

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ChamberProfile>(INITIAL_CHAMBER_PROFILE);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [firmName, setFirmName] = useState('');
  const [solicitorName, setSolicitorName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [bankName, setBankName] = useState(NIGERIAN_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const p = EstateStore.getChamberProfile();
    setProfile(p);
    setPreviewUrl(p.letterhead_logo_url || null);
    setFirmName(p.firm_name || '');
    setSolicitorName(p.solicitor_name || '');
    setEnrollmentNo(p.enrollment_no || '');
    setPhone(p.phone || '');
    setEmail(p.email || '');
    setOfficeAddress(p.office_address || '');
    setBankName(p.bank_name || NIGERIAN_BANKS[0]);
    setAccountNumber(p.account_number || '');
    setAccountName(p.account_name || '');

    // Dynamically connect active authenticated manager
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setAuthUserId(user.id);
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setProfile(data);
              setPreviewUrl(data.letterhead_logo_url || null);
              setFirmName(data.firm_name || '');
              setSolicitorName(data.solicitor_name || '');
              setEnrollmentNo(data.enrollment_no || '');
              setPhone(data.phone || '');
              setEmail(data.email || '');
              setOfficeAddress(data.office_address || '');
              if (data.bank_name) setBankName(data.bank_name);
              if (data.account_number) setAccountNumber(data.account_number);
              if (data.account_name) setAccountName(data.account_name);
            }
          });
      }
    });

    const unsub = subscribeToStore(() => {
      const updated = EstateStore.getChamberProfile();
      setProfile(updated);
      setPreviewUrl(updated.letterhead_logo_url || null);
    });
    return () => unsub();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate mime type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setStatusMessage({
        type: 'error',
        text: 'Invalid file format. Please select a PNG, JPEG, or WEBP image.',
      });
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({
        type: 'error',
        text: 'File size exceeds 5MB limit. Please choose a smaller logo file.',
      });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
      setStatusMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = async () => {
    if (!previewUrl) {
      setStatusMessage({ type: 'error', text: 'Please select an image file first.' });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    try {
      // Upload to Supabase Storage: receipts/logos/${managerId}_logo.${ext}
      const managerId = authUserId || profile.id || 'manager_default';
      const uploadedPublicUrl = await uploadLogoToStorage(previewUrl, managerId);

      // Update store and Supabase profiles table
      await EstateStore.updateChamberProfile({
        id: managerId,
        letterhead_logo_url: uploadedPublicUrl,
      });

      setStatusMessage({
        type: 'success',
        text: 'Chamber letterhead logo uploaded & activated successfully across all portals and statements.',
      });
      setSelectedFile(null);
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to upload logo. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Remove firm letterhead logo and revert to statutory Chambers seal?')) return;
    setIsUploading(true);
    try {
      const managerId = authUserId || profile.id || 'manager_default';
      await EstateStore.updateChamberProfile({ id: managerId, letterhead_logo_url: null });
      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setStatusMessage({
        type: 'success',
        text: 'Chamber logo removed. Default Chambers legal seal restored.',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to remove logo.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const managerId = authUserId || profile.id || 'manager_default';
      await EstateStore.updateChamberProfile({
        id: managerId,
        firm_name: firmName.trim() || 'BARR. T. A. BABATUNDE & ASSOCIATES',
        solicitor_name: solicitorName.trim() || 'Barr. T. A. Babatunde, LL.B, B.L',
        enrollment_no: enrollmentNo.trim() || 'SCN/2004/0981',
        phone: phone.trim() || '+234 803 555 0192',
        email: email.trim() || 'chambers@babatundelaw.ng',
        office_address: officeAddress.trim() || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria',
        bank_name: bankName,
        account_number: accountNumber.trim(),
        account_name: accountName.trim() || firmName.trim(),
      });
      setStatusMessage({
        type: 'success',
        text: 'Chamber profile & legal letterhead credentials updated successfully.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to save profile credentials.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (confirm('Sign out from Chambers management session?')) {
      await supabase.auth.signOut().catch(() => {});
      clearAuthCookie();
      window.location.href = '/auth/login';
    }
  };

  return (
    <PWAProvider>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12">
        <Navigation />

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                Firm Settings &amp; Dynamic Letterhead
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Customise chamber branding, official logo, and solicitor credentials for rent demands, payment portals &amp; landlord statements.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Supreme Court Regulated</span>
              </span>
            </div>
          </div>

          {/* Alert Message Banner */}
          {statusMessage && (
            <div
              className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-sm border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-xs opacity-70 hover:opacity-100 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Logo Upload & Branding (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Multi-User RBAC Role & Access Control Card */}
              <div className="bg-emerald-950 text-white rounded-2xl border border-emerald-800 p-5 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-800/80 pb-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400 block">
                      Multi-User Role-Based Access Control (RBAC)
                    </span>
                    <h2 className="text-sm sm:text-base font-black text-white">
                      Active Session Role:{' '}
                      {profile.role === 'ACCOUNTANT_CLERK'
                        ? 'ACCOUNTANT / CLERK (Restricted)'
                        : 'HEAD OF CHAMBERS (Full Admin)'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => EstateStore.switchActiveRole('HEAD_OF_CHAMBERS')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        profile.role !== 'ACCOUNTANT_CLERK'
                          ? 'bg-amber-500 text-emerald-950 shadow'
                          : 'bg-emerald-900/60 text-emerald-200 border border-emerald-700'
                      }`}
                    >
                      Head of Chambers
                    </button>
                    <button
                      type="button"
                      onClick={() => EstateStore.switchActiveRole('ACCOUNTANT_CLERK')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        profile.role === 'ACCOUNTANT_CLERK'
                          ? 'bg-amber-500 text-emerald-950 shadow'
                          : 'bg-emerald-900/60 text-emerald-200 border border-emerald-700'
                      }`}
                    >
                      Accountant / Clerk
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-200 leading-relaxed">
                  <strong>Head of Chambers:</strong> Full administrative control over properties, landlord bank details, fee rates, and historical deletion.{' '}
                  <strong>Accountant / Clerk:</strong> Can onboard tenants, raise invoices/fee notes, and log inflows, vouchers, and expenses, but cannot delete history, edit stamped vouchers, or alter bank/fee settings.
                </p>
              </div>

              {/* Firm Letterhead & Branding Card */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                        Firm Letterhead &amp; Branding
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Upload your chambers official seal or logo for statements, magic links &amp; rent receipts.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Logo Preview Canvas */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner flex items-center justify-center overflow-hidden p-2 relative group shrink-0">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Chambers Firm Logo Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-2 space-y-1">
                        <Scale className="w-8 h-8 text-amber-500 mx-auto" />
                        <span className="text-[10px] text-slate-400 font-bold block">No Logo Uploaded</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {previewUrl ? 'Active Chamber Letterhead Logo' : 'Default Chambers Seal Active'}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Recommended: High-resolution PNG or WEBP with transparent background (Min 300x300px, Max 5MB).
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleFileChange}
                        className="hidden"
                        id="logo-upload-input"
                      />
                      <label
                        htmlFor="logo-upload-input"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer transition"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                        <span>Choose File</span>
                      </label>

                      {previewUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          disabled={isUploading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Staged file info & Upload CTA */}
                {selectedFile && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="truncate mr-2">
                      <span className="font-bold text-amber-900 dark:text-amber-200 block truncate">
                        Selected: {selectedFile.name}
                      </span>
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">
                        Size: {(selectedFile.size / 1024).toFixed(1)} KB • Type: {selectedFile.type}
                      </span>
                    </div>

                    <button
                      onClick={handleUploadLogo}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md active:scale-95 transition disabled:opacity-60 shrink-0"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-amber-300" />
                          <span>Upload Firm Logo</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Chambers Legal Credentials Form */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <FileBadge className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                      Chambers Legal Credentials &amp; Address
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Printed on all official landlord statements and Lagos Tenancy Law notices.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Chambers / Firm Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      placeholder="e.g. BARR. T. A. BABATUNDE & ASSOCIATES"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-bold uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Principal Solicitor &amp; Advocate
                      </label>
                      <input
                        type="text"
                        required
                        value={solicitorName}
                        onChange={(e) => setSolicitorName(e.target.value)}
                        placeholder="e.g. Barr. T. A. Babatunde, LL.B, B.L"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Supreme Court Enrolment Number
                      </label>
                      <input
                        type="text"
                        required
                        value={enrollmentNo}
                        onChange={(e) => setEnrollmentNo(e.target.value)}
                        placeholder="e.g. SCN/2004/0981"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Chambers Telephone / WhatsApp
                      </label>
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +234 803 555 0192"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                        Official Chambers Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. chambers@babatundelaw.ng"
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                      Chambers Physical Address &amp; State
                    </label>
                    <input
                      type="text"
                      required
                      value={officeAddress}
                      onChange={(e) => setOfficeAddress(e.target.value)}
                      placeholder="e.g. Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria"
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                    />
                  </div>

                  {/* Dedicated Chambers Rent Collection Account */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        Chambers Dedicated Collection Escrow Account
                      </h4>
                      {profile.role === 'ACCOUNTANT_CLERK' && (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded">
                          Locked for Accountant / Clerk
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          Bank Name
                        </label>
                        <select
                          value={bankName}
                          disabled={profile.role === 'ACCOUNTANT_CLERK'}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-medium disabled:opacity-60"
                        >
                          {NIGERIAN_BANKS.map((b) => (
                            <option key={b} value={b}>
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          10-Digit NUBAN Account
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={10}
                          disabled={profile.role === 'ACCOUNTANT_CLERK'}
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="1012345678"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-mono font-bold disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                          Account Beneficiary Name
                        </label>
                        <input
                          type="text"
                          required
                          disabled={profile.role === 'ACCOUNTANT_CLERK'}
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          placeholder="e.g. Babatunde & Co Client Escrow"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-semibold disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition border border-rose-300 dark:border-rose-900"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-60"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 text-amber-300" />
                          <span>Save Chambers Profile</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Live Letterhead Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    Live Letterhead Preview
                  </h3>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    A4 Canvas Mode
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  This preview renders dynamically at the top of all tenant payment portals, downloadable receipts, and statements.
                </p>

                {/* Simulated Sheet Canvas */}
                <div className="bg-white text-slate-900 rounded-xl border border-slate-300 p-6 shadow-md space-y-4 text-center">
                  {/* Dynamic Logo / Icon */}
                  {previewUrl ? (
                    <div className="flex justify-center">
                      <img
                        src={previewUrl}
                        alt="Chamber Logo"
                        className="h-16 w-auto max-w-[180px] object-contain drop-shadow-sm"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-emerald-950 flex items-center justify-center font-bold mx-auto shadow">
                      <Scale className="w-6 h-6 stroke-[2.2]" />
                    </div>
                  )}

                  {/* Firm Typography */}
                  <div className="space-y-1">
                    <h2 className="text-sm font-black tracking-tight text-emerald-950 uppercase">
                      {firmName || 'BARR. T. A. BABATUNDE & ASSOCIATES'}
                    </h2>
                    <p className="text-[9px] font-bold text-amber-700 uppercase tracking-wide">
                      Legal Practitioners, Estate Solicitors &amp; Arbitrators
                    </p>
                    <p className="text-[8.5px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Chambers: {officeAddress || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos'} • Tel: {phone || '+234 803 555 0192'} • Email: {email || 'info@babatundelaw.ng'}
                    </p>
                  </div>

                  <div className="border-b-2 border-emerald-900"></div>

                  {/* Sample Document Title */}
                  <div className="bg-slate-100 py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider text-slate-800">
                    FORMAL STATEMENT OF ACCOUNT &amp; RENT AUDIT
                  </div>

                  {/* Mini Mock Content */}
                  <div className="space-y-1.5 text-left text-[9px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-800">Principal Advocate:</span>
                      <span>{solicitorName || 'Barr. T. A. Babatunde'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-800">SCN Enrolment:</span>
                      <span className="font-mono">{enrollmentNo || 'SCN/2004/0981'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-800">Legal Fee Rate:</span>
                      <span className="font-bold text-emerald-800">10.00% Statutory</span>
                    </div>
                  </div>

                  {/* Chambers Stamp Footer */}
                  <div className="pt-2 flex justify-between items-center text-[8px] text-slate-400 border-t border-slate-200">
                    <div className="text-left font-mono">
                      <span>CHAMBERS REF: LAG/EST/2026</span>
                    </div>
                    <div className="p-1 rounded border border-amber-400 bg-amber-50 text-amber-900 font-bold text-[8px]">
                      OFFICIAL SEAL
                    </div>
                  </div>
                </div>
              </div>

              {/* Cloud Sync Status Note */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 text-xs space-y-1.5">
                <div className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Cloud Persistence Status
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  {isSupabaseConfigured
                    ? 'Connected to Supabase. Logo is uploaded to public bucket receipts/logos/ and stored in the profiles table.'
                    : 'Operating in Local Storage Reactive Mode. Logo is persisted in browser IndexedDB/LocalStorage.'}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </PWAProvider>
  );
}
