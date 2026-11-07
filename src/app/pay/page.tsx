'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Scale, ArrowRight, ShieldCheck } from 'lucide-react';
import { EstateStore } from '@/lib/store';
import { INITIAL_CHAMBER_PROFILE } from '@/lib/initialData';
import { ChamberProfile } from '@/types/database';

function TenantPayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryToken = searchParams?.get('token');

  const [tokenInput, setTokenInput] = useState(queryToken || '');
  const [profile, setProfile] = useState<ChamberProfile>(INITIAL_CHAMBER_PROFILE);
  const invoices = EstateStore.getInvoices();

  useEffect(() => {
    setProfile(EstateStore.getChamberProfile());
  }, []);

  useEffect(() => {
    if (queryToken && queryToken.trim()) {
      router.push(`/pay/${queryToken.trim()}`);
    }
  }, [queryToken, router]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    router.push(`/pay/${tokenInput.trim()}`);
  };

  return (
    <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
      {profile.letterhead_logo_url ? (
        <div className="flex justify-center">
          <img
            src={profile.letterhead_logo_url}
            alt={profile.firm_name}
            className="h-14 w-auto object-contain max-w-[200px]"
          />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-emerald-950 mx-auto shadow-md">
          <Scale className="w-6 h-6" />
        </div>
      )}
      <div>
        <h1 className="text-lg font-black text-white uppercase">
          {profile.firm_name || 'Tenant Payment Portal'}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Chambers of Legal Property Managers • Enter your Access Token or select your demand notice.
        </p>
      </div>

      <form onSubmit={handleLookup} className="space-y-3">
        <input
          type="text"
          required
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="Enter Invoice Access Token UUID"
          className="w-full text-xs bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 font-mono text-center focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow"
        >
          <span>Access Demand Notice</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Demo shortcuts */}
      {invoices.length > 0 && (
        <div className="pt-4 border-t border-slate-800 text-left space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 block text-center">
            Active Rent Demand Notices:
          </span>
          <div className="space-y-1.5">
            {invoices.slice(0, 3).map((inv) => (
              <button
                key={inv.id}
                onClick={() => router.push(`/pay/${inv.access_token}`)}
                className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-left flex items-center justify-between text-slate-300 transition"
              >
                <div>
                  <span className="font-bold text-white block">{inv.tenant_name}</span>
                  <span className="text-[10px] text-slate-500">{inv.unit?.unit_name}</span>
                </div>
                <span className="text-emerald-400 font-mono text-[11px] font-bold">
                  View &rarr;
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TenantPayEntryPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-xs">Loading portal...</div>}>
        <TenantPayContent />
      </Suspense>
    </div>
  );
}
