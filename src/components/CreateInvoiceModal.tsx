'use client';

import React, { useState, useEffect } from 'react';
import { X, Receipt, Calculator, Share2, Check, ArrowRight, Scale } from 'lucide-react';
import { EstateStore } from '@/lib/store';
import { formatNaira, generateWhatsAppDemandText, buildWhatsAppShareUrl } from '@/lib/utils';
import { TenancyType, Unit } from '@/types/database';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPropertyId?: string;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  defaultPropertyId,
}: CreateInvoiceModalProps) {
  const properties = EstateStore.getProperties(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId || properties[0]?.id || '');
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');

  // Form fields
  const [tenantName, setTenantName] = useState('');
  const [tenancyType, setTenancyType] = useState<TenancyType>('RENEWAL');
  const [rentDue, setRentDue] = useState<number>(3500000);
  const [serviceChargeDue, setServiceChargeDue] = useState<number>(100000);
  const [cautionDue, setCautionDue] = useState<number>(0);
  const [mgtFeeRate, setMgtFeeRate] = useState<number>(10.0);
  const [dueDate, setDueDate] = useState<string>('2026-11-15');
  const [promiseToPayDate, setPromiseToPayDate] = useState<string>('');
  const [periodStart, setPeriodStart] = useState<string>('2026-11-01');
  const [periodEnd, setPeriodEnd] = useState<string>('2027-10-31');

  useEffect(() => {
    const today = new Date();
    const dDue = new Date();
    dDue.setDate(dDue.getDate() + 14);
    setDueDate(dDue.toISOString().slice(0, 10));
    setPeriodStart(today.toISOString().slice(0, 10));
    const dEnd = new Date();
    dEnd.setFullYear(dEnd.getFullYear() + 1);
    setPeriodEnd(dEnd.toISOString().slice(0, 10));
  }, []);

  const [createdInvoiceToken, setCreatedInvoiceToken] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPropertyId) {
      const prop = properties.find((p) => p.id === selectedPropertyId);
      if (prop?.landlord?.default_mgt_rate) {
        setMgtFeeRate(Number(prop.landlord.default_mgt_rate));
      }
      const propUnits = EstateStore.getUnits(selectedPropertyId);
      setUnits(propUnits);
      if (propUnits.length > 0) {
        setSelectedUnitId(propUnits[0].id);
        setTenantName(propUnits[0].current_tenant_name || '');
        setRentDue(Number(propUnits[0].annual_rent) || 3500000);
        setServiceChargeDue(Number(propUnits[0].annual_service_charge) || 100000);
        setCautionDue(tenancyType === 'FIRST_YEAR' ? Number(propUnits[0].caution_fee) || 0 : 0);
      } else {
        setSelectedUnitId('');
        setTenantName('');
      }
    }
  }, [selectedPropertyId]);

  const handleUnitChange = (unitId: string) => {
    setSelectedUnitId(unitId);
    const unit = units.find((u) => u.id === unitId);
    if (unit) {
      setTenantName(unit.current_tenant_name || '');
      setRentDue(Number(unit.annual_rent) || 0);
      setServiceChargeDue(Number(unit.annual_service_charge) || 100000);
      setCautionDue(tenancyType === 'FIRST_YEAR' ? Number(unit.caution_fee) || 0 : 0);
    }
  };

  // Requirement 5 Accounting Rules:
  // FIRST_YEAR: 10% Legal/Agreement Fee billed to tenant (100% to Law Firm), 0% Landlord Management Fee
  // RENEWAL: 0 Tenant Legal Fee, 10% Management Fee deducted from Landlord Rent
  const tenantLegalFeeDue = tenancyType === 'FIRST_YEAR' ? Math.round(Number(rentDue || 0) * 0.1) : 0;
  const effectiveLandlordMgtRate = tenancyType === 'FIRST_YEAR' ? 0 : mgtFeeRate;
  const landlordMgtFeeDeduction = Math.round(Number(rentDue || 0) * (effectiveLandlordMgtRate / 100));
  const landlordNetAfterFee = Number(rentDue || 0) - landlordMgtFeeDeduction;
  const totalPayable =
    Number(rentDue || 0) +
    tenantLegalFeeDue +
    Number(serviceChargeDue || 0) +
    Number(cautionDue || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || !selectedUnitId || !tenantName || rentDue <= 0) {
      alert('Please complete all required fields.');
      return;
    }

    const newInvoice = await EstateStore.createInvoice({
      property_id: selectedPropertyId,
      unit_id: selectedUnitId,
      tenant_name: tenantName,
      tenancy_type: tenancyType,
      rent_due: rentDue,
      service_charge_due: serviceChargeDue,
      caution_due: cautionDue,
      management_fee_rate: effectiveLandlordMgtRate,
      promise_to_pay_date: promiseToPayDate || null,
      due_date: dueDate,
      period_start: periodStart,
      period_end: periodEnd,
    });

    setCreatedInvoiceToken(newInvoice.access_token);
  };

  const handleClose = () => {
    setCreatedInvoiceToken(null);
    onClose();
  };

  if (!isOpen) return null;

  const currentProperty = properties.find((p) => p.id === selectedPropertyId);
  const currentUnit = units.find((u) => u.id === selectedUnitId);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Generate Rent Demand / Move-In Invoice
              </h3>
              <p className="text-xs text-emerald-300">
                First-Year 10% Tenant Legal Fee vs Renewal 10% Landlord Management Fee
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-emerald-300 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdInvoiceToken ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Rent Demand Notice Created!
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Demand notice logged to ledger ({tenancyType}). Total payable:{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {formatNaira(totalPayable)}
                </strong>
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                Tenant Self-Service Magic Link:
              </span>
              <input
                readOnly
                value={`${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/pay/${createdInvoiceToken}`}
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs rounded px-3 py-2 w-full text-slate-600 dark:text-slate-300 select-all"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {(() => {
                const profile = EstateStore.getChamberProfile();
                const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                const paymentLink = `${appBaseUrl}/pay/${createdInvoiceToken}`;

                return (
                  <a
                    href={buildWhatsAppShareUrl(
                      currentUnit?.tenant_phone,
                      generateWhatsAppDemandText({
                        tenantName,
                        propertyTitle: currentProperty?.title || 'Estate',
                        unitName: currentUnit?.unit_name || 'Unit',
                        rentDue,
                        serviceChargeDue,
                        cautionDue,
                        totalDue: totalPayable,
                        dueDate,
                        paymentLink,
                        accountDetails: {
                          bankName: profile.bank_name || currentProperty?.landlord?.bank_name || 'Zenith Bank PLC',
                          accountNumber: profile.account_number || currentProperty?.landlord?.account_number || '1012345678',
                          accountName: profile.account_name || currentProperty?.landlord?.account_name || profile.firm_name,
                        },
                        firmName: profile.firm_name,
                        solicitorName: profile.solicitor_name,
                      })
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold px-4 py-2.5 rounded-xl shadow transition"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share via WhatsApp</span>
                  </a>
                );
              })()}
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            {/* Requirement 5: Tenancy Fee Rule Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Tenancy Billing Category (Requirement 5)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTenancyType('RENEWAL')}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl border text-left transition ${
                    tenancyType === 'RENEWAL'
                      ? 'bg-emerald-900 text-amber-300 border-emerald-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="font-extrabold">RENEWAL TENANCY</div>
                  <div className="text-[10px] opacity-85 font-normal">
                    ₦0 Tenant Legal Fee • 10% Mgt Fee deducted from Landlord Rent
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTenancyType('FIRST_YEAR')}
                  className={`py-2.5 px-3 text-xs font-bold rounded-xl border text-left transition ${
                    tenancyType === 'FIRST_YEAR'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="font-extrabold">FIRST_YEAR (New Intake)</div>
                  <div className="text-[10px] opacity-90 font-normal">
                    +10% Tenant Legal Fee (100% to Law Firm) • 0% Landlord Mgt Fee
                  </div>
                </button>
              </div>
            </div>

            {/* Property & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Property
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unit / Tenancy
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_name} {u.current_tenant_name ? `(${u.current_tenant_name})` : '(VACANT)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tenant Full Name / Legal Entity
              </label>
              <input
                type="text"
                required
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="e.g. Dr. Babatunde Sanusi"
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
              />
            </div>

            {/* Financial Inflow Breakdown */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                Assessment Itemization (₦)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Annual Rent (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    required
                    value={rentDue}
                    onChange={(e) => setRentDue(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Estate S/Charge (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={serviceChargeDue}
                    onChange={(e) => setServiceChargeDue(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Caution Deposit (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={cautionDue}
                    onChange={(e) => setCautionDue(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                  />
                </div>
              </div>

              {/* Automatic Accounting Rules Preview */}
              <div className="bg-emerald-950 text-emerald-100 p-3.5 rounded-lg text-xs space-y-1.5 border border-emerald-800">
                <div className="flex justify-between items-center text-amber-300 font-bold border-b border-emerald-800 pb-1">
                  <span>Total Invoice Payable by Tenant:</span>
                  <span className="text-sm">{formatNaira(totalPayable)}</span>
                </div>

                {tenancyType === 'FIRST_YEAR' ? (
                  <>
                    <div className="flex justify-between text-amber-300 font-semibold">
                      <span>• +10% First-Year Legal/Agreement Fee (Billed to Tenant → 100% Firm):</span>
                      <span>{formatNaira(tenantLegalFeeDue)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-200">
                      <span>• Landlord Management Fee Deduction:</span>
                      <span className="font-bold text-emerald-300">₦0.00 (0% on First-Year)</span>
                    </div>
                    <div className="flex justify-between text-emerald-200">
                      <span>• Net Rent Credited to Landlord Pool:</span>
                      <span className="font-bold text-white">{formatNaira(rentDue)} (100%)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-emerald-200">
                      <span>• Tenant Legal/Agreement Fee Billed:</span>
                      <span className="font-semibold">₦0.00 (Exempt on Renewal)</span>
                    </div>
                    <div className="flex justify-between text-amber-300 font-semibold">
                      <span>• {effectiveLandlordMgtRate}% Renewal Management Fee (Deducted from Rent → Firm):</span>
                      <span>{formatNaira(landlordMgtFeeDeduction)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-200">
                      <span>• Net Rent Credited to Landlord Pool:</span>
                      <span className="font-bold text-white">{formatNaira(landlordNetAfterFee)}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between text-emerald-200">
                  <span>• Earmarked to Estate S/Charge Pool:</span>
                  <span className="font-semibold">{formatNaira(serviceChargeDue)}</span>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lease Period Start
                </label>
                <input
                  type="date"
                  required
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lease Period End
                </label>
                <input
                  type="date"
                  required
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
              >
                <span>Generate Demand Notice &amp; Magic Link</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
