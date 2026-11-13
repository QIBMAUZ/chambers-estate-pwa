'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Plus,
  UserCheck,
  UserPlus,
  Calendar,
  Phone,
  Mail,
  X,
  AlertCircle,
  Loader2,
  Pencil,
  MapPin,
  Archive,
  RotateCcw,
  History,
  LogOut,
  ShieldCheck,
  Lock,
  Share2,
  ClipboardList,
  FileSignature,
  Printer,
  Upload,
  Eye,
  CreditCard,
  CheckCircle2,
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { Navigation } from '@/components/Navigation';
import { PWAProvider } from '@/components/PWAProvider';
import { EditUnitModal } from '@/components/EditUnitModal';
import { OnboardTenantModal } from '@/components/OnboardTenantModal';
import { VacateTenantModal } from '@/components/VacateTenantModal';
import { TenancyHistoryModal } from '@/components/TenancyHistoryModal';
import { ReviewApplicationsModal } from '@/components/ReviewApplicationsModal';
import { TenancyAgreementDocument } from '@/components/TenancyAgreementPDF';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';
import { Property, Unit, UserRole, TenancyApplication } from '@/types/database';

export default function PropertiesPage() {
  const [mounted, setMounted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [applications, setApplications] = useState<TenancyApplication[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [role, setRole] = useState<UserRole>('HEAD_OF_CHAMBERS');

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

  // Lifecycle Modals
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [onboardingUnit, setOnboardingUnit] = useState<Unit | null>(null);
  const [prefilledApplication, setPrefilledApplication] = useState<TenancyApplication | null>(null);
  const [reviewingUnit, setReviewingUnit] = useState<Unit | null>(null);
  const [vacatingUnit, setVacatingUnit] = useState<Unit | null>(null);
  const [historyModalState, setHistoryModalState] = useState<{
    open: boolean;
    propertyId?: string;
    unitId?: string;
    title?: string;
  }>({ open: false });

  // Hybrid Agreement PDF & Upload state
  const [printingUnitId, setPrintingUnitId] = useState<string | null>(null);
  const [uploadingScanUnitId, setUploadingScanUnitId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeUploadUnitId, setActiveUploadUnitId] = useState<string | null>(null);

  // Add Property modal
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
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
    const props = EstateStore.getProperties(showArchived);
    setProperties(props);
    setRole(EstateStore.getCurrentUserRole());
    if (props.length > 0) {
      setSelectedPropertyId((prev) =>
        props.some((p) => p.id === prev) ? prev : props[0].id
      );
      setModalPropertyId((prev) => prev || props[0].id);
    } else {
      setSelectedPropertyId('');
      setModalPropertyId('');
    }
    setUnits(EstateStore.getUnits());
    setApplications(EstateStore.getTenancyApplications());
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeToStore(() => refreshData());
    return () => unsub();
  }, [showArchived]);

  const activeProperty = properties.find((p) => p.id === selectedPropertyId) || properties[0] || null;
  const propertyUnits = units.filter((u) => u.property_id === activeProperty?.id);
  const isClerk = role === 'ACCOUNTANT_CLERK';

  const copyPublicLink = (path: string, label: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${origin}${path}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl);
      setToastMessage(`${label} copied: ${fullUrl}`);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      prompt(`Copy ${label}:`, fullUrl);
    }
  };

  const handlePrintHardCopyAgreement = async (u: Unit) => {
    setPrintingUnitId(u.id);
    try {
      const profile = EstateStore.getChamberProfile();
      const blob = await pdf(
        <TenancyAgreementDocument unit={u} profile={profile} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HardCopy_Tenancy_Agreement_${u.unit_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToastMessage(`Tenancy Agreement PDF downloaded for Landlord wet-ink signature (${u.unit_name}).`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Failed to generate Tenancy Agreement PDF.');
    } finally {
      setPrintingUnitId(null);
    }
  };

  const handleTriggerUploadExecutedCopy = (unitId: string) => {
    setActiveUploadUnitId(unitId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleExecutedFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetUnitId = activeUploadUnitId;
    if (!file || !targetUnitId) return;

    setUploadingScanUnitId(targetUnitId);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      await EstateStore.uploadExecutedHardCopyAgreement(targetUnitId, dataUrl);
      refreshData();
      setToastMessage('Landlord-signed hard copy Tenancy Agreement uploaded & archived!');
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err: any) {
      alert(err?.message || 'Failed to upload Landlord-signed Tenancy Agreement.');
    } finally {
      setUploadingScanUnitId(null);
      setActiveUploadUnitId(null);
    }
  };

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
      const newLandlord = await EstateStore.createLandlord({
        name: landlordName.trim(),
        phone: landlordPhone.trim() || null,
        email: landlordEmail.trim() || null,
        bank_name: landlordBank.trim() || 'Zenith Bank PLC',
        account_number: landlordAccountNo.trim() || '',
        account_name: landlordAccountName.trim() || landlordName.trim(),
        default_mgt_rate: Number(landlordMgtRate) || 10.0,
      });

      const newProperty = await EstateStore.createProperty({
        landlord_id: newLandlord.id,
        title: propTitle.trim(),
        address: propAddress.trim(),
        state: propState.trim() || 'Lagos',
        default_mgt_rate: Number(landlordMgtRate) || 10.0,
      });

      setSelectedPropertyId(newProperty.id);
      setModalPropertyId(newProperty.id);
      setIsAddPropertyOpen(false);

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
    if (!targetPropertyId || !newUnitName.trim()) {
      alert('Please select a property and enter a unit designation.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const isOccupied = Boolean(tenantName.trim());
      await EstateStore.createUnit({
        property_id: targetPropertyId,
        unit_name: newUnitName.trim(),
        current_tenant_name: tenantName.trim() || null,
        tenant_phone: tenantPhone.trim() || null,
        tenant_email: tenantEmail.trim() || null,
        annual_rent: parseFloat(String(annualRent)) || 0,
        annual_service_charge: parseFloat(String(serviceCharge)) || 0,
        caution_fee: parseFloat(String(cautionFee)) || 0,
        lease_start_date: isOccupied ? leaseStart : null,
        lease_end_date: isOccupied ? leaseEnd : null,
        is_occupied: isOccupied,
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
      const msg = err?.message || 'Database error: Could not save tenancy unit.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleArchiveProperty = async (prop: Property) => {
    if (isClerk) {
      alert('Access Denied: Only the Head of Chambers can archive or restore properties.');
      return;
    }
    const nextArchive = !prop.is_archived;
    const msg = nextArchive
      ? `Soft-archive "${prop.title}"? All past transactions and statements remain preserved in the ledger, while hiding this property from active dropdowns.`
      : `Restore "${prop.title}" to active management?`;
    if (!confirm(msg)) return;

    try {
      await EstateStore.toggleArchiveProperty(prop.id, nextArchive);
      refreshData();
      setToastMessage(
        nextArchive
          ? `Property "${prop.title}" soft-archived (financial history preserved).`
          : `Property "${prop.title}" restored to active portfolio.`
      );
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Could not update property archive state.');
    }
  };

  return (
    <PWAProvider>
      <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12">
        <Navigation
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={setSelectedPropertyId}
        />

        {/* Hidden file input for Landlord Wet-Ink Signed Agreement scan upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleExecutedFileSelected}
          className="hidden"
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {toastMessage && (
            <div className="bg-emerald-900 text-white px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between shadow">
              <span>{toastMessage}</span>
              <button onClick={() => setToastMessage(null)}>✕</button>
            </div>
          )}

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-emerald-900 text-white flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5" />
                </span>
                Managed Estates, Pre-Entry KYC &amp; Hybrid Tenancy Agreements
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Share public <code className="text-xs font-mono">/apply/[unitId]</code> links for vacant units, review KYC applications, and manage Hybrid E-Sign + Wet-Ink Tenancy Agreements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition ${
                  showArchived
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border-amber-300'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{showArchived ? 'Showing Archived Properties' : 'Show Archived'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setHistoryModalState({
                    open: true,
                    propertyId: activeProperty?.id,
                    title: activeProperty
                      ? `Past Tenants Archive — ${activeProperty.title}`
                      : 'All Past Tenants Archive',
                  })
                }
                className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold px-3.5 py-2.5 rounded-xl text-xs transition"
              >
                <History className="w-4 h-4 text-amber-600" />
                <span>Past Tenants History</span>
              </button>

              <button
                onClick={() => {
                  setPropErrorMessage(null);
                  setIsAddPropertyOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700 font-medium px-4 py-2.5 rounded-xl shadow-2xs transition-all text-xs sm:text-sm"
              >
                <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>+ Register Property</span>
              </button>

              <button
                onClick={handleOpenAddUnit}
                className="inline-flex items-center justify-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium px-4 py-2.5 rounded-xl shadow-sm transition-all text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Add Unit</span>
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
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-900 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/70'
                    }`}
                  >
                    <span>{p.title}</span>
                    {p.is_archived && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-300 font-bold">
                        ARCHIVED
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hero / Property Header & Units Container */}
          {activeProperty && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.05)] space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                      {activeProperty.is_archived ? 'Archived Property (Read-Only History)' : 'Managed Property Portfolio'}
                    </span>
                    {activeProperty.created_by_name && (
                      <span className="text-[11px] text-slate-400">
                        Added by: {activeProperty.created_by_name}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {activeProperty.title}
                  </h2>
                  <p className="text-slate-500 text-sm flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>
                      {activeProperty.address}, {activeProperty.state} State, Nigeria
                    </span>
                  </p>

                  {/* Soft-Archive / Restore Property Button (Head of Chambers Only) */}
                  {!isClerk && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleArchiveProperty(activeProperty)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-amber-700 dark:hover:text-amber-400 transition"
                      >
                        {activeProperty.is_archived ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore Property to Active Portfolio</span>
                          </>
                        ) : (
                          <>
                            <Archive className="w-3.5 h-3.5" />
                            <span>Decommission / Soft-Archive Property</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
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

                      {isClerk ? (
                        <span
                          title="Locked: Only Head of Chambers can modify landlord bank/fee settings"
                          className="bg-slate-700/60 text-slate-300 border border-slate-600 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 shrink-0"
                        >
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>{activeProperty.landlord.default_mgt_rate ?? 10}% Renewal Fee</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            const currentRate = activeProperty.landlord?.default_mgt_rate ?? 10;
                            const input = prompt(
                              'Enter customized Renewal Management Fee Rate (%) for this Landlord:',
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
                          title="Click to customize Renewal Management Fee rate for this landlord"
                          className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <span>{activeProperty.landlord.default_mgt_rate ?? 10}% Renewal Fee</span>
                          <Pencil className="w-3 h-3 text-emerald-300" />
                        </button>
                      )}
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
                      Share pre-entry KYC links for VACANT units or manage Hybrid Tenancy Agreements for occupied flats.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {propertyUnits.map((u) => {
                    const isVacant = !u.is_occupied || !u.current_tenant_name;
                    const unitApps = applications.filter((a) => a.unit_id === u.id);
                    const pendingAppsCount = unitApps.filter((a) => a.status === 'PENDING').length;

                    const agreementStatus = u.agreement_status || 'PENDING';
                    const agreementBadgeClass =
                      agreementStatus === 'EXECUTED_HARD_COPY'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                        : agreementStatus === 'TENANT_E_SIGNED'
                        ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300';

                    return (
                      <div
                        key={u.id}
                        className={`rounded-2xl border p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] transition-all duration-200 flex flex-col justify-between ${
                          isVacant
                            ? 'bg-amber-50/30 dark:bg-slate-900 border-amber-300/80 dark:border-amber-800/70'
                            : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        <div>
                          {/* Card Header Row */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {u.unit_name}
                              </h4>
                              <div className="inline-flex items-center text-xs font-semibold mt-1">
                                <span
                                  className={`w-2 h-2 rounded-full mr-2 ${
                                    !isVacant
                                      ? 'bg-emerald-500 animate-pulse'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <span
                                  className={
                                    isVacant
                                      ? 'text-amber-700 dark:text-amber-400 font-bold'
                                      : 'text-emerald-700 dark:text-emerald-400'
                                  }
                                >
                                  {isVacant
                                    ? 'VACANT UNIT'
                                    : `OCCUPIED (${u.tenancy_type || 'RENEWAL'})`}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800 font-semibold px-3 py-1 rounded-full text-xs tabular-nums">
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

                          {/* Tenant Info Box or VACANT Onboarding & Pre-Entry KYC Trigger */}
                          {isVacant ? (
                            <div className="bg-white dark:bg-slate-800/60 rounded-xl p-4 my-3 border border-dashed border-amber-300 dark:border-amber-800 space-y-2.5">
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 text-center">
                                Unit is currently vacant &amp; ready for let.
                              </p>

                              {/* Pre-Entry KYC Application Actions */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyPublicLink(
                                      `/apply/${u.id}`,
                                      'Pre-Entry Tenancy Application Link'
                                    )
                                  }
                                  className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold text-[11px] transition"
                                >
                                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Share Apply Link</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setReviewingUnit(u)}
                                  className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-[11px] transition"
                                >
                                  <ClipboardList className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                                  <span>
                                    Applications ({unitApps.length})
                                    {pendingAppsCount > 0 ? ` • ${pendingAppsCount} New` : ''}
                                  </span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setPrefilledApplication(null);
                                  setOnboardingUnit(u);
                                }}
                                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow transition"
                              >
                                <UserPlus className="w-4 h-4 text-amber-300" />
                                <span>+ Direct Onboard Tenant (KYC + 10% Fee)</span>
                              </button>
                            </div>
                          ) : (
                            <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-3.5 my-3 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  {u.passport_photo_url ? (
                                    <a
                                      href={u.passport_photo_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="View Tenant Passport Photo"
                                      className="w-9 h-9 rounded-lg overflow-hidden border border-emerald-600 shrink-0"
                                    >
                                      <img
                                        src={u.passport_photo_url}
                                        alt={u.current_tenant_name || 'Tenant'}
                                        className="w-full h-full object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                  )}
                                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {u.current_tenant_name}
                                  </span>
                                </div>

                                {u.valid_id_url && (
                                  <a
                                    href={u.valid_id_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-[10px] font-bold shrink-0"
                                  >
                                    <CreditCard className="w-3 h-3" />
                                    <span>Valid ID</span>
                                  </a>
                                )}
                              </div>

                              {u.tenant_phone && (
                                <div className="text-slate-500 flex items-center gap-2 font-mono">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{u.tenant_phone}</span>
                                </div>
                              )}

                              {u.tenant_email && (
                                <div className="text-slate-500 flex items-center gap-2 truncate">
                                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="truncate">{u.tenant_email}</span>
                                </div>
                              )}

                              {(u.tenant_nin_or_id || u.guarantor_name) && (
                                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                                  {u.tenant_nin_or_id && <div>ID: {u.tenant_nin_or_id}</div>}
                                  {u.guarantor_name && <div>Guarantor: {u.guarantor_name}</div>}
                                </div>
                              )}

                              <div className="pt-1 flex flex-wrap items-center justify-between gap-1.5">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                  <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                                  <span>
                                    {formatDate(u.lease_start_date)} → {formatDate(u.lease_end_date)}
                                  </span>
                                </div>
                              </div>

                              {/* Hybrid Tenancy Agreement Module */}
                              <div className="pt-2.5 mt-2 border-t border-slate-200/80 dark:border-slate-700 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                                    Tenancy Agreement
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${agreementBadgeClass}`}
                                  >
                                    {agreementStatus === 'EXECUTED_HARD_COPY'
                                      ? 'EXECUTED HARD COPY'
                                      : agreementStatus === 'TENANT_E_SIGNED'
                                      ? 'TENANT E-SIGNED'
                                      : 'PENDING E-SIGN'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyPublicLink(
                                        `/sign/${u.agreement_token || u.id}`,
                                        'Tenant E-Signature Link'
                                      )
                                    }
                                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition"
                                  >
                                    <FileSignature className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Copy E-Sign Link</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={printingUnitId === u.id}
                                    onClick={() => handlePrintHardCopyAgreement(u)}
                                    className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] transition"
                                  >
                                    {printingUnitId === u.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Printer className="w-3.5 h-3.5 shrink-0" />
                                    )}
                                    <span>Print Hard Copy</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={uploadingScanUnitId === u.id}
                                    onClick={() => handleTriggerUploadExecutedCopy(u.id)}
                                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 font-bold text-[11px] transition"
                                  >
                                    {uploadingScanUnitId === u.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Upload className="w-3.5 h-3.5 shrink-0" />
                                    )}
                                    <span>
                                      {u.executed_agreement_scan_url
                                        ? 'Replace Landlord-Signed Scan'
                                        : 'Upload Landlord-Signed Copy'}
                                    </span>
                                  </button>

                                  {u.executed_agreement_scan_url && (
                                    <a
                                      href={u.executed_agreement_scan_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="View Executed Landlord-Signed Agreement"
                                      className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[11px] transition shrink-0"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>View Scan</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Financial Breakdown & Lifecycle Actions Footer */}
                        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                Service Charge
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                {formatNaira(u.annual_service_charge)}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                Caution Escrow
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                                {formatNaira(u.caution_fee)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setHistoryModalState({
                                  open: true,
                                  unitId: u.id,
                                  title: `Unit History — ${u.unit_name}`,
                                })
                              }
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>Unit History</span>
                            </button>

                            {!isVacant && (
                              <button
                                type="button"
                                onClick={() => setVacatingUnit(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold hover:bg-rose-100 transition"
                              >
                                <LogOut className="w-3 h-3" />
                                <span>End Tenancy / Vacate</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {properties.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 flex items-center justify-center mx-auto">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  No Active Properties Found
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Register a new property with landlord bank details and fee rates, or toggle &quot;Show Archived&quot; to inspect decommissioned estates.
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
                <span>+ Register Property</span>
              </button>
            </div>
          )}
        </main>

        {/* Add Unit Modal */}
        {isAddUnitOpen && (
          <div className="fixed inset-0 z-50 backdrop-blur-sm bg-slate-900/40 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 max-w-lg w-full p-6 my-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Add New Tenancy Unit
                  </h3>
                  <p className="text-xs text-slate-500">
                    Leave tenant name blank to register as a VACANT unit ready for pre-entry KYC applications
                  </p>
                </div>
                <button
                  onClick={() => setIsAddUnitOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUnit} className="space-y-4 text-xs">
                {errorMessage && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Parent Property / Estate <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={modalPropertyId}
                    onChange={(e) => setModalPropertyId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-2.5"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit Designation / Flat Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="e.g. Flat 4 (3-Bedroom) or Wing B"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-2.5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Annual Rent (₦)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={annualRent}
                      onChange={(e) => setAnnualRent(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Service Charge (₦)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={serviceCharge}
                      onChange={(e) => setServiceCharge(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Caution Fee (₦)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={cautionFee}
                      onChange={(e) => setCautionFee(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold p-2.5"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddUnitOpen(false)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl px-4 py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl px-5 py-2.5 text-sm"
                  >
                    {isSubmitting ? 'Saving...' : 'Create Unit'}
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
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    Register Managed Property &amp; Landlord
                  </h3>
                  <p className="text-xs text-slate-500">
                    Add a new estate, landlord bank details, and default renewal management fee rate
                  </p>
                </div>
                <button
                  onClick={() => setIsAddPropertyOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateProperty} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Property / Estate Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={propTitle}
                    onChange={(e) => setPropTitle(e.target.value)}
                    placeholder="e.g. Sunrise Court, Lekki Phase 1"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-2.5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Street Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={propAddress}
                      onChange={(e) => setPropAddress(e.target.value)}
                      placeholder="Plot 14 Admiralty Way"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={propState}
                      onChange={(e) => setPropState(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-2.5"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                    Landlord &amp; Disbursement Bank Details
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Landlord Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={landlordName}
                        onChange={(e) => setLandlordName(e.target.value)}
                        placeholder="e.g. Chief Fredrick Adeleke"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Landlord Phone
                      </label>
                      <input
                        type="tel"
                        value={landlordPhone}
                        onChange={(e) => setLandlordPhone(e.target.value)}
                        placeholder="+234 803 000 0000"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-2.5"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={landlordBank}
                        onChange={(e) => setLandlordBank(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        NUBAN Account No
                      </label>
                      <input
                        type="text"
                        maxLength={10}
                        value={landlordAccountNo}
                        onChange={(e) => setLandlordAccountNo(e.target.value)}
                        placeholder="1012345678"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono p-2.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Renewal Fee (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={landlordMgtRate}
                        onChange={(e) => setLandlordMgtRate(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold p-2.5"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddPropertyOpen(false)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-xl px-4 py-2.5 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPropSubmitting}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium rounded-xl px-5 py-2.5 text-sm"
                  >
                    {isPropSubmitting ? 'Registering...' : 'Register Property'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Lifecycle Modals */}
        <EditUnitModal
          unit={editingUnit}
          isOpen={Boolean(editingUnit)}
          onClose={() => setEditingUnit(null)}
          onSuccess={() => {
            refreshData();
            setToastMessage('Tenancy unit updated successfully!');
            setTimeout(() => setToastMessage(null), 3500);
          }}
        />

        <ReviewApplicationsModal
          unit={reviewingUnit}
          isOpen={Boolean(reviewingUnit)}
          onClose={() => setReviewingUnit(null)}
          onApproveAndOnboard={(app) => {
            const targetUnit = reviewingUnit;
            setReviewingUnit(null);
            setPrefilledApplication(app);
            setOnboardingUnit(targetUnit);
          }}
        />

        <OnboardTenantModal
          unit={onboardingUnit}
          isOpen={Boolean(onboardingUnit)}
          onClose={() => {
            setOnboardingUnit(null);
            setPrefilledApplication(null);
          }}
          prefilledApplication={prefilledApplication}
          onOnboarded={() => {
            refreshData();
            setToastMessage('New Tenant onboarded, KYC attached & First-Year Move-In Invoice generated!');
            setTimeout(() => setToastMessage(null), 4000);
          }}
        />

        <VacateTenantModal
          unit={vacatingUnit}
          isOpen={Boolean(vacatingUnit)}
          onClose={() => setVacatingUnit(null)}
          onVacated={() => {
            refreshData();
            setToastMessage('Tenant KYC & Caution settlement archived to tenancy_history. Unit is now VACANT.');
            setTimeout(() => setToastMessage(null), 4500);
          }}
        />

        <TenancyHistoryModal
          isOpen={historyModalState.open}
          onClose={() => setHistoryModalState({ open: false })}
          propertyId={historyModalState.propertyId}
          unitId={historyModalState.unitId}
          title={historyModalState.title}
        />
      </div>
    </PWAProvider>
  );
}
