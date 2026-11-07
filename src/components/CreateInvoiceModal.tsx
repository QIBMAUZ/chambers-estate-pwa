'use client';

import React, { useState, useEffect } from 'react';
import { X, Receipt, Calculator, Share2, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { EstateStore } from '@/lib/store';
import { formatNaira, generateWhatsAppDemandText, buildWhatsAppShareUrl } from '@/lib/utils';
import { Property, Unit } from '@/types/database';

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
  const properties = EstateStore.getProperties();
  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId || properties[0]?.id || '');
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  
  // Form fields
  const [tenantName, setTenantName] = useState('');
  const [rentType, setRentType] = useState<'ST_RENT' | 'NEW_RENT'>('ST_RENT');
  const [rentDue, setRentDue] = useState<number>(3500000);
  const [serviceChargeDue, setServiceChargeDue] = useState<number>(100000); // Typical default ₦100k
  const [cautionDue, setCautionDue] = useState<number>(0);
  const [mgtFeeRate, setMgtFeeRate] = useState<number>(10.0);
  const [dueDate, setDueDate] = useState<string>('2026-11-15');
  const [periodStart, setPeriodStart] = useState<string>('2026-11-01');
  const [periodEnd, setPeriodEnd] = useState<string>('2027-10-31');

  useEffect(() => {
    // Initialize dates dynamically on client mount
    const today = new Date();
    const dDue = new Date();
    dDue.setDate(dDue.getDate() + 14);
    setDueDate(dDue.toISOString().slice(0, 10));
    setPeriodStart(today.toISOString().slice(0, 10));
    const dEnd = new Date();
    dEnd.setFullYear(dEnd.getFullYear() + 1);
    setPeriodEnd(dEnd.toISOString().slice(0, 10));
  }, []);

  // Success state with WhatsApp demand link
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
        setCautionDue(Number(propUnits[0].caution_fee) || 0);
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
      setCautionDue(Number(unit.caution_fee) || 0);
    }
  };

  // Legal management calculation logic
  const legalFeeAmount = rentDue * (mgtFeeRate / 100);
  const landlordNetAfterFee = rentDue - legalFeeAmount;
  const totalPayable = Number(rentDue) + Number(serviceChargeDue || 0) + Number(cautionDue || 0);

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
      rent_due: rentDue,
      service_charge_due: serviceChargeDue,
      caution_due: cautionDue,
      management_fee_rate: mgtFeeRate,
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
                Generate Rent Demand Notice
              </h3>
              <p className="text-xs text-emerald-300">
                10% Legal Management Fee auto-calculated on Rent Inflow only
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

        {/* Content */}
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
                Demand notice has been logged to the ledger. Total payable:{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {formatNaira(totalPayable)}
                </strong>
              </p>
            </div>

            {/* Magic Link Box */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 block">
                Tenant Self-Service Magic Link:
              </span>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={`${process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')}/pay/${createdInvoiceToken}`}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs rounded px-3 py-2 w-full text-slate-600 dark:text-slate-300 select-all"
                />
              </div>
            </div>

            {/* Actions */}
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
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Rent Inflow Type Toggle */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Lease Tenancy Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRentType('ST_RENT')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition ${
                    rentType === 'ST_RENT'
                      ? 'bg-emerald-800 text-amber-300 border-emerald-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  ST RENT (Sitting Tenant Renewal)
                </button>
                <button
                  type="button"
                  onClick={() => setRentType('NEW_RENT')}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition ${
                    rentType === 'NEW_RENT'
                      ? 'bg-emerald-800 text-amber-300 border-emerald-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  NEW RENT (New Lease Agreement)
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
                  suppressHydrationWarning
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled suppressHydrationWarning>
                    {properties.length === 0 ? 'No properties registered' : 'Select Property'}
                  </option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id} suppressHydrationWarning>
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
                  className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>
                    {units.length === 0 ? 'No units registered' : 'Select Unit'}
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_name} {u.current_tenant_name ? `(${u.current_tenant_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tenant Name */}
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
                className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Financial Inflow Breakdown */}
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                Gross Inflow Itemization (₦)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Rent */}
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
                    className="w-full text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* 2. Management Fee Rate */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Management Fee Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={mgtFeeRate}
                    onChange={(e) => setMgtFeeRate(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500 text-amber-600 dark:text-amber-400"
                  />
                </div>

                {/* 3. Service Charge */}
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
                    className="w-full text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* 4. Caution */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Caution Deposit (Escrow)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={cautionDue}
                    onChange={(e) => setCautionDue(Number(e.target.value))}
                    className="w-full text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Automatic Accounting Rules Preview */}
              <div className="bg-emerald-950 text-emerald-100 p-3 rounded-lg text-xs space-y-1.5 border border-emerald-800">
                <div className="flex justify-between items-center text-amber-300 font-bold border-b border-emerald-800 pb-1">
                  <span>Gross Inflow Payable by Tenant:</span>
                  <span className="text-sm">{formatNaira(totalPayable)}</span>
                </div>
                <div className="flex justify-between text-emerald-200">
                  <span>• Lawyer {mgtFeeRate}% Legal Management Fee:</span>
                  <span className="font-semibold text-amber-300">{formatNaira(legalFeeAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-200">
                  <span>• Landlord Net Rent Pool:</span>
                  <span className="font-semibold">{formatNaira(landlordNetAfterFee)}</span>
                </div>
                <div className="flex justify-between text-emerald-200">
                  <span>• Earmarked to Estate S/Charge Pool:</span>
                  <span className="font-semibold">{formatNaira(serviceChargeDue)}</span>
                </div>
                {cautionDue > 0 && (
                  <div className="flex justify-between text-emerald-200">
                    <span>• Earmarked to Caution Escrow:</span>
                    <span className="font-semibold">{formatNaira(cautionDue)}</span>
                  </div>
                )}
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

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"
              >
                <span>Generate Demand Notice & Magic Link</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
