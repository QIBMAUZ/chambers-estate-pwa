'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Wrench,
  FileText,
  RefreshCw,
  Database,
  Settings,
  LogOut,
  Scale,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { INITIAL_PROPERTIES, INITIAL_CHAMBER_PROFILE } from '@/lib/initialData';
import { Property, ChamberProfile, UserRole } from '@/types/database';
import { isSupabaseConfigured, supabase, clearAuthCookie } from '@/lib/supabase';

interface NavigationProps {
  selectedPropertyId?: string;
  onPropertyChange?: (id: string) => void;
}

export function Navigation({ selectedPropertyId, onPropertyChange }: NavigationProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [profile, setProfile] = useState<ChamberProfile>(INITIAL_CHAMBER_PROFILE);

  useEffect(() => {
    setMounted(true);
    setProperties(EstateStore.getProperties(false));
    setProfile(EstateStore.getChamberProfile());
    const unsub = subscribeToStore(() => {
      setProperties(EstateStore.getProperties(false));
      setProfile(EstateStore.getChamberProfile());
    });
    return () => unsub();
  }, []);

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/properties', label: 'Properties & Units', icon: Building2 },
    { href: '/invoices', label: 'Rent & Tranches', icon: Receipt },
    { href: '/expenses', label: 'Artisan Vouchers', icon: Wrench },
    { href: '/chambers', label: 'Chambers & Fee Notes', icon: Scale },
    { href: '/statement', label: 'Landlord Statement', icon: FileText },
    { href: '/settings', label: 'Firm & RBAC', icon: Settings },
  ];

  const handleToggleRole = async () => {
    const currentRole: UserRole = profile.role || 'HEAD_OF_CHAMBERS';
    const nextRole: UserRole =
      currentRole === 'HEAD_OF_CHAMBERS' ? 'ACCOUNTANT_CLERK' : 'HEAD_OF_CHAMBERS';
    await EstateStore.switchActiveRole(nextRole);
  };

  const handleReset = () => {
    if (EstateStore.isAccountantClerk()) {
      alert('Access Denied: Only the Head of Chambers can reset local cache.');
      return;
    }
    if (confirm('Clear local application cache and refresh data?')) {
      EstateStore.resetState();
      EstateStore.refreshFromCloud().finally(() => {
        window.location.reload();
      });
    }
  };

  const handleSignOut = async () => {
    if (confirm('Sign out from management session?')) {
      EstateStore.resetState();
      if (typeof window !== 'undefined') {
        const keysToClear: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('estate_store_') || k.startsWith('estate_pwa_'))) {
            keysToClear.push(k);
          }
        }
        keysToClear.forEach((k) => localStorage.removeItem(k));
      }
      await supabase.auth.signOut().catch(() => {});
      clearAuthCookie();
      window.location.href = '/auth/login';
    }
  };

  const firmInitials =
    mounted && profile?.firm_name
      ? profile.firm_name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase())
          .join('')
      : 'CE';

  const activeRole: UserRole = mounted ? profile.role || 'HEAD_OF_CHAMBERS' : 'HEAD_OF_CHAMBERS';

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Refined Initials Badge */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-900 text-amber-400 flex items-center justify-center shadow-sm ring-1 ring-emerald-950/10 group-hover:scale-105 transition-all duration-200 overflow-hidden p-1">
              {mounted && profile?.letterhead_logo_url ? (
                <img
                  src={profile.letterhead_logo_url}
                  alt={profile.firm_name}
                  className="w-full h-full object-contain bg-white rounded-lg p-0.5"
                />
              ) : (
                <Scale className="w-5 h-5 stroke-[2.2] text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white uppercase">
                  CHAMBERS <span className="text-emerald-700 dark:text-amber-400">&amp; ESTATE</span>
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800">
                  {mounted && profile?.firm_name ? profile.firm_name : 'Law Firm Chambers PWA'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:block truncate max-w-md">
                Integrated Legal Practice, Solicitor Fee Notes &amp; Property Escrow Management PWA.
              </p>
            </div>
          </Link>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Property Selector */}
            {onPropertyChange && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400 hidden sm:block" />
                <select
                  value={selectedPropertyId || ''}
                  onChange={(e) => onPropertyChange(e.target.value)}
                  suppressHydrationWarning
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium rounded-xl px-3 py-1.5 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none max-w-[140px] sm:max-w-[200px] transition-all"
                >
                  <option value="" suppressHydrationWarning>
                    All Active Estates
                  </option>
                  {(mounted ? properties : INITIAL_PROPERTIES).map((p) => (
                    <option key={p.id} value={p.id} suppressHydrationWarning>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* RBAC Role Switcher / Indicator Badge */}
            <button
              type="button"
              onClick={handleToggleRole}
              title="Click to switch active RBAC view (HEAD_OF_CHAMBERS vs ACCOUNTANT_CLERK)"
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer',
                activeRole === 'HEAD_OF_CHAMBERS'
                  ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300'
                  : 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-300'
              )}
            >
              {activeRole === 'HEAD_OF_CHAMBERS' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="hidden sm:inline">HEAD_OF_CHAMBERS</span>
                  <span className="sm:hidden">Principal</span>
                </>
              ) : (
                <>
                  <UserCog className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="hidden sm:inline">ACCOUNTANT_CLERK</span>
                  <span className="sm:hidden">Clerk</span>
                </>
              )}
            </button>

            {/* Supabase Status Pill */}
            <div
              title={
                isSupabaseConfigured
                  ? 'Connected to live Supabase PostgreSQL'
                  : 'Operating in Local Storage Reactive Mode'
              }
              suppressHydrationWarning
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100/80 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <Database className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              <span suppressHydrationWarning>
                {mounted ? (isSupabaseConfigured ? 'Supabase Live' : 'Local Vault') : 'Supabase Live'}
              </span>
            </div>

            {/* Reset / Clear Local State Button (Hidden for Clerk) */}
            {activeRole === 'HEAD_OF_CHAMBERS' && (
              <button
                onClick={handleReset}
                title="Clear local application cache and refresh"
                className="hidden lg:flex px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800 rounded-lg text-xs font-medium items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}

            {/* Manager Sign Out */}
            <button
              onClick={handleSignOut}
              title="Sign out of management portal"
              className="px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Navigation Links */}
      <nav className="hidden md:block border-t border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 py-2 overflow-x-auto">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs lg:text-sm font-medium whitespace-nowrap transition-all',
                    isActive
                      ? 'bg-emerald-900 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4',
                      isActive ? 'text-emerald-200' : 'text-slate-400 dark:text-slate-500'
                    )}
                  />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 py-1.5 px-1 shadow-lg overflow-x-auto">
        <div className="flex items-center justify-around">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[50px]',
                  isActive
                    ? 'bg-emerald-900 text-white font-semibold shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 mb-0.5',
                    isActive ? 'text-emerald-200' : 'text-slate-400'
                  )}
                />
                <span className="text-[9px] tracking-tight truncate max-w-[54px]">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
