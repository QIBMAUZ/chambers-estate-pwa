'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Scale,
  ShieldCheck,
  Building2,
  User,
  CreditCard,
  Mail,
  Lock,
  Phone,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileBadge,
} from 'lucide-react';
import { supabase, setAuthCookie } from '@/lib/supabase';
import { EstateStore } from '@/lib/store';
import { ChamberProfile } from '@/types/database';

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

export default function RegisterPage() {
  const router = useRouter();

  // Form state
  const [solicitorName, setSolicitorName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [phone, setPhone] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [bankName, setBankName] = useState(NIGERIAN_BANKS[0]);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic Validations
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (accountNumber.replace(/\D/g, '').length !== 10) {
      setErrorMessage('Nigerian NUBAN account number must be exactly 10 digits.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Supabase Auth Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            solicitor_name: solicitorName.trim(),
            firm_name: firmName.trim(),
            phone: phone.trim() || '',
            bank_name: bankName || 'Zenith Bank PLC',
            account_number: accountNumber.trim() || '',
            account_name: accountName.trim() || '',
            enrollment_no: enrollmentNo.trim() || '',
            office_address: officeAddress.trim() || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria',
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const userId = authData.user?.id || crypto.randomUUID();
      const sessionToken = authData.session?.access_token || `token-${userId}`;

      // 2. Set Cookie for Next.js Middleware route protection
      setAuthCookie(sessionToken);

      // 3. Create Manager Chamber Profile
      const newProfile: ChamberProfile = {
        id: userId,
        firm_name: firmName.trim() || 'BARR. T. A. BABATUNDE & ASSOCIATES',
        solicitor_name: solicitorName.trim(),
        enrollment_no: enrollmentNo.trim() || 'SCN/2026/PROV',
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        office_address: officeAddress.trim() || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria',
        bank_name: bankName,
        account_number: accountNumber.trim(),
        account_name: accountName.trim() || firmName.trim(),
        letterhead_logo_url: null,
        updated_at: new Date().toISOString(),
      };

      // 4. Upsert into Supabase profiles table
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          firm_name: newProfile.firm_name,
          solicitor_name: newProfile.solicitor_name,
          enrollment_no: newProfile.enrollment_no,
          phone: newProfile.phone,
          email: newProfile.email,
          office_address: newProfile.office_address,
          bank_name: newProfile.bank_name,
          account_number: newProfile.account_number,
          account_name: newProfile.account_name,
          letterhead_logo_url: null,
          updated_at: newProfile.updated_at,
        });
      } catch (dbErr) {
        console.warn('Profiles upsert note:', dbErr);
      }

      // 5. Update local store state
      await EstateStore.updateChamberProfile(newProfile);

      // 6. Redirect to dashboard
      router.push('/');
      router.refresh();
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMessage(err?.message || 'Registration failed. Please check your network and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-emerald-950 shadow-xl mb-1">
          <Building2 className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
          ESTATE<span className="text-amber-400">MANAGEMENT</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Commercial Property &amp; Tenancy Management Progressive Web Application.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              Register Property Management Account
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Set up your company profile, collection account, and fee calculation rules.
            </p>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            {/* 1. Professional & Firm Info */}
            <div className="space-y-4">
              <h3 className="font-extrabold uppercase text-[11px] tracking-wider text-emerald-400 flex items-center gap-1.5">
                <User className="w-4 h-4" />
                1. Manager &amp; Company Identification
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Full Name / Lead Manager <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={solicitorName}
                    onChange={(e) => setSolicitorName(e.target.value)}
                    placeholder="e.g. T. A. Babatunde"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Company / Agency / Firm Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder="e.g. BABATUNDE PROPERTY CONSULTANTS"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 uppercase font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Professional Accreditation / Enrolment No (Optional)
                  </label>
                  <input
                    type="text"
                    value={enrollmentNo}
                    onChange={(e) => setEnrollmentNo(e.target.value)}
                    placeholder="e.g. SCN/2004/0981 or REG-2026-09"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Official Contact Phone / WhatsApp <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +234 803 555 0192"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Office Physical Address &amp; State <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  placeholder="e.g. Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* 2. Collection Bank Details */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="font-extrabold uppercase text-[11px] tracking-wider text-amber-400 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4" />
                2. Dedicated Rent Collection Bank Details
              </h3>
              <p className="text-[11px] text-slate-500">
                These banking instructions are presented to tenants on their magic payment portal links.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Commercial Bank Name <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500"
                  >
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    10-Digit NUBAN Account No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="1012345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono tracking-wider font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Beneficiary Account Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Babatunde Properties Client Account"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* 3. Account Login Credentials */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h3 className="font-extrabold uppercase text-[11px] tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                3. Manager Login Credentials
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-slate-400 font-semibold mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Password (Min 6 chars) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-extrabold text-sm shadow-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Creating Manager Account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
            <span>Already have an account? </span>
            <Link
              href="/auth/login"
              className="text-amber-400 font-bold hover:underline inline-flex items-center gap-1"
            >
              Sign In to Manager Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
