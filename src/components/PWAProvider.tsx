'use client';

import React, { useEffect, useState } from 'react';
import { Download, CheckCircle2, ShieldCheck, WifiOff } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('PWA ServiceWorker registered successfully:', reg.scope);
          })
          .catch((err) => {
            console.log('PWA ServiceWorker registration failed:', err);
          });
      });
    }

    // Network status listener
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    // Before install prompt listener
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Check if installed
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setIsInstallable(false);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  return (
    <>
      {/* Offline banner */}
      {isOffline && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 sticky top-0 z-50 shadow">
          <WifiOff className="w-4 h-4" />
          <span>You are currently working offline. Invoices, proofs, and ledger balances are synced locally.</span>
        </div>
      )}

      {/* PWA Install Banner */}
      {isInstallable && (
        <div className="bg-emerald-950 border-b border-emerald-800 text-emerald-100 px-4 py-2.5 text-xs flex items-center justify-between sticky top-0 z-40 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
              EM
            </div>
            <span>
              <strong>Install Estate Management PWA</strong> for native camera capture &amp; fast offline ledger access.
            </span>
          </div>
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold px-3 py-1 rounded-md transition shadow text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Install App
          </button>
        </div>
      )}

      {children}
    </>
  );
}
