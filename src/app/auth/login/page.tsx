'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Scale,
  ShieldCheck,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { supabase, setAuthCookie } from '@/lib/supabase';
import { EstateStore } from '@/lib/store';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      // 1. Supabase signInWithPassword
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.session?.access_token) {
        throw new Error('Authentication succeeded but no access session was returned.');
      }

      // 2. Set Cookie for Next.js Middleware route protection
      setAuthCookie(data.session.access_token, data.session.expires_in);

      // 3. Fetch user profile from Supabase
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profileData) {
          await EstateStore.updateChamberProfile(profileData);
        }
      } catch (profErr) {
        console.warn('Profile fetch note:', profErr);
      }

      // 4. Redirect
      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      console.error('Sign in error:', err);
      setErrorMessage(err?.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-emerald-400" />
          Manager Sign In
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Access your property ledgers, maintenance approvals, and automated fee records.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-400 font-semibold mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="manager@example.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-slate-400 font-semibold">
              Password
            </label>
            <span className="text-[11px] text-slate-500">Min 6 characters</span>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5 pointer-events-none" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-extrabold text-sm shadow-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Manager Portal</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
        <div>
          <span>New property manager or firm? </span>
          <Link
            href="/auth/register"
            className="text-amber-400 font-bold hover:underline"
          >
            Create an Account
          </Link>
        </div>
        <div>
          <Link
            href="/pay"
            className="text-slate-500 hover:text-emerald-400 text-[11px] block transition"
          >
            Looking for tenant rent payment? Access Tenant Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-emerald-950 shadow-xl mb-1">
          <Building2 className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">
          ESTATE<span className="text-amber-400">MANAGEMENT</span>
        </h1>
        <p className="text-xs text-slate-400">
          Commercial Property &amp; Tenancy Management System
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs">
            Loading authentication portal...
          </div>
        }>
          <LoginFormContent />
        </Suspense>
      </div>
    </div>
  );
}
