'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  Download,
  Building,
  Calendar,
  Scale,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  ShieldCheck,
  SendHorizontal,
  Loader2,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';
import { Property, Landlord, Transaction, ChamberProfile } from '@/types/database';
import { INITIAL_PROPERTIES, INITIAL_LANDLORDS, INITIAL_TRANSACTIONS, INITIAL_CHAMBER_PROFILE } from '@/lib/initialData';

export default function StatementPage() {
  const [mounted, setMounted] = useState(false);
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(INITIAL_PROPERTIES[0]?.id || '');
  const [startDate, setStartDate] = useState<string>('2025-10-01');
  const [endDate, setEndDate] = useState<string>('2026-11-30');
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [profile, setProfile] = useState<ChamberProfile>(INITIAL_CHAMBER_PROFILE);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setMounted(true);
    setEndDate(new Date().toISOString().slice(0, 10));

    const loadData = () => {
      const props = EstateStore.getProperties();
      setProperties(props);
      setProfile(EstateStore.getChamberProfile());
      const targetId = selectedPropertyId || (props[0] ? props[0].id : '');
      if (!selectedPropertyId && props[0]) {
        setSelectedPropertyId(props[0].id);
      }
      setTransactions(EstateStore.getTransactions(targetId || undefined));
    };

    loadData();

    const unsub = subscribeToStore(() => {
      loadData();
    });
    return () => unsub();
  }, [selectedPropertyId]);

  const handlePropertyChange = (newId: string) => {
    setSelectedPropertyId(newId);
    if (mounted) {
      setTransactions(EstateStore.getTransactions(newId || undefined));
    }
  };

  const activeProperty =
    properties.find((p) => p.id === selectedPropertyId) || properties[0] || null;
  const landlord = activeProperty?.landlord || null;

  // Transactions for this property & period
  const relevantTx = transactions.filter((t) => {
    const matchesProp = !activeProperty?.id || t.property_id === activeProperty.id;
    const txDate = t.tx_date;
    const matchesDate = (!startDate || txDate >= startDate) && (!endDate || txDate <= endDate);
    return matchesProp && matchesDate;
  });

  // Calculate reconciliation figures
  let grossRent = 0;
  let managementFee = 0;
  let landlordRepairs = 0;
  let remittancesPaid = 0;
  let serviceChargeCollected = 0;

  for (const tx of relevantTx) {
    const amt = Number(tx.amount) || 0;
    if (tx.tx_type === 'RENT_INFLOW') {
      grossRent += amt;
    } else if (tx.tx_type === 'MANAGEMENT_FEE') {
      managementFee += amt;
    } else if (
      tx.tx_type === 'MAINTENANCE_EXPENSE' &&
      tx.funding_source === 'LANDLORD_RENT_POOL'
    ) {
      landlordRepairs += amt;
    } else if (tx.tx_type === 'OWNER_REMITTANCE') {
      remittancesPaid += amt;
    } else if (tx.tx_type === 'SERVICE_CHARGE') {
      serviceChargeCollected += amt;
    }
  }

  // Net Balance Due = Gross Rent - 10% Fee - Repairs - Prior Remittances
  const netLandlordRevenue = grossRent - managementFee - landlordRepairs;
  const netBalanceDue = netLandlordRevenue - remittancesPaid;

  const pdfProps = activeProperty && landlord ? {
    property: activeProperty,
    landlord: landlord,
    transactions: relevantTx,
    startDate,
    endDate,
    profile,
    summary: {
      grossRent,
      managementFee,
      landlordRepairs,
      remittancesPaid,
      netBalanceDue,
      serviceChargeCollected,
    },
  } : null;

  const handleDownloadPdf = async () => {
    if (!pdfProps) return;
    setIsGeneratingPdf(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { LandlordStatementDocument } = await import(
        '@/components/LandlordStatementPDF'
      );

      const blob = await pdf(<LandlordStatementDocument {...pdfProps} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Landlord_Statement_${(activeProperty?.title || 'Estate').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Could not generate PDF. Please use the Print button to print or save as PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <PWAProvider>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12 print:p-0 print:bg-white">
        <div className="print:hidden">
          <Navigation
            selectedPropertyId={selectedPropertyId}
            onPropertyChange={handlePropertyChange}
          />
        </div>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Controls Bar (Hidden on print) */}
          <div className="print:hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                  1-Click Landlord Statement Generator
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Nigerian legal letterhead statement with automatic 10% fee audit &amp; verified bank disbursement schedule.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf || !pdfProps}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-95 disabled:opacity-60 text-white text-xs font-bold shadow-md transition"
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-amber-300" />
                      <span>Download Official PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Select Estate / Property
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => handlePropertyChange(e.target.value)}
                  suppressHydrationWarning
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-medium"
                >
                  <option value="" suppressHydrationWarning>
                    {properties.length === 0 ? 'No Properties Registered' : 'Select Managed Property'}
                  </option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id} suppressHydrationWarning>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Cycle Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Cycle End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
            </div>
          </div>

          {/* Statement Document Canvas (Printable Letterhead) */}
          <div className="bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-10 space-y-6 print:border-none print:shadow-none print:p-0">
            {/* Legal Letterhead */}
            <div className="border-b-2 border-emerald-900 pb-5 text-center space-y-2">
              {mounted && profile?.letterhead_logo_url ? (
                <div className="flex justify-center mb-1">
                  <img
                    src={profile.letterhead_logo_url}
                    alt={profile.firm_name}
                    className="h-16 w-auto max-w-[200px] object-contain drop-shadow-sm"
                  />
                </div>
              ) : null}
              <div className="inline-flex items-center justify-center gap-2 mb-1">
                {(!mounted || !profile?.letterhead_logo_url) && (
                  <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
                    <Scale className="w-5 h-5" />
                  </div>
                )}
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-emerald-950 uppercase" suppressHydrationWarning>
                  {mounted ? profile?.firm_name : 'BARR. T. A. BABATUNDE & ASSOCIATES'}
                </h2>
              </div>
              <p className="text-xs sm:text-sm font-bold text-amber-700 tracking-wide uppercase">
                Legal Practitioners, Estate Solicitors &amp; Real Estate Arbitrators
              </p>
              <p className="text-xs text-slate-500 max-w-xl mx-auto" suppressHydrationWarning>
                Chambers: {mounted ? profile?.office_address : 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria'} • Phone: {mounted ? profile?.phone : '+234 803 555 0192'} • Email: {mounted ? profile?.email : 'chambers@babatundelaw.ng'}
              </p>
            </div>

            {/* Document Title Banner */}
            <div className="bg-slate-100 py-2.5 px-4 rounded-lg text-center">
              <h3 className="font-extrabold text-sm sm:text-base tracking-wide uppercase text-slate-900">
                FORMAL STATEMENT OF ACCOUNT &amp; RENT RECONCILIATION
              </h3>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 uppercase font-semibold text-[10px]">
                  Client / Landlord Profile:
                </span>
                <div className="font-extrabold text-sm text-slate-900" suppressHydrationWarning>
                  {landlord?.name || 'No Landlord Selected'}
                </div>
                <div className="text-slate-600 font-medium" suppressHydrationWarning>
                  <strong>Property:</strong> {activeProperty?.title || 'No Property Selected'}
                </div>
                <div className="text-slate-500 text-[11px]" suppressHydrationWarning>
                  {activeProperty ? `${activeProperty.address}, Lagos` : 'Please register or select a property'}
                </div>
              </div>

              <div className="space-y-1 sm:text-right">
                <span className="text-slate-500 uppercase font-semibold text-[10px]">
                  Accounting Period:
                </span>
                <div className="font-bold text-sm text-slate-900" suppressHydrationWarning>
                  {formatDate(startDate)} to {formatDate(endDate)}
                </div>
                <div className="text-slate-600 text-[11px]">
                  Statutory Management Fee: <strong>10.00% (Rent Inflows Only)</strong>
                </div>
                <div className="text-emerald-700 font-semibold text-[11px]">
                  Trust Pool: Segregated &amp; Audited
                </div>
              </div>
            </div>

            {/* Itemized Transactions Table */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-950 border-b border-slate-300 pb-1">
                1. Schedule of Inflows, Fees &amp; Disbursements
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" suppressHydrationWarning>
                  <thead>
                    <tr className="bg-emerald-950 text-white font-semibold">
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Description &amp; Reference</th>
                      <th className="py-2 px-3">Fund Category</th>
                      <th className="py-2 px-3 text-right">Amount (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200" suppressHydrationWarning>
                    {relevantTx.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">
                          No transactions found within this period.
                        </td>
                      </tr>
                    ) : (
                      relevantTx.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50" suppressHydrationWarning>
                          <td className="py-2 px-3 font-mono text-slate-600" suppressHydrationWarning>
                            {formatDate(tx.tx_date)}
                          </td>
                          <td className="py-2 px-3" suppressHydrationWarning>
                            <span className="font-semibold text-slate-800" suppressHydrationWarning>
                              {tx.description}
                            </span>
                            {tx.reference_note && (
                              <span
                                className="block text-[11px] text-slate-500 font-mono"
                                suppressHydrationWarning
                              >
                                {tx.reference_note}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600" suppressHydrationWarning>
                            {tx.tx_type === 'RENT_INFLOW'
                              ? 'Gross Rent'
                              : tx.tx_type === 'MANAGEMENT_FEE'
                              ? '10% Legal Fee'
                              : tx.tx_type === 'MAINTENANCE_EXPENSE'
                              ? 'Artisan Repair'
                              : tx.tx_type === 'OWNER_REMITTANCE'
                              ? 'Owner Remittance'
                              : tx.tx_type}
                          </td>
                          <td className="py-2 px-3 text-right font-bold" suppressHydrationWarning>
                            <span
                              suppressHydrationWarning
                              className={
                                tx.tx_type === 'MAINTENANCE_EXPENSE' ||
                                tx.tx_type === 'OWNER_REMITTANCE'
                                  ? 'text-rose-600'
                                  : tx.tx_type === 'MANAGEMENT_FEE'
                                  ? 'text-amber-600'
                                  : 'text-emerald-700'
                              }
                            >
                              {tx.tx_type === 'MAINTENANCE_EXPENSE' ||
                              tx.tx_type === 'OWNER_REMITTANCE'
                                ? '-'
                                : '+'}
                              {formatNaira(tx.amount)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reconciliation Summary Card */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-300 space-y-2 text-xs" suppressHydrationWarning>
              <h4 className="font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                2. Financial Reconciliation &amp; Landlord Net Settlement
              </h4>

              <div className="flex justify-between py-1">
                <span className="text-slate-600">Total Gross Rent Collections:</span>
                <span className="font-bold text-slate-900" suppressHydrationWarning>
                  +{formatNaira(grossRent)}
                </span>
              </div>

              <div className="flex justify-between py-1 text-amber-700">
                <span>Less: Solicitor Agreed Legal Management Fee:</span>
                <span className="font-bold" suppressHydrationWarning>-{formatNaira(managementFee)}</span>
              </div>

              <div className="flex justify-between py-1 text-rose-700">
                <span>Less: Landlord-Funded Repairs &amp; Maintenance:</span>
                <span className="font-bold" suppressHydrationWarning>-{formatNaira(landlordRepairs)}</span>
              </div>

              <div className="flex justify-between py-1 border-t border-slate-200 font-semibold text-slate-800">
                <span>Net Rent Revenue:</span>
                <span suppressHydrationWarning>{formatNaira(netLandlordRevenue)}</span>
              </div>

              <div className="flex justify-between py-1 text-indigo-700">
                <span>Less: Owner Remittances Paid to Date:</span>
                <span className="font-bold" suppressHydrationWarning>-{formatNaira(remittancesPaid)}</span>
              </div>

              <div className="flex justify-between py-2 border-t-2 border-emerald-900 text-sm font-black text-emerald-950">
                <span>NET BALANCE PAYABLE TO LANDLORD:</span>
                <span className="text-base text-emerald-800" suppressHydrationWarning>
                  {formatNaira(netBalanceDue)}
                </span>
              </div>
            </div>

            {/* Verified Landlord Bank Disbursement Details */}
            {landlord && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-xs space-y-1" suppressHydrationWarning>
                <div className="font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-700" />
                  Landlord Verified Disbursement Bank Account
                </div>
                <div className="text-emerald-800 flex flex-wrap gap-4 text-xs pt-1">
                  <div>
                    <strong>Bank:</strong> {landlord.bank_name}
                  </div>
                  <div>
                    <strong>Account Number:</strong>{' '}
                    <span className="font-mono font-bold text-emerald-950">
                      {landlord.account_number}
                    </span>
                  </div>
                  <div>
                    <strong>Account Name:</strong> {landlord.account_name}
                  </div>
                </div>
              </div>
            )}

            {/* Formal Legal Certification & Signatures */}
            <div className="pt-8 border-t border-slate-300 flex flex-col sm:flex-row justify-between gap-6 text-xs">
              <div className="space-y-1">
                <div className="w-48 border-b-2 border-slate-800 pb-8"></div>
                <p className="font-bold text-slate-900" suppressHydrationWarning>
                  {mounted ? profile?.solicitor_name : 'Barr. T. A. Babatunde, LL.B, B.L'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Principal Solicitor &amp; Estate Advocate
                </p>
                <p className="text-[10px] text-slate-400" suppressHydrationWarning>
                  Supreme Court Enrolment: {mounted ? profile?.enrollment_no : 'SCN/2004/0981'}
                </p>
              </div>

              <div className="sm:text-right space-y-1">
                <div className="inline-block p-2 rounded border border-amber-400 bg-amber-50 text-[10px] text-amber-900 font-bold mb-1">
                  OFFICIAL CHAMBERS SEAL
                </div>
                <p className="font-bold text-slate-800" suppressHydrationWarning>
                  Date Issued: {formatDate(endDate)}
                </p>
                <p className="text-[11px] text-slate-500">Lagos State Tenancy Law Compliant</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </PWAProvider>
  );
}
