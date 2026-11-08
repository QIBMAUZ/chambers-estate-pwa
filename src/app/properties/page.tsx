'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Home,
  UserCheck,
  Calendar,
  Phone,
  Mail,
  X,
  Check,
  AlertCircle,
  Loader2,
  Pencil,
  MapPin,
} from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { EditUnitModal } from '@/components/EditUnitModal';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { formatNaira, formatDate } from '@/lib/utils';
import { Property, Unit } from '@/types/database';

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
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

      setToastMessage('Property and Landlord registered successfully!');
      setTimeout(() => setToastMessage(null), 4000);
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
      setToastMessage('Tenancy unit added successfully!');
      setTimeout(() => setToastMessage(null), 4000);
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
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12">
        <Navigation
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={setSelectedPropertyId}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-emerald-900 text-white flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5" />
                </span>
                Managed Estates &amp; Tenancy Units
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Commercial and residential properties under management with verified landlord disbursement accounts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => {
                  setPropErrorMessage(null);
                  setIsAddPropertyOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700 font-medium px-4 py-2.5 rounded-xl shadow-2xs transition-all text-sm"
              >
                <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>+ Register Property</span>
              </button>
              <button
                onClick={handleOpenAddUnit}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium px-5 py-2.5 rounded-xl shadow-sm transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Tenancy Unit</span>
              </button>
            </div>
          </div>

          {/* Property Selector Tabs */}
          {properties.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {properties.map((p) => {
                const isSelected = activeProperty?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPropertyId(p.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-emerald-900 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/70 hover:text-slate-900'
                    }`}
                  >
                    {p.title}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hero / Property Header & Units Container */}
          {activeProperty && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.05)] space-y-8">
              {/* Luxury Property Details & Executive Landlord Card */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div className="space-y-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                    Managed Property Portfolio
                  </span>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {activeProperty.title}
                  </h2>
                  <p className="text-slate-500 text-sm flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>
                      {activeProperty.address}, {activeProperty.state} State, Nigeria
                    </span>
                  </p>
                </div>

                {/* Executive Slate Landlord Card */}
                {activeProperty.landlord && (
                  <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-md border border-slate-700/50 sm:min-w-[360px] space-y-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                          Property Owner / Landlord
                        </span>
                        <div className="font-bold text-base text-white mt-0.5">
                          {activeProperty.landlord.name}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          const currentRate = activeProperty.landlord?.default_mgt_rate ?? 10;
                          const input = prompt(
                            'Enter customized Management Fee Rate (%) for this Landlord:',
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
                        title="Click to customize Management Fee rate for this landlord"
                        className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <span>{activeProperty.landlord.default_mgt_rate ?? 10}% Mgt Fee</span>
                        <Pencil className="w-3 h-3 text-emerald-300" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/60">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                          Disbursement Bank
                        </span>
                        <span className="text-xs font-semibold text-slate-100">
                          {activeProperty.landlord.bank_name}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                          Account Number
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-300 tabular-nums">
                          {activeProperty.landlord.account_number || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                          Beneficiary Name
                        </span>
                        <span className="text-xs font-medium text-slate-200 truncate block">
                          {activeProperty.landlord.account_name}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                          Direct Contact
                        </span>
                        <span className="text-xs font-mono text-slate-200">
                          {activeProperty.landlord.phone || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tenancy Units Grid Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      Tenancy Units ({propertyUnits.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Active leases, occupant contact details, and annual rent structures
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {propertyUnits.map((u) => (
                    <div
                      key={u.id}
                      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between"
                    >
                      <div>
                        {/* Card Header Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                              {u.unit_name}
                            </h4>
                            <div className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
                              <span
                                className={`w-2 h-2 rounded-full mr-2 ${
                                  u.is_occupied
                                    ? 'bg-emerald-500 animate-pulse'
                                    : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                              />
                              <span>{u.is_occupied ? 'Occupied Tenancy' : 'Vacant Unit'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 font-semibold px-3 py-1 rounded-full text-sm tabular-nums">
                              {formatNaira(u.annual_rent)}/yr
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditingUnit(u)}
                              title="Edit Tenancy Unit"
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Modern Inset Tenant Info Box */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-3.5 my-3 border border-slate-100 dark:border-slate-800 space-y-2">
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="truncate">
                              {u.current_tenant_name || 'No tenant registered'}
                            </span>
                          </div>

                          {u.tenant_phone && (
                            <div className="text-xs text-slate-500 flex items-center gap-2 font-mono">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{u.tenant_phone}</span>
                            </div>
                          )}

                          {u.tenant_email && (
                            <div className="text-xs text-slate-500 flex items-center gap-2 truncate">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{u.tenant_email}</span>
                            </div>
                          )}

                          <div className="pt-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                              <span>
                                Lease: {formatDate(u.lease_start_date)} → {formatDate(u.lease_end_date)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Financial Breakdown Footer */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                            Service Charge
                          </span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {formatNaira(u.annual_service_charge)}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                            Caution Escrow
                          </span>
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center space-y-4 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 flex items-center justify-center mx-auto">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  No Properties Registered Yet
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your portfolio is currently empty. Add your managed estates, tenancies, and landlord accounts to begin tracking rent and management fees.
                </p>
              </div>
              <button
                onClick={() => {
                  setPropErrorMessage(null);
                  setIsAddPropertyOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-sm rounded-xl shadow-sm transition-all"
              >
                <Building2 className="w-4 h-4" />
                <span>+ Register First Property</span>
              </button>
            </div>
          )}
        </main>

        {/* Add Unit Modal */}
        {isAddUnitOpen && (
          <div className="fixed inset-0 z-50 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 max-w-lg w-full p-6 my-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-300">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      Add New Tenancy Unit
                    </h3>
                    <p className="text-xs text-slate-500">
                      Register a flat or commercial unit under an existing estate
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddUnitOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUnit} className="space-y-4">
                {errorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Parent Property / Estate Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Parent Property / Estate <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={modalPropertyId}
                    onChange={(e) => setModalPropertyId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 font-medium transition-all"
                  >
                    <option value="" disabled>
                      -- Select Estate / Property --
                    </option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} - {p.address}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Unit Designation / Flat Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="e.g. Flat 4 (3-Bedroom) or Wing B"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Current Tenant Name
                    </label>
                    <input
                      type="text"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="e.g. Chief Adeleke / Leave empty if vacant"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tenant Phone Number
                    </label>
                    <input
                      type="tel"
                      value={tenantPhone}
                      onChange={(e) => setTenantPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tenant Email Address{' '}
                    <span className="text-[11px] font-normal text-slate-400">
                      (For automated email reminders)
                    </span>
                  </label>
                  <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder="tenant@example.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Annual Rent (₦)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={annualRent}
                      onChange={(e) => setAnnualRent(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm font-semibold tabular-nums p-2.5 transition-all"
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
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm font-semibold tabular-nums p-2.5 transition-all"
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
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm font-semibold tabular-nums p-2.5 transition-all"
                    />
                  </div>
                </div>

                {/* Lease Cycle Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Lease Start Date
                    </label>
                    <input
                      type="date"
                      required
                      value={leaseStart}
                      onChange={(e) => setLeaseStart(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Lease End Date
                    </label>
                    <input
                      type="date"
                      required
                      value={leaseEnd}
                      onChange={(e) => setLeaseEnd(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsAddUnitOpen(false)}
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
          <div className="fixed inset-0 z-50 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 max-w-lg w-full p-6 my-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-300">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      Register Managed Property &amp; Landlord
                    </h3>
                    <p className="text-xs text-slate-500">
                      Add a new estate and its owner disbursement account
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddPropertyOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateProperty} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                {propErrorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{propErrorMessage}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Property / Estate Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={propTitle}
                    onChange={(e) => setPropTitle(e.target.value)}
                    placeholder="e.g. Sunrise Court, Lekki Phase 1"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Street Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={propAddress}
                      onChange={(e) => setPropAddress(e.target.value)}
                      placeholder="e.g. Plot 14 Admiralty Way"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      State
                    </label>
                    <input
                      type="text"
                      value={propState}
                      onChange={(e) => setPropState(e.target.value)}
                      placeholder="Lagos"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                    />
                  </div>
                </div>

                {/* Landlord Info Section */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    Landlord / Property Owner Profile
                  </span>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Owner Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={landlordName}
                      onChange={(e) => setLandlordName(e.target.value)}
                      placeholder="e.g. Chief Fredrick Adeleke"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Owner Phone / WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={landlordPhone}
                        onChange={(e) => setLandlordPhone(e.target.value)}
                        placeholder="+234 803 123 4567"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Owner Email
                      </label>
                      <input
                        type="email"
                        value={landlordEmail}
                        onChange={(e) => setLandlordEmail(e.target.value)}
                        placeholder="owner@example.com"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Disbursement Bank
                      </label>
                      <input
                        type="text"
                        value={landlordBank}
                        onChange={(e) => setLandlordBank(e.target.value)}
                        placeholder="Zenith Bank PLC"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        10-Digit NUBAN
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={landlordAccountNo}
                        onChange={(e) => setLandlordAccountNo(e.target.value)}
                        placeholder="1012345678"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm font-mono p-2.5 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Account Name
                      </label>
                      <input
                        type="text"
                        value={landlordAccountName}
                        onChange={(e) => setLandlordAccountName(e.target.value)}
                        placeholder="Adeleke Property Ventures"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none text-sm p-2.5 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={isPropSubmitting}
                    onClick={() => setIsAddPropertyOpen(false)}
                    className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-xl px-4 py-2.5 text-sm transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPropSubmitting}
                    className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl px-5 py-2.5 text-sm shadow-sm transition-all disabled:opacity-60"
                  >
                    {isPropSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
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

        {/* Edit Unit Modal */}
        <EditUnitModal
          unit={editingUnit}
          isOpen={Boolean(editingUnit)}
          onClose={() => setEditingUnit(null)}
          onSuccess={(updated) => {
            refreshData();
            setToastMessage(`Unit "${updated.unit_name}" updated successfully!`);
            setTimeout(() => {
              setToastMessage(null);
            }, 4000);
          }}
        />

        {/* Success Toast */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-4">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </PWAProvider>
  );
}
