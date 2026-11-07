'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Home,
  UserCheck,
  Calendar,
  CreditCard,
  Phone,
  Mail,
  ShieldCheck,
  X,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatNaira, formatDate } from '@/lib/utils';
import { Property, Unit, Landlord } from '@/types/database';

export default function PropertiesPage() {
  const [mounted, setMounted] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Add Unit modal
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [modalPropertyId, setModalPropertyId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newUnitName, setNewUnitName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [annualRent, setAnnualRent] = useState<number>(4000000);
  const [serviceCharge, setServiceCharge] = useState<number>(100000);
  const [cautionFee, setCautionFee] = useState<number>(200000);
  const [leaseStart, setLeaseStart] = useState<string>('2026-11-01');
  const [leaseEnd, setLeaseEnd] = useState<string>('2027-10-31');

  // Add Property modal
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isPropSubmitting, setIsPropSubmitting] = useState(false);
  const [propErrorMessage, setPropErrorMessage] = useState<string | null>(null);
  const [propTitle, setPropTitle] = useState('');
  const [propAddress, setPropAddress] = useState('');
  const [propState, setPropState] = useState('Lagos');
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');
  const [landlordBank, setLandlordBank] = useState('Zenith Bank PLC');
  const [landlordAccountNo, setLandlordAccountNo] = useState('');
  const [landlordAccountName, setLandlordAccountName] = useState('');
  const [landlordMgtRate, setLandlordMgtRate] = useState<number>(10.0);

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    setLeaseStart(today.toISOString().slice(0, 10));
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setLeaseEnd(nextYear.toISOString().slice(0, 10));
  }, []);

  const refreshData = () => {
    const props = EstateStore.getProperties();
    setProperties(props);
    if (props.length > 0) {
      setSelectedPropertyId((prev) => prev || props[0].id);
      setModalPropertyId((prev) => prev || props[0].id);
    } else {
      setSelectedPropertyId('');
      setModalPropertyId('');
    }
    setUnits(EstateStore.getUnits());
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeToStore(() => refreshData());
    return () => unsub();
  }, []);

  const activeProperty = properties.find((p) => p.id === selectedPropertyId) || properties[0] || null;
  const propertyUnits = units.filter((u) => u.property_id === activeProperty?.id);

  const handleOpenAddUnit = () => {
    if (properties.length === 0) {
      alert('You must add a property (estate/building) before adding tenancy flats.');
      setPropErrorMessage(null);
      setIsAddPropertyOpen(true);
      return;
    }
    setModalPropertyId(selectedPropertyId || properties[0]?.id || '');
    setErrorMessage(null);
    setIsAddUnitOpen(true);
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propTitle.trim() || !propAddress.trim() || !landlordName.trim()) {
      alert('Please enter Property Title, Address, and Landlord Name.');
      return;
    }

    setIsPropSubmitting(true);
    setPropErrorMessage(null);

    try {
      // 1. Create or retrieve Landlord
      const newLandlord = await EstateStore.createLandlord({
        name: landlordName.trim(),
        phone: landlordPhone.trim() || null,
        email: landlordEmail.trim() || null,
        bank_name: landlordBank.trim() || 'Zenith Bank PLC',
        account_number: landlordAccountNo.trim() || '',
        account_name: landlordAccountName.trim() || landlordName.trim(),
        default_mgt_rate: Number(landlordMgtRate) || 10.0,
      });

      // 2. Create Property
      const newProperty = await EstateStore.createProperty({
        landlord_id: newLandlord.id,
        title: propTitle.trim(),
        address: propAddress.trim(),
        state: propState.trim() || 'Lagos',
      });

      setSelectedPropertyId(newProperty.id);
      setModalPropertyId(newProperty.id);
      setIsAddPropertyOpen(false);

      // Reset form
      setPropTitle('');
      setPropAddress('');
      setLandlordName('');
      setLandlordPhone('');
      setLandlordEmail('');
      setLandlordAccountNo('');
      setLandlordAccountName('');

      alert('Property and Landlord registered successfully!');
    } catch (err: any) {
      console.error('Error creating property:', err);
      const msg = err?.message || 'Database error: Could not register property.';
      setPropErrorMessage(msg);
      alert(`Error registering property: ${msg}`);
    } finally {
      setIsPropSubmitting(false);
    }
  };

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPropertyId = modalPropertyId || activeProperty?.id || selectedPropertyId;
    if (!targetPropertyId) {
      alert('Please create a property before adding units.');
      return;
    }
    if (!newUnitName.trim()) {
      alert('Please enter a unit designation or flat name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let managerId: string | undefined = undefined;
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          managerId = user?.id;
        } catch (authErr) {
          console.warn('Could not read user in properties page:', authErr);
        }
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const nextYearIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const effectiveStartDate = leaseStart || todayIso;
      const effectiveEndDate = leaseEnd || nextYearIso;

      await EstateStore.createUnit({
        property_id: targetPropertyId,
        manager_id: managerId,
        unit_name: newUnitName.trim(),
        current_tenant_name: tenantName.trim() || null,
        tenant_phone: tenantPhone.trim() || null,
        tenant_email: tenantEmail.trim() || null,
        annual_rent: parseFloat(String(annualRent)) || 0,
        annual_service_charge: parseFloat(String(serviceCharge)) || 0,
        caution_fee: parseFloat(String(cautionFee)) || 0,
        lease_start_date: effectiveStartDate,
        lease_end_date: effectiveEndDate,
        is_occupied: Boolean(tenantName.trim()),
      });

      setSelectedPropertyId(targetPropertyId);
      setIsAddUnitOpen(false);
      setNewUnitName('');
      setTenantName('');
      setTenantPhone('');
      setTenantEmail('');
    } catch (err: any) {
      console.error('Error saving unit:', err);
      const msg = err?.message || 'Database error: Could not save tenancy unit.';
      setErrorMessage(msg);
      alert(`Error saving tenancy unit: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PWAProvider>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12">
        <Navigation
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={setSelectedPropertyId}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                Managed Estates &amp; Tenancy Units
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Lagos properties under formal legal management with verified landlord bank disbursement accounts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setPropErrorMessage(null);
                  setIsAddPropertyOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-emerald-950 font-bold px-4 py-2.5 rounded-xl shadow transition text-xs sm:text-sm"
              >
                <Building2 className="w-4 h-4" />
                <span>+ Register Property</span>
              </button>
              <button
                onClick={handleOpenAddUnit}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl shadow transition text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Tenancy Unit</span>
              </button>
            </div>
          </div>

          {/* Property Selector Tabs */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {properties.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPropertyId(p.id)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition border ${
                  activeProperty?.id === p.id
                    ? 'bg-emerald-950 text-amber-300 border-emerald-800 shadow-md'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>

          {/* Active Property & Landlord Profile Card */}
          {activeProperty && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                    Property Location &amp; Legal Title
                  </span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                    {activeProperty.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeProperty.address}, {activeProperty.state} State, Nigeria
                  </p>
                </div>

                {/* Landlord Bank Card */}
                {activeProperty.landlord && (
                  <div className="bg-emerald-950 text-emerald-100 p-3.5 rounded-xl border border-emerald-800 text-xs space-y-1 sm:min-w-[320px]">
                    <div className="flex items-center justify-between font-bold text-amber-300">
                      <span>Owner / Landlord</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const currentRate = activeProperty.landlord?.default_mgt_rate ?? 10;
                          const input = prompt(
                            'Enter customized Legal Management Fee Rate (%) for this Landlord:',
                            String(currentRate)
                          );
                          if (input !== null) {
                            const parsed = parseFloat(input);
                            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                              await EstateStore.updateLandlord(activeProperty.landlord!.id, {
                                default_mgt_rate: parsed,
                              });
                              refreshData();
                            } else {
                              alert('Please enter a valid rate between 0 and 100.');
                            }
                          }
                        }}
                        title="Click to customize Legal Management Fee rate for this landlord"
                        className="text-[10px] bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-emerald-200 hover:text-white px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 border border-emerald-700"
                      >
                        <span>{activeProperty.landlord.default_mgt_rate ?? 10}% Mgt Fee</span>
                        <span className="text-amber-400 font-bold">✎</span>
                      </button>
                    </div>
                    <div className="font-semibold text-white">{activeProperty.landlord.name}</div>
                    <div className="text-[11px] text-emerald-300 flex items-center justify-between">
                      <span>{activeProperty.landlord.bank_name}</span>
                      <span className="font-mono font-bold text-amber-300">
                        {activeProperty.landlord.account_number}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-400">
                      Acc: {activeProperty.landlord.account_name}
                    </div>
                  </div>
                )}
              </div>

              {/* Units Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Tenancy Units ({propertyUnits.length})
                  </h3>
                  <span className="text-xs text-slate-500">
                    Showing occupied leases &amp; annual rent structures
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {propertyUnits.map((u) => (
                    <div
                      key={u.id}
                      className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3 hover:border-emerald-500 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            {u.unit_name}
                          </h4>
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                            <Home className="w-3 h-3" />
                            {u.is_occupied ? 'Occupied Tenancy' : 'Vacant Unit'}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          {formatNaira(u.annual_rent)}/yr
                        </span>
                      </div>

                      {/* Tenant Profile */}
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{u.current_tenant_name || 'No tenant registered'}</span>
                        </div>
                        {u.tenant_phone && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{u.tenant_phone}</span>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>
                            Lease: {formatDate(u.lease_start_date)} → {formatDate(u.lease_end_date)}
                          </span>
                        </div>
                      </div>

                      {/* Fee Breakdown */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                        <div>
                          <span>S/Charge:</span>
                          <span className="font-bold block text-slate-800 dark:text-slate-200">
                            {formatNaira(u.annual_service_charge)}
                          </span>
                        </div>
                        <div>
                          <span>Caution Escrow:</span>
                          <span className="font-bold block text-slate-800 dark:text-slate-200">
                            {formatNaira(u.caution_fee)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Empty State when no properties */}
          {properties.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  No Properties Registered Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your portfolio is currently clean. Add your managed estates, tenancies, and landlord accounts to begin tracking rent and legal fees.
                </p>
              </div>
              <button
                onClick={() => {
                  setPropErrorMessage(null);
                  setIsAddPropertyOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow transition"
              >
                <Building2 className="w-4 h-4" />
                <span>+ Register First Property</span>
              </button>
            </div>
          )}
        </main>

        {/* Add Unit Modal */}
        {isAddUnitOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
              <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
                <div className="flex items-center gap-2">
                  <Plus className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base">Add New Tenancy Unit</h3>
                </div>
                <button
                  onClick={() => setIsAddUnitOpen(false)}
                  className="text-emerald-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUnit} className="p-5 sm:p-6 space-y-4">
                {errorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Parent Property / Estate Dropdown */}
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Select Parent Property / Estate <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={modalPropertyId}
                    onChange={(e) => setModalPropertyId(e.target.value)}
                    className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 font-medium"
                  >
                    <option value="" disabled>-- Select Estate / Property --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} - {p.address}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Unit Designation / Flat Name</label>
                  <input
                    type="text"
                    required
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="e.g. Flat 4 (3-Bedroom) or Wing B"
                    className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Current Tenant Name</label>
                    <input
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="e.g. Chief Adeleke / Leave empty if vacant"
                      className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Tenant Phone Number</label>
                    <input
                      type="tel"
                      value={tenantPhone}
                      onChange={(e) => setTenantPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Annual Rent (₦)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={annualRent}
                      onChange={(e) => setAnnualRent(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Service Charge (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={serviceCharge}
                      onChange={(e) => setServiceCharge(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Caution Fee (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={cautionFee}
                      onChange={(e) => setCautionFee(Number(e.target.value))}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                    />
                  </div>
                </div>

                {/* Lease Cycle Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Lease Start Date</label>
                    <input
                      type="date"
                      required
                      value={leaseStart}
                      onChange={(e) => setLeaseStart(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Lease End Date</label>
                    <input
                      type="date"
                      required
                      value={leaseEnd}
                      onChange={(e) => setLeaseEnd(e.target.value)}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsAddUnitOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 active:scale-95 disabled:opacity-60 text-white text-xs font-bold shadow transition"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                        <span>Saving Unit...</span>
                      </>
                    ) : (
                      <span>Save Unit</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Property Modal */}
        {isAddPropertyOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-6">
              <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-base">Register Managed Property &amp; Landlord</h3>
                </div>
                <button
                  onClick={() => setIsAddPropertyOpen(false)}
                  className="text-emerald-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateProperty} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                {propErrorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{propErrorMessage}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Property / Estate Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={propTitle}
                    onChange={(e) => setPropTitle(e.target.value)}
                    placeholder="e.g. Sunrise Court, Lekki Phase 1"
                    className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1">
                      Street Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={propAddress}
                      onChange={(e) => setPropAddress(e.target.value)}
                      placeholder="e.g. Plot 14 Admiralty Way"
                      className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">State</label>
                    <input
                      type="text"
                      value={propState}
                      onChange={(e) => setPropState(e.target.value)}
                      placeholder="Lagos"
                      className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                    />
                  </div>
                </div>

                {/* Landlord Info Section */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 block">
                    Landlord / Property Owner Profile
                  </span>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Owner Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={landlordName}
                      onChange={(e) => setLandlordName(e.target.value)}
                      placeholder="e.g. Chief Fredrick Adeleke"
                      className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Owner Phone / WhatsApp</label>
                      <input
                        type="tel"
                        value={landlordPhone}
                        onChange={(e) => setLandlordPhone(e.target.value)}
                        placeholder="+234 803 123 4567"
                        className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Owner Email</label>
                      <input
                        type="email"
                        value={landlordEmail}
                        onChange={(e) => setLandlordEmail(e.target.value)}
                        placeholder="owner@example.com"
                        className="w-full text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Disbursement Bank</label>
                      <input
                        type="text"
                        value={landlordBank}
                        onChange={(e) => setLandlordBank(e.target.value)}
                        placeholder="Zenith Bank PLC"
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">10-Digit NUBAN</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={landlordAccountNo}
                        onChange={(e) => setLandlordAccountNo(e.target.value)}
                        placeholder="1012345678"
                        className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Account Name</label>
                      <input
                        type="text"
                        value={landlordAccountName}
                        onChange={(e) => setLandlordAccountName(e.target.value)}
                        placeholder="Adeleke Property Ventures"
                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isPropSubmitting}
                    onClick={() => setIsAddPropertyOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPropSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 active:scale-95 disabled:opacity-60 text-white text-xs font-bold shadow transition"
                  >
                    {isPropSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                        <span>Registering Property...</span>
                      </>
                    ) : (
                      <span>Save Property</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PWAProvider>
  );
}
