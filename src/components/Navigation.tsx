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
  Scale,
  RefreshCw,
  Database,
  ExternalLink,
  ShieldCheck,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { INITIAL_PROPERTIES, INITIAL_CHAMBER_PROFILE } from '@/lib/initialData';
import { Property, ChamberProfile } from '@/types/database';
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
    setProperties(EstateStore.getProperties());
    setProfile(EstateStore.getChamberProfile());
    const unsub = subscribeToStore(() => {
      setProperties(EstateStore.getProperties());
      setProfile(EstateStore.getChamberProfile());
    });
    return () => unsub();
  }, []);

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/properties', label: 'Properties', icon: Building2 },
    { href: '/invoices', label: 'Rent Demands', icon: Receipt },
    { href: '/expenses', label: 'Artisan Expenses', icon: Wrench },
    { href: '/statement', label: 'Landlord Statement', icon: FileText },
    { href: '/settings', label: 'Firm Branding', icon: Settings },
  ];

  const handleReset = () => {
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

  return (
    <header className="sticky top-0 z-30 bg-emerald-950 text-white shadow-md border-b border-emerald-800">
      {/* Top Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Logo & Legal Title */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-emerald-950 shadow-md group-hover:scale-105 transition transform overflow-hidden p-1">
              {mounted && profile?.letterhead_logo_url ? (
                <img
                  src={profile.letterhead_logo_url}
                  alt={profile.firm_name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-6 h-6 stroke-[2.2]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white">
                  ESTATE<span className="text-amber-400">MANAGEMENT</span>
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-800 text-emerald-200 border border-emerald-700">
                  PROPERTY PORTAL
                </span>
              </div>
              <p className="text-[11px] text-emerald-300 font-medium hidden sm:block truncate max-w-sm">
                {mounted && profile?.firm_name ? profile.firm_name : 'Estate Management'} • Property Ledgers &amp; Accounts
              </p>
            </div>
          </Link>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Property Selector */}
            {onPropertyChange && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-400 hidden sm:block" />
                <select
                  value={selectedPropertyId || ''}
                  onChange={(e) => onPropertyChange(e.target.value)}
                  suppressHydrationWarning
                  className="bg-emerald-900 border border-emerald-700 text-emerald-100 text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-amber-500 focus:outline-none max-w-[160px] sm:max-w-[220px]"
                >
                  <option value="" suppressHydrationWarning>All Managed Properties</option>
                  {(mounted ? properties : INITIAL_PROPERTIES).map((p) => (
                    <option key={p.id} value={p.id} suppressHydrationWarning>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Supabase Status Pill */}
            <div
              title={
                isSupabaseConfigured
                  ? 'Connected to live Supabase PostgreSQL'
                  : 'Operating in Local Storage Reactive Mode'
              }
              suppressHydrationWarning
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-900/80 border border-emerald-700 text-emerald-300"
            >
              <Database className="w-3 h-3 text-amber-400" />
              <span suppressHydrationWarning>
                {mounted ? (isSupabaseConfigured ? 'Supabase Live' : 'PWA Local Vault') : 'Supabase Live'}
              </span>
            </div>

            {/* Reset / Clear Local State Button */}
            <button
              onClick={handleReset}
              title="Clear local application cache and refresh"
              className="p-1.5 text-emerald-300 hover:text-white hover:bg-emerald-800 rounded-lg text-xs flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Cache</span>
            </button>

            {/* Manager Sign Out */}
            <button
              onClick={handleSignOut}
              title="Sign out of management portal"
              className="p-1.5 text-rose-300 hover:text-white hover:bg-rose-900/60 rounded-lg text-xs flex items-center gap-1 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Navigation Links */}
      <nav className="hidden md:block bg-emerald-900/90 border-t border-emerald-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition',
                    isActive
                      ? 'bg-emerald-800 text-amber-300 shadow-sm border border-emerald-700'
                      : 'text-emerald-200 hover:bg-emerald-800/50 hover:text-white'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-amber-400' : 'text-emerald-400')} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (Fixed for PWA mobile experience) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-emerald-950 border-t border-emerald-800 py-1.5 px-2 shadow-2xl">
        <div className="flex items-center justify-around">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex flex-col items-center justify-center py-1 px-2 rounded-lg transition min-w-[58px]',
                  isActive ? 'text-amber-400 font-bold' : 'text-emerald-300/80 hover:text-white'
                )}
              >
                <Icon className={cn('w-5 h-5 mb-0.5', isActive ? 'text-amber-400' : 'text-emerald-300')} />
                <span className="text-[10px] tracking-tight">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
