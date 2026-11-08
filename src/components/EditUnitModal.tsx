'use client';

import React, { useState, useEffect } from 'react';
import {
  Pencil,
  X,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  UserCheck,
  Calendar,
  Home,
} from 'lucide-react';
import { Unit } from '@/types/database';
import { EstateStore } from '@/lib/store';

interface EditUnitModalProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updatedUnit: Unit) => void;
}

export function EditUnitModal({
  unit,
  isOpen,
  onClose,
  onSuccess,
}: EditUnitModalProps) {
  const [unitName, setUnitName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [annualRent, setAnnualRent] = useState<number>(0);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [cautionFee, setCautionFee] = useState<number>(0);
  const [leaseStartDate, setLeaseStartDate] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (unit && isOpen) {
      const todayIso = new Date().toISOString().split('T')[0];
      const nextYearIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      setUnitName(unit.unit_name || '');
      setTenantName(unit.current_tenant_name || '');
      setTenantPhone(unit.tenant_phone || '');
      setTenantEmail(unit.tenant_email || '');
      setAnnualRent(Number(unit.annual_rent) || 0);
      setServiceCharge(Number(unit.annual_service_charge) || 0);
      setCautionFee(Number(unit.caution_fee) || 0);
      setLeaseStartDate(unit.lease_start_date || todayIso);
      setLeaseEndDate(unit.lease_end_date || nextYearIso);
      setErrorMessage(null);
    }
  }, [unit, isOpen]);

  if (!isOpen || !unit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!unitName.trim()) {
      setErrorMessage('Unit Designation / Flat Name is required.');
      return;
    }

    if (!leaseStartDate || !leaseEndDate) {
      setErrorMessage('Both Lease Start Date and Lease End Date are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await EstateStore.updateUnit(unit.id, {
        unit_name: unitName.trim(),
        current_tenant_name: tenantName.trim() || null,
        tenant_phone: tenantPhone.trim() || null,
        tenant_email: tenantEmail.trim() || null,
        annual_rent: parseFloat(String(annualRent)) || 0,
        annual_service_charge: parseFloat(String(serviceCharge)) || 0,
        caution_fee: parseFloat(String(cautionFee)) || 0,
        lease_start_date: leaseStartDate,
        lease_end_date: leaseEndDate,
        is_occupied: Boolean(tenantName.trim()),
      });

      if (updated && onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err: any) {
      console.error('Error updating tenancy unit:', err);
      setErrorMessage(err?.message || 'Could not update tenancy unit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 max-w-lg w-full p-6 my-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-300">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Edit Tenancy Unit
              </h3>
              <p className="text-xs text-slate-500">
                Update occupant profile, financial terms, and lease dates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Unit Designation / Flat Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Unit Designation / Flat Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Home className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="text"
                required
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="e.g. Flat 4 (3-Bedroom) or Wing B"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm py-2.5 pl-10 pr-3.5 transition-all"
              />
            </div>
          </div>

          {/* 2 & 3. Tenant Full Name & Phone Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tenant Full Name
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="Leave empty if vacant"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm py-2.5 pl-10 pr-3.5 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tenant Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="tel"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm py-2.5 pl-10 pr-3.5 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 4. Tenant Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Tenant Email Address{' '}
              <span className="text-[11px] font-normal text-slate-400">
                (Used for automated Zoho email reminders)
              </span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
              <input
                type="email"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                placeholder="tenant@example.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm py-2.5 pl-10 pr-3.5 transition-all"
              />
            </div>
          </div>

          {/* 5, 6, 7. Financial Amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Annual Rent (₦) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                value={annualRent}
                onChange={(e) => setAnnualRent(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm font-semibold tabular-nums py-2.5 px-3 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Service Charge (₦)
              </label>
              <input
                type="number"
                min="0"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm font-semibold tabular-nums py-2.5 px-3 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Caution Fee (₦)
              </label>
              <input
                type="number"
                min="0"
                value={cautionFee}
                onChange={(e) => setCautionFee(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm font-semibold tabular-nums py-2.5 px-3 transition-all"
              />
            </div>
          </div>

          {/* 8 & 9. Lease Start & End Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Lease Start Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={leaseStartDate}
                  onChange={(e) => setLeaseStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm py-2.5 pl-10 pr-3 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Lease End Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={leaseEndDate}
                  onChange={(e) => setLeaseEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm py-2.5 pl-10 pr-3 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl px-4 py-2.5 text-sm transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl px-5 py-2.5 text-sm shadow-sm transition-all disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                  <span>Updating Unit...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
