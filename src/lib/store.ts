'use client';

import {
  Landlord,
  Property,
  Unit,
  Invoice,
  Transaction,
  PropertyBalances,
  FundingSource,
  ChamberProfile,
  UserRole,
  TenancyType,
  TenancyHistory,
  TranchePayment,
  LegalMatter,
  MatterCategory,
  SolicitorFeeNote,
  FirmExpense,
  FirmExpenseCategory,
  FirmProfitSummary,
  TenancyApplication,
  ApplicationStatus,
  AgreementStatus,
} from '@/types/database';
import {
  INITIAL_LANDLORDS,
  INITIAL_PROPERTIES,
  INITIAL_UNITS,
  INITIAL_INVOICES,
  INITIAL_TRANSACTIONS,
  INITIAL_CHAMBER_PROFILE,
  INITIAL_TENANCY_HISTORY,
  INITIAL_TRANCHE_PAYMENTS,
  INITIAL_LEGAL_MATTERS,
  INITIAL_SOLICITOR_FEE_NOTES,
  INITIAL_FIRM_EXPENSES,
  INITIAL_TENANCY_APPLICATIONS,
} from './initialData';
import { supabase, isSupabaseConfigured, uploadReceiptToStorage, uploadLogoToStorage } from './supabase';

const LEGACY_KEY_PREFIX = 'estate_pwa_';
let currentUserId: string | null = null;
let localStorageKey: string = 'estate_store_guest';

function purgeLegacyStorageKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_KEY_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('Error purging legacy storage keys:', e);
  }
}

function getScopedBucket(): Record<string, any> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(localStorageKey);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error reading from localStorage', e);
    return {};
  }
}

function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const bucket = getScopedBucket();
    if (bucket && key in bucket && bucket[key] !== undefined) {
      return bucket[key] as T;
    }
    return fallback;
  } catch (e) {
    console.error('Error reading from localStorage', e);
    return fallback;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    const bucket = getScopedBucket();
    bucket[key] = value;
    localStorage.setItem(localStorageKey, JSON.stringify(bucket));
  } catch (e) {
    console.error('Error writing to localStorage', e);
  }
}

// Reactive Event Bus
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export function subscribeToStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifySubscribers() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

// Helper for sequential/timestamped document serials (RCT-..., VCH-..., FN-..., MAT-...)
export function generateSerialRef(prefix: 'RCT' | 'VCH' | 'FVCH' | 'FN' | 'MAT'): string {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ymd}-${rand}`;
}

// Auto-sync with live Supabase on mount
let hasInitializedCloudSync = false;

async function syncWithSupabase() {
  if (!supabase || hasInitializedCloudSync) return;
  hasInitializedCloudSync = true;

  try {
    purgeLegacyStorageKeys();

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await EstateStore.init(user.id);
    } else {
      await EstateStore.init();
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        EstateStore.resetState();
      } else if (session?.user?.id && session.user.id !== currentUserId) {
        await EstateStore.init(session.user.id);
      }
    });

    supabase
      .channel('public_estate_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        async () => {
          if (!currentUserId) return;
          try {
            const { data } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', currentUserId)
              .maybeSingle();
            if (data) {
              setStorage('chamber_profile', data);
              notifySubscribers();
            }
          } catch (e) {
            console.warn('Profiles realtime sync note:', e);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        async () => {
          if (!currentUserId) return;
          const scopeId = EstateStore.getEffectiveManagerId();
          const { data } = await supabase
            .from('invoices')
            .select('*')
            .eq('manager_id', scopeId);
          setStorage('invoices', data || []);
          notifySubscribers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        async () => {
          if (!currentUserId) return;
          const scopeId = EstateStore.getEffectiveManagerId();
          const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('manager_id', scopeId)
            .order('created_at', { ascending: false });
          setStorage('transactions', data || []);
          notifySubscribers();
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Supabase cloud sync notification:', err);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncWithSupabase();
  }, 100);
}

export class EstateStore {
  // 0. Multi-Tenant & RBAC Initialization
  static async init(userId?: string): Promise<void> {
    purgeLegacyStorageKeys();

    let resolvedUserId = userId || null;
    if (!resolvedUserId && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        resolvedUserId = user?.id || null;
      } catch {
        resolvedUserId = null;
      }
    }

    currentUserId = resolvedUserId;
    localStorageKey = resolvedUserId ? `estate_store_${resolvedUserId}` : 'estate_store_guest';

    if (resolvedUserId) {
      await this.fetchFromSupabase(resolvedUserId);
    } else {
      notifySubscribers();
    }
  }

  static getCurrentUserId(): string | null {
    return currentUserId;
  }

  static getEffectiveManagerId(): string {
    const profile = this.getChamberProfile();
    return profile.chambers_id || currentUserId || profile.id || '';
  }

  static getCurrentUserRole(): UserRole {
    const profile = this.getChamberProfile();
    return profile.role || 'HEAD_OF_CHAMBERS';
  }

  static isHeadOfChambers(): boolean {
    return this.getCurrentUserRole() === 'HEAD_OF_CHAMBERS';
  }

  static isAccountantClerk(): boolean {
    return this.getCurrentUserRole() === 'ACCOUNTANT_CLERK';
  }

  static getAuditActor(): { created_by: string | null; created_by_name: string } {
    const profile = this.getChamberProfile();
    const roleLabel = profile.role === 'ACCOUNTANT_CLERK' ? 'Accountant / Clerk' : 'Head of Chambers';
    const displayName = profile.full_name || profile.solicitor_name || 'Chambers Officer';
    return {
      created_by: currentUserId || profile.id || null,
      created_by_name: `${displayName} (${roleLabel})`,
    };
  }

  static async switchActiveRole(role: UserRole, staffName?: string): Promise<ChamberProfile> {
    const current = this.getChamberProfile();
    const updatedName =
      staffName ||
      (role === 'ACCOUNTANT_CLERK'
        ? 'Chambers Accountant / Litigation Clerk'
        : current.solicitor_name || 'Barr. T. A. Babatunde');
    return await this.updateChamberProfile({
      role,
      full_name: updatedName,
    });
  }

  static async fetchFromSupabase(userId: string): Promise<void> {
    if (!supabase || !userId) return;

    currentUserId = userId;
    localStorageKey = `estate_store_${userId}`;

    try {
      // 1. Load Profile first so we know if this user is a clerk attached to a chambers_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const activeProfile: ChamberProfile = userProfile
        ? {
            ...INITIAL_CHAMBER_PROFILE,
            ...userProfile,
            role: (userProfile.role as UserRole) || 'HEAD_OF_CHAMBERS',
          }
        : {
            ...INITIAL_CHAMBER_PROFILE,
            id: userId,
            role: 'HEAD_OF_CHAMBERS',
          };

      setStorage('chamber_profile', activeProfile);

      // Effective manager scope (either chambers_id for Clerk, or userId for Head of Chambers)
      const scopeId = activeProfile.chambers_id || userId;
      if (activeProfile.chambers_id && activeProfile.chambers_id !== userId) {
        localStorageKey = `estate_store_${scopeId}`;
        setStorage('chamber_profile', activeProfile);
      }

      // 2. Landlords
      const { data: cloudLandlords } = await supabase
        .from('landlords')
        .select('*')
        .eq('manager_id', scopeId);
      if (cloudLandlords) setStorage('landlords', cloudLandlords);

      // 3. Properties
      const { data: cloudProperties } = await supabase
        .from('properties')
        .select('*')
        .eq('manager_id', scopeId);
      if (cloudProperties) setStorage('properties', cloudProperties);

      // 4. Units
      const { data: cloudUnits } = await supabase
        .from('units')
        .select('*')
        .eq('manager_id', scopeId);
      if (cloudUnits) setStorage('units', cloudUnits);

      // 5. Invoices
      const { data: cloudInvoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('manager_id', scopeId);
      if (cloudInvoices) setStorage('invoices', cloudInvoices);

      // 6. Transactions
      const { data: cloudTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('manager_id', scopeId)
        .order('created_at', { ascending: false });
      if (cloudTransactions) setStorage('transactions', cloudTransactions);

      // 7. Optional New Tables (Graceful fallback if migration hasn't been executed on remote DB yet)
      try {
        const { data: cloudHistory } = await supabase
          .from('tenancy_history')
          .select('*')
          .eq('manager_id', scopeId)
          .order('created_at', { ascending: false });
        if (cloudHistory) setStorage('tenancy_history', cloudHistory);
      } catch {}

      try {
        const { data: cloudTranches } = await supabase
          .from('tranche_payments')
          .select('*')
          .eq('manager_id', scopeId)
          .order('created_at', { ascending: false });
        if (cloudTranches) setStorage('tranche_payments', cloudTranches);
      } catch {}

      try {
        const { data: cloudMatters } = await supabase
          .from('legal_matters')
          .select('*')
          .eq('manager_id', scopeId)
          .order('created_at', { ascending: false });
        if (cloudMatters) setStorage('legal_matters', cloudMatters);
      } catch {}

      try {
        const { data: cloudFeeNotes } = await supabase
          .from('solicitor_fee_notes')
          .select('*')
          .eq('manager_id', scopeId)
          .order('created_at', { ascending: false });
        if (cloudFeeNotes) setStorage('solicitor_fee_notes', cloudFeeNotes);
      } catch {}

      try {
        const { data: cloudFirmExpenses } = await supabase
          .from('firm_expenses')
          .select('*')
          .eq('manager_id', scopeId)
          .order('created_at', { ascending: false });
        if (cloudFirmExpenses) setStorage('firm_expenses', cloudFirmExpenses);
      } catch {}

      try {
        const { data: cloudApps } = await supabase
          .from('tenancy_applications')
          .select('*')
          .order('created_at', { ascending: false });
        if (cloudApps) setStorage('tenancy_applications', cloudApps);
      } catch {}

      notifySubscribers();
    } catch (err) {
      console.warn('Error fetching user-scoped data from Supabase:', err);
    }
  }

  // ============================================================================
  // 1. LANDLORDS
  // ============================================================================
  static getLandlords(): Landlord[] {
    return getStorage<Landlord[]>('landlords', INITIAL_LANDLORDS);
  }

  static getLandlordById(id: string): Landlord | undefined {
    return this.getLandlords().find((l) => l.id === id);
  }

  static async createLandlord(landlord: Omit<Landlord, 'id' | 'created_at'>): Promise<Landlord> {
    const managerId = landlord.manager_id || this.getEffectiveManagerId() || null;
    const actor = this.getAuditActor();

    const newLandlord: Landlord = {
      ...landlord,
      manager_id: managerId,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    if (supabase) {
      try {
        const payload: Record<string, any> = {
          id: newLandlord.id,
          name: newLandlord.name.trim(),
          email: newLandlord.email ? newLandlord.email.trim() : null,
          phone: newLandlord.phone ? newLandlord.phone.trim() : null,
          bank_name: newLandlord.bank_name || 'Zenith Bank PLC',
          account_number: newLandlord.account_number || '',
          account_name: newLandlord.account_name || newLandlord.name,
          default_mgt_rate: Number(newLandlord.default_mgt_rate) || 10.0,
        };
        if (managerId) payload.manager_id = managerId;

        const { error } = await supabase.from('landlords').insert(payload);
        if (error) {
          console.warn('Supabase insert landlord note:', error.message);
        }
      } catch (e: any) {
        console.warn('Supabase insert landlord note:', e);
      }
    }

    const landlords = getStorage<Landlord[]>('landlords', INITIAL_LANDLORDS);
    landlords.push(newLandlord);
    setStorage('landlords', landlords);
    notifySubscribers();

    return newLandlord;
  }

  static async updateLandlord(id: string, updates: Partial<Landlord>): Promise<Landlord | undefined> {
    if (this.isAccountantClerk()) {
      throw new Error('Access Denied: Only the Head of Chambers can alter Landlord bank details or fee rates.');
    }

    const landlords = getStorage<Landlord[]>('landlords', INITIAL_LANDLORDS);
    const index = landlords.findIndex((l) => l.id === id);
    if (index === -1) return undefined;

    landlords[index] = { ...landlords[index], ...updates };
    setStorage('landlords', landlords);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase.from('landlords').update(updates).eq('id', id);
      } catch (e) {
        console.warn('Supabase update landlord warning:', e);
      }
    }

    return landlords[index];
  }

  // ============================================================================
  // 2. PROPERTIES (Including Soft-Archiving `is_archived`)
  // ============================================================================
  static getProperties(includeArchived: boolean = false): Property[] {
    const props = getStorage<Property[]>('properties', INITIAL_PROPERTIES);
    const landlords = this.getLandlords();
    const mapped = props.map((p) => {
      const normalizedTitle = p.title?.replace(/^Mr\.\s+/i, '') || p.title;
      return {
        ...p,
        title: normalizedTitle,
        is_archived: Boolean(p.is_archived),
        landlord: landlords.find((l) => l.id === p.landlord_id),
      };
    });

    if (includeArchived) {
      return mapped;
    }
    return mapped.filter((p) => !p.is_archived);
  }

  static getPropertyById(id: string): Property | undefined {
    return this.getProperties(true).find((p) => p.id === id);
  }

  static async createProperty(property: Omit<Property, 'id' | 'created_at'>): Promise<Property> {
    const managerId = property.manager_id || this.getEffectiveManagerId() || null;
    const actor = this.getAuditActor();

    const newProp: Property = {
      ...property,
      manager_id: managerId,
      is_archived: false,
      archived_at: null,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      try {
        const payload: Record<string, any> = {
          id: newProp.id,
          landlord_id: newProp.landlord_id,
          title: newProp.title.trim(),
          address: newProp.address.trim(),
          state: newProp.state || 'Lagos',
        };
        if (managerId) payload.manager_id = managerId;

        const { error } = await supabase.from('properties').insert(payload);
        if (error && payload.manager_id && error.message?.includes('manager_id')) {
          delete payload.manager_id;
          await supabase.from('properties').insert(payload);
        }
      } catch (e) {
        console.warn('Supabase createProperty note:', e);
      }
    }

    const properties = getStorage<Property[]>('properties', INITIAL_PROPERTIES);
    properties.unshift(newProp);
    setStorage('properties', properties);
    notifySubscribers();

    return newProp;
  }

  static async toggleArchiveProperty(propertyId: string, archive: boolean): Promise<Property | undefined> {
    if (this.isAccountantClerk()) {
      throw new Error('Access Denied: Only the Head of Chambers can archive or decommission properties.');
    }

    const properties = getStorage<Property[]>('properties', INITIAL_PROPERTIES);
    const idx = properties.findIndex((p) => p.id === propertyId);
    if (idx === -1) return undefined;

    const nowIso = archive ? new Date().toISOString() : null;
    properties[idx] = {
      ...properties[idx],
      is_archived: archive,
      archived_at: nowIso,
    };
    setStorage('properties', properties);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase
          .from('properties')
          .update({ is_archived: archive, archived_at: nowIso })
          .eq('id', propertyId);
      } catch (e) {
        console.warn('Supabase archive property note:', e);
      }
    }

    return properties[idx];
  }

  // ============================================================================
  // 3. UNITS, NEW TENANT KYC ONBOARDING & VACATING / SOFT-ARCHIVING
  // ============================================================================
  static getUnits(propertyId?: string): Unit[] {
    const units = getStorage<Unit[]>('units', INITIAL_UNITS);
    const properties = this.getProperties(true);
    const joined = units.map((u) => ({
      ...u,
      property: properties.find((p) => p.id === u.property_id),
    }));

    if (propertyId) {
      return joined.filter((u) => u.property_id === propertyId);
    }
    return joined;
  }

  static getUnitById(id: string): Unit | undefined {
    return this.getUnits().find((u) => u.id === id);
  }

  static async createUnit(unit: Omit<Unit, 'id' | 'created_at'>): Promise<Unit> {
    const managerId = unit.manager_id || this.getEffectiveManagerId() || null;
    const actor = this.getAuditActor();

    const todayIso = new Date().toISOString();
    const isOccupied = Boolean(unit.is_occupied && unit.current_tenant_name?.trim());

    const newUnit: Unit = {
      ...unit,
      id: crypto.randomUUID(),
      manager_id: managerId,
      created_at: todayIso,
      is_occupied: isOccupied,
      lease_start_date: isOccupied ? unit.lease_start_date || todayIso.split('T')[0] : null,
      lease_end_date: isOccupied ? unit.lease_end_date : null,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    if (supabase) {
      try {
        const payload: Record<string, any> = {
          id: newUnit.id,
          property_id: newUnit.property_id,
          unit_name: (newUnit.unit_name || '').trim(),
          current_tenant_name: newUnit.current_tenant_name ? newUnit.current_tenant_name.trim() : null,
          tenant_phone: newUnit.tenant_phone ? newUnit.tenant_phone.trim() : null,
          tenant_email: newUnit.tenant_email ? newUnit.tenant_email.trim() : null,
          annual_rent: parseFloat(String(newUnit.annual_rent)) || 0,
          annual_service_charge: parseFloat(String(newUnit.annual_service_charge)) || 0,
          caution_fee: parseFloat(String(newUnit.caution_fee)) || 0,
          lease_start_date: newUnit.lease_start_date,
          lease_end_date: newUnit.lease_end_date,
          is_occupied: newUnit.is_occupied,
        };
        if (managerId) payload.manager_id = managerId;

        await supabase.from('units').insert(payload);
      } catch (e) {
        console.warn('Supabase createUnit note:', e);
      }
    }

    const units = getStorage<Unit[]>('units', INITIAL_UNITS);
    units.push(newUnit);
    setStorage('units', units);
    notifySubscribers();

    return newUnit;
  }

  static async updateUnit(
    unitId: string,
    updates: Partial<Unit> & {
      name?: string;
      tenant_name?: string | null;
      service_charge?: number;
    }
  ): Promise<Unit | undefined> {
    const units = getStorage<Unit[]>('units', INITIAL_UNITS);
    const index = units.findIndex((u) => u.id === unitId);
    if (index === -1) return undefined;

    const existing = units[index];
    const resolvedUnitName =
      updates.unit_name !== undefined
        ? updates.unit_name
        : updates.name !== undefined
        ? updates.name
        : existing.unit_name;

    const resolvedTenantName =
      updates.current_tenant_name !== undefined
        ? updates.current_tenant_name
        : updates.tenant_name !== undefined
        ? updates.tenant_name
        : existing.current_tenant_name;

    const resolvedServiceCharge =
      updates.annual_service_charge !== undefined
        ? Number(updates.annual_service_charge)
        : updates.service_charge !== undefined
        ? Number(updates.service_charge)
        : existing.annual_service_charge;

    const resolvedAnnualRent =
      updates.annual_rent !== undefined
        ? Number(updates.annual_rent)
        : existing.annual_rent;

    const resolvedCautionFee =
      updates.caution_fee !== undefined
        ? Number(updates.caution_fee)
        : existing.caution_fee;

    const resolvedIsOccupied =
      updates.is_occupied !== undefined
        ? updates.is_occupied
        : Boolean(resolvedTenantName && resolvedTenantName.trim());

    const updatedUnit: Unit = {
      ...existing,
      ...updates,
      unit_name: resolvedUnitName.trim(),
      current_tenant_name: resolvedTenantName ? resolvedTenantName.trim() : null,
      tenant_phone:
        updates.tenant_phone !== undefined
          ? updates.tenant_phone?.trim() || null
          : existing.tenant_phone,
      tenant_email:
        updates.tenant_email !== undefined
          ? updates.tenant_email?.trim() || null
          : existing.tenant_email,
      annual_rent: resolvedAnnualRent,
      annual_service_charge: resolvedServiceCharge,
      caution_fee: resolvedCautionFee,
      is_occupied: resolvedIsOccupied,
    };

    units[index] = updatedUnit;
    setStorage('units', units);
    notifySubscribers();

    if (supabase) {
      try {
        const dbUpdates: Record<string, any> = {
          unit_name: updatedUnit.unit_name,
          current_tenant_name: updatedUnit.current_tenant_name,
          tenant_phone: updatedUnit.tenant_phone,
          tenant_email: updatedUnit.tenant_email,
          tenant_nin_or_id: updatedUnit.tenant_nin_or_id ?? null,
          tenant_occupation: updatedUnit.tenant_occupation ?? null,
          tenant_employer: updatedUnit.tenant_employer ?? null,
          guarantor_name: updatedUnit.guarantor_name ?? null,
          guarantor_phone: updatedUnit.guarantor_phone ?? null,
          guarantor_address: updatedUnit.guarantor_address ?? null,
          guarantor_occupation: updatedUnit.guarantor_occupation ?? null,
          tenancy_type: updatedUnit.tenancy_type ?? 'RENEWAL',
          annual_rent: updatedUnit.annual_rent,
          annual_service_charge: updatedUnit.annual_service_charge,
          caution_fee: updatedUnit.caution_fee,
          lease_start_date: updatedUnit.lease_start_date,
          lease_end_date: updatedUnit.lease_end_date,
          is_occupied: updatedUnit.is_occupied,
          agreement_token: updatedUnit.agreement_token ?? undefined,
          passport_photo_url: updatedUnit.passport_photo_url ?? null,
          valid_id_url: updatedUnit.valid_id_url ?? null,
          tenant_signature_url: updatedUnit.tenant_signature_url ?? null,
          tenant_signed_at: updatedUnit.tenant_signed_at ?? null,
          executed_agreement_scan_url: updatedUnit.executed_agreement_scan_url ?? null,
          agreement_status: updatedUnit.agreement_status ?? 'PENDING',
        };
        await supabase.from('units').update(dbUpdates).eq('id', unitId);
      } catch (e) {
        console.warn('Supabase updateUnit note:', e);
      }
    }

    return updatedUnit;
  }

  /**
   * Requirement 4 & 5: Seamless New Tenant Onboarding from VACANT unit
   * Captures full KYC & Guarantor details, updates unit to OCCUPIED, and raises FIRST_YEAR Move-In Invoice
   * (with automatic 10% Tenant Legal/Agreement Fee credited 100% to the law firm and 0% Landlord Management Fee).
   */
  static async onboardNewTenant(data: {
    unit_id: string;
    tenant_name: string;
    tenant_phone: string;
    tenant_email: string;
    tenant_nin_or_id: string;
    tenant_occupation: string;
    tenant_employer: string;
    guarantor_name: string;
    guarantor_phone: string;
    guarantor_address: string;
    guarantor_occupation: string;
    annual_rent: number;
    annual_service_charge: number;
    caution_fee: number;
    lease_start_date: string;
    lease_end_date: string;
    passport_photo_url?: string | null;
    valid_id_url?: string | null;
    application_id?: string | null;
    raise_first_year_invoice?: boolean;
  }): Promise<{ unit: Unit; invoice?: Invoice }> {
    const actor = this.getAuditActor();
    const unit = this.getUnitById(data.unit_id);
    if (!unit) throw new Error('Target unit not found');

    let cloudPassport = data.passport_photo_url || null;
    if (cloudPassport && cloudPassport.startsWith('data:')) {
      cloudPassport = await uploadReceiptToStorage(cloudPassport, 'kyc-documents/passports');
    }
    let cloudValidId = data.valid_id_url || null;
    if (cloudValidId && cloudValidId.startsWith('data:')) {
      cloudValidId = await uploadReceiptToStorage(cloudValidId, 'kyc-documents/ids');
    }

    const updatedUnit = await this.updateUnit(data.unit_id, {
      current_tenant_name: data.tenant_name.trim(),
      tenant_phone: data.tenant_phone.trim() || null,
      tenant_email: data.tenant_email.trim() || null,
      tenant_nin_or_id: data.tenant_nin_or_id.trim() || null,
      tenant_occupation: data.tenant_occupation.trim() || null,
      tenant_employer: data.tenant_employer.trim() || null,
      guarantor_name: data.guarantor_name.trim() || null,
      guarantor_phone: data.guarantor_phone.trim() || null,
      guarantor_address: data.guarantor_address.trim() || null,
      guarantor_occupation: data.guarantor_occupation.trim() || null,
      tenancy_type: 'FIRST_YEAR',
      annual_rent: Number(data.annual_rent),
      annual_service_charge: Number(data.annual_service_charge) || 0,
      caution_fee: Number(data.caution_fee) || 0,
      lease_start_date: data.lease_start_date,
      lease_end_date: data.lease_end_date,
      is_occupied: true,
      agreement_token: unit.agreement_token || crypto.randomUUID(),
      passport_photo_url: cloudPassport,
      valid_id_url: cloudValidId,
      tenant_signature_url: null,
      tenant_signed_at: null,
      executed_agreement_scan_url: null,
      agreement_status: 'PENDING',
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    });

    if (!updatedUnit) throw new Error('Failed to update unit for new tenant');

    if (data.application_id) {
      await this.updateTenancyApplicationStatus(data.application_id, 'APPROVED');
    }

    let createdInvoice: Invoice | undefined;
    if (data.raise_first_year_invoice !== false) {
      createdInvoice = await this.createInvoice({
        property_id: updatedUnit.property_id,
        unit_id: updatedUnit.id,
        tenant_name: data.tenant_name.trim(),
        tenancy_type: 'FIRST_YEAR',
        rent_due: Number(data.annual_rent),
        service_charge_due: Number(data.annual_service_charge) || 0,
        caution_due: Number(data.caution_fee) || 0,
        due_date: data.lease_start_date,
        period_start: data.lease_start_date,
        period_end: data.lease_end_date,
      });
    }

    return { unit: updatedUnit, invoice: createdInvoice };
  }

  /**
   * Requirement 3: Tenant Vacating & Soft-Archiving
   * Captures move-out date, caution deposit held, deductions, refund amount, and settlement notes.
   * Atomically archives the full KYC/guarantor snapshot into `tenancy_history` and resets the unit to `VACANT`.
   */
  static async vacateAndArchiveTenant(data: {
    unit_id: string;
    move_out_date: string;
    caution_deposit_held: number;
    deductions_amount: number;
    refund_amount: number;
    settlement_notes: string;
  }): Promise<{ historyRecord: TenancyHistory; updatedUnit: Unit }> {
    const unit = this.getUnitById(data.unit_id);
    if (!unit) throw new Error('Unit not found');
    if (!unit.current_tenant_name) {
      throw new Error('This unit is already vacant.');
    }

    const actor = this.getAuditActor();
    const managerId = this.getEffectiveManagerId() || null;
    const nowIso = new Date().toISOString();

    const historyRecord: TenancyHistory = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      manager_id: managerId,
      property_id: unit.property_id,
      unit_id: unit.id,
      unit_name: unit.unit_name,
      property_title: unit.property?.title || 'Managed Estate',
      tenant_name: unit.current_tenant_name,
      tenant_phone: unit.tenant_phone || null,
      tenant_email: unit.tenant_email || null,
      tenant_nin_or_id: unit.tenant_nin_or_id || null,
      tenant_occupation: unit.tenant_occupation || null,
      tenant_employer: unit.tenant_employer || null,
      guarantor_name: unit.guarantor_name || null,
      guarantor_phone: unit.guarantor_phone || null,
      guarantor_address: unit.guarantor_address || null,
      guarantor_occupation: unit.guarantor_occupation || null,
      annual_rent: Number(unit.annual_rent) || 0,
      lease_start_date: unit.lease_start_date || null,
      lease_end_date: unit.lease_end_date || null,
      move_out_date: data.move_out_date,
      caution_deposit_held: Number(data.caution_deposit_held) || 0,
      deductions_amount: Number(data.deductions_amount) || 0,
      refund_amount: Number(data.refund_amount) || 0,
      settlement_notes: data.settlement_notes.trim() || null,
      passport_photo_url: unit.passport_photo_url || null,
      valid_id_url: unit.valid_id_url || null,
      tenant_signature_url: unit.tenant_signature_url || null,
      tenant_signed_at: unit.tenant_signed_at || null,
      executed_agreement_scan_url: unit.executed_agreement_scan_url || null,
      agreement_status: unit.agreement_status || 'PENDING',
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    // 1. Save to tenancy_history
    const historyList = getStorage<TenancyHistory[]>('tenancy_history', INITIAL_TENANCY_HISTORY);
    historyList.unshift(historyRecord);
    setStorage('tenancy_history', historyList);

    if (supabase) {
      try {
        await supabase.from('tenancy_history').insert(historyRecord);
      } catch (e) {
        console.warn('Supabase tenancy_history insert note:', e);
      }
    }

    // 2. Log Caution Escrow Settlement transactions if applicable
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    if (Number(data.deductions_amount) > 0) {
      const deductTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        manager_id: managerId,
        property_id: unit.property_id,
        unit_id: unit.id,
        invoice_id: null,
        tx_date: data.move_out_date,
        tx_type: 'MAINTENANCE_EXPENSE',
        funding_source: 'CAUTION_ESCROW',
        amount: Number(data.deductions_amount),
        description: `Move-Out Caution Deduction (${unit.current_tenant_name} - ${unit.unit_name})`,
        reference_note: data.settlement_notes || 'Move-out damages/dilapidation deduction',
        receipt_url: null,
        voucher_number: generateSerialRef('VCH'),
        is_stamped: true,
        recorded_by: actor.created_by_name,
        created_by: actor.created_by,
        created_by_name: actor.created_by_name,
      };
      transactions.unshift(deductTx);
    }

    if (Number(data.refund_amount) > 0) {
      const refundTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        manager_id: managerId,
        property_id: unit.property_id,
        unit_id: unit.id,
        invoice_id: null,
        tx_date: data.move_out_date,
        tx_type: 'CAUTION_REFUND',
        funding_source: 'CAUTION_ESCROW',
        amount: Number(data.refund_amount),
        description: `Caution Deposit Refund to Vacating Tenant: ${unit.current_tenant_name}`,
        reference_note: data.settlement_notes || 'Move-out caution settlement refund',
        receipt_url: null,
        recorded_by: actor.created_by_name,
        created_by: actor.created_by,
        created_by_name: actor.created_by_name,
      };
      transactions.unshift(refundTx);
    }
    setStorage('transactions', transactions);

    // 3. Reset Unit to VACANT
    const updatedUnit = await this.updateUnit(unit.id, {
      current_tenant_name: null,
      tenant_phone: null,
      tenant_email: null,
      tenant_nin_or_id: null,
      tenant_occupation: null,
      tenant_employer: null,
      guarantor_name: null,
      guarantor_phone: null,
      guarantor_address: null,
      guarantor_occupation: null,
      lease_start_date: null,
      lease_end_date: null,
      is_occupied: false,
      agreement_token: crypto.randomUUID(),
      passport_photo_url: null,
      valid_id_url: null,
      tenant_signature_url: null,
      tenant_signed_at: null,
      executed_agreement_scan_url: null,
      agreement_status: 'PENDING',
    });

    notifySubscribers();
    return { historyRecord, updatedUnit: updatedUnit! };
  }

  static getTenancyHistory(propertyId?: string, unitId?: string): TenancyHistory[] {
    const list = getStorage<TenancyHistory[]>('tenancy_history', INITIAL_TENANCY_HISTORY);
    return list.filter((item) => {
      if (unitId && item.unit_id !== unitId) return false;
      if (propertyId && item.property_id !== propertyId) return false;
      return true;
    });
  }

  // ============================================================================
  // 4B. PRE-ENTRY TENANCY APPLICATIONS & HYBRID TENANCY AGREEMENTS
  // ============================================================================
  static getTenancyApplications(unitId?: string, propertyId?: string): TenancyApplication[] {
    const apps = getStorage<TenancyApplication[]>(
      'tenancy_applications',
      INITIAL_TENANCY_APPLICATIONS
    );
    if (unitId) return apps.filter((a) => a.unit_id === unitId);
    if (propertyId) return apps.filter((a) => a.property_id === propertyId);
    return apps;
  }

  static async fetchUnitForPublicPortal(
    unitIdOrToken: string
  ): Promise<{ unit: Unit; profile: ChamberProfile } | null> {
    if (!unitIdOrToken) return null;

    const localUnits = this.getUnits();
    let foundUnit = localUnits.find(
      (u) => u.id === unitIdOrToken || u.agreement_token === unitIdOrToken
    );
    let profile = this.getChamberProfile();

    if (supabase) {
      try {
        let { data: unitRow } = await supabase
          .from('units')
          .select('*')
          .eq('id', unitIdOrToken)
          .maybeSingle();

        if (!unitRow) {
          const { data: tokenRow } = await supabase
            .from('units')
            .select('*')
            .eq('agreement_token', unitIdOrToken)
            .maybeSingle();
          unitRow = tokenRow;
        }

        if (unitRow) {
          let propRow: any = null;
          let landlordRow: any = null;
          if (unitRow.property_id) {
            const { data: pData } = await supabase
              .from('properties')
              .select('*')
              .eq('id', unitRow.property_id)
              .maybeSingle();
            propRow = pData;

            if (propRow?.landlord_id) {
              const { data: lData } = await supabase
                .from('landlords')
                .select('*')
                .eq('id', propRow.landlord_id)
                .maybeSingle();
              landlordRow = lData;
            }
          }

          foundUnit = {
            ...unitRow,
            property: propRow
              ? {
                  ...propRow,
                  landlord: landlordRow || undefined,
                }
              : foundUnit?.property,
          };

          const targetManagerId = unitRow.manager_id || propRow?.manager_id;
          if (targetManagerId) {
            const { data: profData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', targetManagerId)
              .maybeSingle();
            if (profData) {
              profile = { ...profile, ...profData };
            }
          }
        }
      } catch (e) {
        console.warn('Public portal unit fetch note:', e);
      }
    }

    if (!foundUnit) return null;
    return { unit: foundUnit, profile };
  }

  static async submitTenancyApplication(data: {
    unit_id: string;
    property_id: string;
    manager_id?: string | null;
    applicant_name: string;
    applicant_phone: string;
    applicant_email?: string;
    nin_or_id_number?: string;
    occupation?: string;
    employer?: string;
    previous_address?: string;
    guarantor_name: string;
    guarantor_phone: string;
    guarantor_address: string;
    guarantor_occupation?: string;
    passport_photo_url?: string | null;
    valid_id_url?: string | null;
  }): Promise<TenancyApplication> {
    let cloudPassport = data.passport_photo_url || null;
    if (cloudPassport && cloudPassport.startsWith('data:')) {
      cloudPassport = await uploadReceiptToStorage(cloudPassport, 'kyc-documents/passports');
    }

    let cloudValidId = data.valid_id_url || null;
    if (cloudValidId && cloudValidId.startsWith('data:')) {
      cloudValidId = await uploadReceiptToStorage(cloudValidId, 'kyc-documents/ids');
    }

    const newApp: TenancyApplication = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      manager_id: data.manager_id || this.getEffectiveManagerId() || null,
      unit_id: data.unit_id,
      property_id: data.property_id,
      applicant_name: data.applicant_name.trim(),
      applicant_phone: data.applicant_phone.trim(),
      applicant_email: data.applicant_email?.trim() || null,
      nin_or_id_number: data.nin_or_id_number?.trim() || null,
      occupation: data.occupation?.trim() || null,
      employer: data.employer?.trim() || null,
      previous_address: data.previous_address?.trim() || null,
      guarantor_name: data.guarantor_name.trim(),
      guarantor_phone: data.guarantor_phone.trim(),
      guarantor_address: data.guarantor_address.trim(),
      guarantor_occupation: data.guarantor_occupation?.trim() || null,
      passport_photo_url: cloudPassport,
      valid_id_url: cloudValidId,
      status: 'PENDING',
    };

    const apps = this.getTenancyApplications();
    apps.unshift(newApp);
    setStorage('tenancy_applications', apps);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase.from('tenancy_applications').insert(newApp);
      } catch (e) {
        console.warn('Supabase submitTenancyApplication note:', e);
      }
    }

    return newApp;
  }

  static async updateTenancyApplicationStatus(
    appId: string,
    status: ApplicationStatus
  ): Promise<TenancyApplication | undefined> {
    const apps = this.getTenancyApplications();
    const idx = apps.findIndex((a) => a.id === appId);
    if (idx !== -1) {
      apps[idx] = { ...apps[idx], status };
      setStorage('tenancy_applications', apps);
      notifySubscribers();
    }

    if (supabase) {
      try {
        await supabase.from('tenancy_applications').update({ status }).eq('id', appId);
      } catch {}
    }

    return idx !== -1 ? apps[idx] : undefined;
  }

  static async submitTenantESignature(
    unitIdOrToken: string,
    signatureDataUrl: string
  ): Promise<Unit | undefined> {
    const cloudSigUrl = signatureDataUrl.startsWith('data:')
      ? await uploadReceiptToStorage(signatureDataUrl, 'kyc-documents/signatures')
      : signatureDataUrl;

    const signedAt = new Date().toISOString();

    const units = getStorage<Unit[]>('units', INITIAL_UNITS);
    const idx = units.findIndex(
      (u) => u.id === unitIdOrToken || u.agreement_token === unitIdOrToken
    );

    let targetUnitId = idx !== -1 ? units[idx].id : unitIdOrToken;

    if (idx !== -1) {
      units[idx] = {
        ...units[idx],
        tenant_signature_url: cloudSigUrl,
        tenant_signed_at: signedAt,
        agreement_status:
          units[idx].agreement_status === 'EXECUTED_HARD_COPY'
            ? 'EXECUTED_HARD_COPY'
            : 'TENANT_E_SIGNED',
      };
      setStorage('units', units);
      notifySubscribers();
    }

    if (supabase) {
      try {
        const { data: updatedRows } = await supabase
          .from('units')
          .update({
            tenant_signature_url: cloudSigUrl,
            tenant_signed_at: signedAt,
            agreement_status: 'TENANT_E_SIGNED',
          })
          .or(`id.eq.${unitIdOrToken},agreement_token.eq.${unitIdOrToken}`)
          .select('*');

        if (updatedRows && updatedRows[0]) {
          targetUnitId = updatedRows[0].id;
        }
      } catch (e) {
        console.warn('Supabase submitTenantESignature note:', e);
      }
    }

    return this.getUnitById(targetUnitId);
  }

  static async uploadExecutedHardCopyAgreement(
    unitId: string,
    fileDataUrl: string
  ): Promise<Unit | undefined> {
    const cloudScanUrl = fileDataUrl.startsWith('data:')
      ? await uploadReceiptToStorage(fileDataUrl, 'kyc-documents/agreements')
      : fileDataUrl;

    return await this.updateUnit(unitId, {
      executed_agreement_scan_url: cloudScanUrl,
      agreement_status: 'EXECUTED_HARD_COPY',
    });
  }

  // ============================================================================
  // 4. INVOICES & PART-PAYMENT TRANCHE LEDGER (Requirements 2 & 5)
  // ============================================================================
  static getInvoices(propertyId?: string): Invoice[] {
    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
    const properties = this.getProperties(true);
    const units = this.getUnits();

    const joined = invoices.map((inv) => {
      const rentDue = Number(inv.rent_due) || 0;
      const legalFeeDue =
        inv.legal_fee_due !== undefined
          ? Number(inv.legal_fee_due)
          : inv.tenancy_type === 'FIRST_YEAR'
          ? rentDue * 0.1
          : 0;
      const sCharge = Number(inv.service_charge_due) || 0;
      const caution = Number(inv.caution_due) || 0;
      const totalPayable = Number(inv.total_amount_payable) || rentDue + legalFeeDue + sCharge + caution;
      const amountPaid =
        inv.amount_paid !== undefined
          ? Number(inv.amount_paid)
          : inv.status === 'PAID'
          ? totalPayable
          : 0;
      const balanceDue =
        inv.balance_due !== undefined
          ? Number(inv.balance_due)
          : Math.max(0, totalPayable - amountPaid);

      return {
        ...inv,
        tenancy_type: inv.tenancy_type || 'RENEWAL',
        legal_fee_due: legalFeeDue,
        total_amount_payable: totalPayable,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        property: properties.find((p) => p.id === inv.property_id),
        unit: units.find((u) => u.id === inv.unit_id),
      };
    });

    if (propertyId) {
      return joined.filter((i) => i.property_id === propertyId);
    }
    return joined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  static getInvoiceById(id: string): Invoice | undefined {
    const cleanId = (id || '').trim().toLowerCase();
    return this.getInvoices().find((i) => i.id?.toLowerCase() === cleanId);
  }

  static getInvoiceByToken(token: string): Invoice | undefined {
    const cleanToken = (token || '').trim().toLowerCase();
    return this.getInvoices().find(
      (i) =>
        i.access_token?.toLowerCase() === cleanToken ||
        i.id?.toLowerCase() === cleanToken
    );
  }

  static async fetchInvoiceByToken(token: string): Promise<Invoice | undefined> {
    const cleanToken = (token || '').trim();
    if (!cleanToken) return undefined;

    const local = this.getInvoiceByToken(cleanToken);
    if (local && local.property && local.property.landlord) {
      return local;
    }

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select(`
            *,
            property:properties(
              *,
              landlord:landlords(*)
            ),
            unit:units(*)
          `)
          .or(`access_token.eq.${cleanToken},id.eq.${cleanToken}`)
          .maybeSingle();

        if (data && !error) {
          const currentInvoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
          const index = currentInvoices.findIndex((i) => i.id === data.id);
          if (index !== -1) {
            currentInvoices[index] = { ...currentInvoices[index], ...data };
          } else {
            currentInvoices.unshift(data as Invoice);
          }
          setStorage('invoices', currentInvoices);
          notifySubscribers();
          return this.getInvoiceByToken(cleanToken);
        }
      } catch (err) {
        console.warn('Error fetching invoice from Supabase by token:', err);
      }
    }

    return this.getInvoiceByToken(cleanToken);
  }

  /**
   * Requirement 5:
   * - FIRST_YEAR tenancies automatically bill a 10% Legal/Agreement Fee to the tenant (credited 100% to the law firm)
   *   with 0% landlord management fee.
   * - RENEWAL tenancies charge 0 tenant legal fee and automatically deduct a 10% management fee from landlord rent.
   */
  static async createInvoice(data: {
    property_id: string;
    unit_id: string;
    tenant_name: string;
    tenancy_type?: TenancyType;
    rent_due: number;
    service_charge_due: number;
    caution_due: number;
    due_date: string;
    period_start: string;
    period_end: string;
    promise_to_pay_date?: string | null;
    management_fee_rate?: number;
    manager_id?: string | null;
  }): Promise<Invoice> {
    const managerId = data.manager_id || this.getEffectiveManagerId() || null;
    const actor = this.getAuditActor();
    const tenancyType: TenancyType = data.tenancy_type || 'RENEWAL';

    const rentDue = Number(data.rent_due) || 0;
    const serviceChargeDue = Number(data.service_charge_due || 0);
    const cautionDue = Number(data.caution_due || 0);

    // Enforce Requirement 5 rules:
    // FIRST_YEAR: 10% Legal/Agreement Fee billed to tenant, 0% Landlord Mgt Fee
    // RENEWAL: 0 Tenant Legal Fee, 10% (or custom rate) Landlord Mgt Fee
    const legalFeeDue = tenancyType === 'FIRST_YEAR' ? Math.round(rentDue * 0.1) : 0;
    const managementFeeRate =
      tenancyType === 'FIRST_YEAR'
        ? 0
        : data.management_fee_rate !== undefined
        ? Number(data.management_fee_rate)
        : 10.0;

    const total_amount_payable = rentDue + legalFeeDue + serviceChargeDue + cautionDue;

    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      access_token: crypto.randomUUID(),
      manager_id: managerId,
      property_id: data.property_id,
      unit_id: data.unit_id,
      tenant_name: data.tenant_name,
      tenancy_type: tenancyType,
      rent_due: rentDue,
      legal_fee_due: legalFeeDue,
      service_charge_due: serviceChargeDue,
      caution_due: cautionDue,
      management_fee_rate: managementFeeRate,
      total_amount_payable,
      amount_paid: 0,
      balance_due: total_amount_payable,
      promise_to_pay_date: data.promise_to_pay_date || null,
      due_date: data.due_date,
      period_start: data.period_start,
      period_end: data.period_end,
      status: 'SENT',
      proof_image_url: null,
      bank_session_id: null,
      verified_at: null,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
      created_at: new Date().toISOString(),
    };

    invoices.unshift(newInvoice);
    setStorage('invoices', invoices);
    notifySubscribers();

    if (supabase) {
      try {
        const payload: Record<string, any> = {
          id: newInvoice.id,
          access_token: newInvoice.access_token,
          property_id: newInvoice.property_id,
          unit_id: newInvoice.unit_id,
          tenant_name: newInvoice.tenant_name,
          rent_due: newInvoice.rent_due,
          service_charge_due: newInvoice.service_charge_due,
          caution_due: newInvoice.caution_due,
          due_date: newInvoice.due_date,
          period_start: newInvoice.period_start,
          period_end: newInvoice.period_end,
          status: 'SENT',
        };
        if (managerId) payload.manager_id = managerId;
        await supabase.from('invoices').insert(payload);
      } catch (e) {
        console.warn('Supabase insert invoice note:', e);
      }
    }

    return newInvoice;
  }

  /**
   * Requirement 2: Part-Payments & Installment Tranche Ledger
   * Records a tranche payment against an Invoice, issues an individual RCT-... receipt,
   * updates amount_paid, balance_due, promise_to_pay_date, and sets PARTIALLY_PAID or PAID.
   */
  static async recordInvoiceTranchePayment(data: {
    invoice_id: string;
    amount: number;
    payment_date: string;
    bank_reference?: string;
    promise_to_pay_date?: string | null;
    proof_url?: string | null;
  }): Promise<{ invoice: Invoice; tranche: TranchePayment; transactions: Transaction[] }> {
    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
    const idx = invoices.findIndex((i) => i.id === data.invoice_id);
    if (idx === -1) throw new Error('Invoice not found');

    const inv = this.getInvoices().find((i) => i.id === data.invoice_id)!;
    const trancheAmount = Number(data.amount) || 0;
    if (trancheAmount <= 0) throw new Error('Tranche payment amount must be greater than zero.');

    const actor = this.getAuditActor();
    const managerId = this.getEffectiveManagerId() || null;
    const nowIso = new Date().toISOString();

    let cloudProofUrl = data.proof_url || null;
    if (cloudProofUrl && cloudProofUrl.startsWith('data:')) {
      cloudProofUrl = await uploadReceiptToStorage(cloudProofUrl, 'proofs');
    }

    const prevPaid = Number(inv.amount_paid) || 0;
    const totalPayable = Number(inv.total_amount_payable) || 0;
    const newCumulativePaid = prevPaid + trancheAmount;
    const newBalanceDue = Math.max(0, totalPayable - newCumulativePaid);
    const isNowFullyPaid = newBalanceDue <= 0;

    const receiptNumber = generateSerialRef('RCT');

    const tranche: TranchePayment = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      manager_id: managerId,
      receipt_number: receiptNumber,
      payment_scope: 'ESTATE_INVOICE',
      invoice_id: inv.id,
      fee_note_id: null,
      property_id: inv.property_id,
      unit_id: inv.unit_id,
      payer_name: inv.tenant_name,
      payer_email: inv.unit?.tenant_email || null,
      payer_phone: inv.unit?.tenant_phone || null,
      amount: trancheAmount,
      cumulative_paid: newCumulativePaid,
      balance_remaining: newBalanceDue,
      payment_date: data.payment_date || nowIso.slice(0, 10),
      promise_to_pay_date: isNowFullyPaid ? null : data.promise_to_pay_date || inv.promise_to_pay_date || null,
      bank_reference: data.bank_reference || 'Bank Transfer Tranche',
      proof_url: cloudProofUrl,
      email_sent: false,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    const tranches = getStorage<TranchePayment[]>('tranche_payments', INITIAL_TRANCHE_PAYMENTS);
    tranches.unshift(tranche);
    setStorage('tranche_payments', tranches);

    // Proportional ledger allocation for this tranche
    const ratio = totalPayable > 0 ? Math.min(1, trancheAmount / totalPayable) : 1;
    const rentPortion = Math.round(Number(inv.rent_due) * ratio);
    const legalFeePortion = Math.round(Number(inv.legal_fee_due || 0) * ratio);
    const sChargePortion = Math.round(Number(inv.service_charge_due || 0) * ratio);
    const cautionPortion = Math.round(Number(inv.caution_due || 0) * ratio);

    const tenancyType: TenancyType = inv.tenancy_type || 'RENEWAL';
    const mgtFeeRate =
      tenancyType === 'FIRST_YEAR'
        ? 0
        : typeof inv.management_fee_rate === 'number'
        ? inv.management_fee_rate
        : 10.0;
    const renewalMgtFee = tenancyType === 'RENEWAL' ? Math.round(rentPortion * (mgtFeeRate / 100)) : 0;

    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const createdTx: Transaction[] = [];

    if (rentPortion > 0) {
      const rentTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        manager_id: managerId,
        property_id: inv.property_id,
        unit_id: inv.unit_id,
        invoice_id: inv.id,
        tx_date: tranche.payment_date,
        tx_type: 'RENT_INFLOW',
        funding_source: 'LANDLORD_RENT_POOL',
        amount: rentPortion,
        description: `Rent Tranche (${receiptNumber}): ${inv.tenant_name}`,
        reference_note: `${tranche.bank_reference} • Paid ${newCumulativePaid.toLocaleString()}/${totalPayable.toLocaleString()}`,
        receipt_url: cloudProofUrl,
        recorded_by: actor.created_by_name,
        created_by: actor.created_by,
        created_by_name: actor.created_by_name,
      };
      createdTx.push(rentTx);
      transactions.unshift(rentTx);
    }

    // FIRST_YEAR: 10% Tenant Legal/Agreement Fee credited 100% to Law Firm
    if (tenancyType === 'FIRST_YEAR' && legalFeePortion > 0) {
      const legalTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        manager_id: managerId,
        property_id: inv.property_id,
        unit_id: inv.unit_id,
        invoice_id: inv.id,
        tx_date: tranche.payment_date,
        tx_type: 'TENANT_LEGAL_FEE',
        funding_source: 'FIRM_REVENUE_POOL',
        amount: legalFeePortion,
        description: `10% First-Year Legal/Agreement Fee (${receiptNumber}): ${inv.tenant_name}`,
        reference_note: 'Credited 100% to Law Firm (0% Landlord Management Fee)',
        receipt_url: null,
        recorded_by: actor.created_by_name,
        created_by: actor.created_by,
        created_by_name: actor.created_by_name,
      };
      createdTx.push(legalTx);
      transactions.unshift(legalTx);
    }

    // RENEWAL: 10% Management Fee deducted from Landlord Rent
    if (tenancyType === 'RENEWAL' && renewalMgtFee > 0) {
      const mgtTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        manager_id: managerId,
        property_id: inv.property_id,
        unit_id: inv.unit_id,
        invoice_id: inv.id,
        tx_date: tranche.payment_date,
        tx_type: 'MANAGEMENT_FEE',
        funding_source: 'FIRM_REVENUE_POOL',
        amount: renewalMgtFee,
        description: `${mgtFeeRate}% Renewal Management Fee (${receiptNumber}): ${inv.tenant_name}`,
        reference_note: `Deducted from Landlord Rent (${mgtFeeRate}% Renewal Rate)`,
        receipt_url: null,
        recorded_by: actor.created_by_name,
        created_by: actor.created_by,
        created_by_name: actor.created_by_name,
      };
      createdTx.push(mgtTx);
      transactions.unshift(mgtTx);
    }

    if (sChargePortion > 0) {
      const scTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        manager_id: managerId,
        property_id: inv.property_id,
        unit_id: inv.unit_id,
        invoice_id: inv.id,
        tx_date: tranche.payment_date,
        tx_type: 'SERVICE_CHARGE',
        funding_source: 'SERVICE_CHARGE_POOL',
        amount: sChargePortion,
        description: `Service Charge (${receiptNumber}): ${inv.tenant_name}`,
        reference_note: 'Earmarked for Estate Ops',
        receipt_url: cloudProofUrl,
        recorded_by: actor.created_by_name,
        created_by: actor.created_by,
        created_by_name: actor.created_by_name,
      };
      createdTx.push(scTx);
      transactions.unshift(scTx);
    }

    if (cautionPortion > 0) {
      const cautionTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        manager_id: managerId,
        property_id: inv.property_id,
        unit_id: inv.unit_id,
        invoice_id: inv.id,
        tx_date: tranche.payment_date,
        tx_type: 'CAUTION_DEPOSIT',
        funding_source: 'CAUTION_ESCROW',
        amount: cautionPortion,
        description: `Caution Deposit (${receiptNumber}): ${inv.tenant_name}`,
        reference_note: 'Held in Caution Escrow',
        receipt_url: cloudProofUrl,
        recorded_by: actor.created_by_name,
        created_by: actor.created_by,
        created_by_name: actor.created_by_name,
      };
      createdTx.push(cautionTx);
      transactions.unshift(cautionTx);
    }

    // Update invoice
    const updatedInvoice: Invoice = {
      ...invoices[idx],
      amount_paid: newCumulativePaid,
      balance_due: newBalanceDue,
      promise_to_pay_date: tranche.promise_to_pay_date,
      status: isNowFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
      verified_at: isNowFullyPaid ? nowIso : invoices[idx].verified_at,
      bank_session_id: tranche.bank_reference || invoices[idx].bank_session_id,
      proof_image_url: cloudProofUrl || invoices[idx].proof_image_url,
    };
    invoices[idx] = updatedInvoice;

    if (isNowFullyPaid) {
      const units = getStorage<Unit[]>('units', INITIAL_UNITS);
      const uIdx = units.findIndex((u) => u.id === inv.unit_id);
      if (uIdx !== -1) {
        units[uIdx] = {
          ...units[uIdx],
          lease_start_date: inv.period_start,
          lease_end_date: inv.period_end,
          is_occupied: true,
        };
        setStorage('units', units);
      }
    }

    setStorage('invoices', invoices);
    setStorage('transactions', transactions);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase.from('tranche_payments').insert(tranche);
      } catch {}
      try {
        await supabase
          .from('invoices')
          .update({
            status: updatedInvoice.status,
            amount_paid: updatedInvoice.amount_paid,
            balance_due: updatedInvoice.balance_due,
            promise_to_pay_date: updatedInvoice.promise_to_pay_date,
            verified_at: updatedInvoice.verified_at,
          })
          .eq('id', inv.id);
      } catch {}
    }

    return {
      invoice: this.getInvoiceById(inv.id) || updatedInvoice,
      tranche,
      transactions: createdTx,
    };
  }

  static getTranchePayments(invoiceId?: string, feeNoteId?: string): TranchePayment[] {
    const list = getStorage<TranchePayment[]>('tranche_payments', INITIAL_TRANCHE_PAYMENTS);
    return list.filter((t) => {
      if (invoiceId && t.invoice_id !== invoiceId) return false;
      if (feeNoteId && t.fee_note_id !== feeNoteId) return false;
      return true;
    });
  }

  static async submitProofOfPayment(
    invoiceId: string,
    proofUrl: string,
    bankSessionId: string
  ): Promise<Invoice> {
    let cloudProofUrl = proofUrl;
    if (proofUrl && proofUrl.startsWith('data:')) {
      cloudProofUrl = await uploadReceiptToStorage(proofUrl, 'proofs');
    }

    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
    const index = invoices.findIndex((i) => i.id === invoiceId);
    if (index === -1) throw new Error('Invoice not found');

    invoices[index] = {
      ...invoices[index],
      status: 'AWAITING_VERIFICATION',
      proof_image_url: cloudProofUrl,
      bank_session_id: bankSessionId,
    };

    setStorage('invoices', invoices);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase
          .from('invoices')
          .update({
            status: 'AWAITING_VERIFICATION',
            proof_image_url: cloudProofUrl,
            bank_session_id: bankSessionId,
          })
          .eq('id', invoiceId);
      } catch (e) {
        console.warn('Supabase submit proof note:', e);
      }
    }

    return invoices[index];
  }

  static async markNotificationSent(
    invoiceId: string,
    tier: '9M' | '30D' | 'DAILY'
  ): Promise<Invoice | undefined> {
    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
    const index = invoices.findIndex((i) => i.id === invoiceId);
    if (index === -1) return undefined;

    const now = new Date().toISOString();
    let updates: Partial<Invoice> = {};

    if (tier === '9M') {
      updates = { notice_9m_sent: true, notice_9m_sent_at: now };
    } else if (tier === '30D') {
      updates = { notice_30d_sent: true, notice_30d_sent_at: now };
    } else if (tier === 'DAILY') {
      updates = { last_daily_reminder_sent_at: now };
    }

    invoices[index] = { ...invoices[index], ...updates };
    setStorage('invoices', invoices);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase.from('invoices').update(updates).eq('id', invoiceId);
      } catch (e) {
        console.warn('Supabase mark notification sent warning:', e);
      }
    }

    return invoices[index];
  }

  // 5. Full Invoice Verification (delegates to recordInvoiceTranchePayment for remaining balance)
  static async verifyTenantInvoice(
    invoiceId: string,
    verifiedBy?: string
  ): Promise<{ invoice: Invoice; transactions: Transaction[]; tranche?: TranchePayment }> {
    const inv = this.getInvoiceById(invoiceId);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status === 'PAID') {
      throw new Error('Invoice has already been marked as PAID.');
    }

    const remainingBalance =
      inv.balance_due !== undefined && inv.balance_due > 0
        ? inv.balance_due
        : inv.total_amount_payable - (inv.amount_paid || 0);

    const res = await this.recordInvoiceTranchePayment({
      invoice_id: invoiceId,
      amount: remainingBalance,
      payment_date: new Date().toISOString().slice(0, 10),
      bank_reference: inv.bank_session_id || `Verified by ${verifiedBy || this.getAuditActor().created_by_name}`,
      proof_url: inv.proof_image_url,
    });

    return {
      invoice: res.invoice,
      transactions: res.transactions,
      tranche: res.tranche,
    };
  }

  // ============================================================================
  // 6. TRANSACTIONS LEDGER & NO-RECEIPT ARTISAN VOUCHERS (Requirement 6)
  // ============================================================================
  static getTransactions(propertyId?: string): Transaction[] {
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const properties = this.getProperties(true);
    const units = this.getUnits();

    const joined = transactions.map((t) => ({
      ...t,
      property: properties.find((p) => p.id === t.property_id),
      unit: units.find((u) => u.id === t.unit_id),
    }));

    if (propertyId) {
      return joined.filter((t) => t.property_id === propertyId);
    }
    return joined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  static async logMaintenanceExpense(data: {
    property_id: string;
    unit_id?: string | null;
    amount: number;
    description: string;
    funding_source: FundingSource;
    artisan_name?: string;
    artisan_phone?: string;
    receipt_url?: string | null;
    work_photo_url?: string | null;
    recorded_by?: string;
  }): Promise<Transaction> {
    let cloudReceiptUrl = data.receipt_url || null;
    if (data.receipt_url && data.receipt_url.startsWith('data:')) {
      cloudReceiptUrl = await uploadReceiptToStorage(data.receipt_url, 'artisans');
    }

    let cloudWorkPhotoUrl = data.work_photo_url || null;
    if (data.work_photo_url && data.work_photo_url.startsWith('data:')) {
      cloudWorkPhotoUrl = await uploadReceiptToStorage(data.work_photo_url, 'artisans');
    }

    const managerId = this.getEffectiveManagerId() || null;
    const actor = this.getAuditActor();
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const nowIso = new Date().toISOString();
    const voucherNumber = generateSerialRef('VCH');

    const artisanSummary = [data.artisan_name, data.artisan_phone].filter(Boolean).join(' • ');

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      manager_id: managerId,
      property_id: data.property_id,
      unit_id: data.unit_id || null,
      invoice_id: null,
      tx_date: nowIso.slice(0, 10),
      tx_type: 'MAINTENANCE_EXPENSE',
      funding_source: data.funding_source,
      amount: Number(data.amount),
      description: data.description,
      reference_note: `${voucherNumber}${artisanSummary ? ` | Artisan: ${artisanSummary}` : ''}`,
      receipt_url: cloudReceiptUrl,
      voucher_number: voucherNumber,
      is_stamped: true, // Official Digital Payment Voucher stamped on creation
      work_photo_url: cloudWorkPhotoUrl,
      artisan_name: data.artisan_name || null,
      artisan_phone: data.artisan_phone || null,
      recorded_by: data.recorded_by || actor.created_by_name,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    transactions.unshift(newTx);
    setStorage('transactions', transactions);
    notifySubscribers();

    if (supabase) {
      try {
        const payload: Record<string, any> = {
          id: newTx.id,
          property_id: newTx.property_id,
          unit_id: newTx.unit_id,
          tx_date: newTx.tx_date,
          tx_type: 'MAINTENANCE_EXPENSE',
          funding_source: newTx.funding_source,
          amount: newTx.amount,
          description: newTx.description,
          reference_note: newTx.reference_note,
          receipt_url: newTx.receipt_url,
        };
        if (managerId) payload.manager_id = managerId;
        await supabase.from('transactions').insert(payload);
      } catch (e) {
        console.warn('Supabase log expense note:', e);
      }
    }

    return newTx;
  }

  static async recordRemittance(data: {
    property_id: string;
    amount: number;
    reference_note: string;
    bank_name: string;
    account_number: string;
    recorded_by?: string;
  }): Promise<Transaction> {
    const managerId = this.getEffectiveManagerId() || null;
    const actor = this.getAuditActor();
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const nowIso = new Date().toISOString();

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      manager_id: managerId,
      property_id: data.property_id,
      unit_id: null,
      invoice_id: null,
      tx_date: nowIso.slice(0, 10),
      tx_type: 'OWNER_REMITTANCE',
      funding_source: 'LANDLORD_RENT_POOL',
      amount: Number(data.amount),
      description: `Remittance to Landlord (${data.bank_name}: ${data.account_number})`,
      reference_note: data.reference_note,
      receipt_url: null,
      recorded_by: data.recorded_by || actor.created_by_name,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    transactions.unshift(newTx);
    setStorage('transactions', transactions);
    notifySubscribers();

    if (supabase) {
      try {
        const payload: Record<string, any> = {
          id: newTx.id,
          property_id: newTx.property_id,
          unit_id: null,
          tx_date: newTx.tx_date,
          tx_type: 'OWNER_REMITTANCE',
          funding_source: 'LANDLORD_RENT_POOL',
          amount: newTx.amount,
          description: newTx.description,
          reference_note: newTx.reference_note,
        };
        if (managerId) payload.manager_id = managerId;
        await supabase.from('transactions').insert(payload);
      } catch (e) {
        console.warn('Supabase record remittance note:', e);
      }
    }

    return newTx;
  }

  static async deleteTransaction(id: string): Promise<boolean> {
    if (this.isAccountantClerk()) {
      throw new Error('Access Denied: Accountant / Clerk role is not permitted to delete financial history or stamped vouchers.');
    }

    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const filtered = transactions.filter((t) => t.id !== id);
    setStorage('transactions', filtered);
    notifySubscribers();

    if (supabase) {
      try {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } catch (e: any) {
        console.warn('Error deleting transaction from Supabase:', e);
      }
    }

    return true;
  }

  // ============================================================================
  // 8. CHAMBERS / SOLICITORS FEE NOTE MODULE & FIRM EXPENSES (Reqs 8 & 9)
  // ============================================================================
  static getLegalMatters(): LegalMatter[] {
    return getStorage<LegalMatter[]>('legal_matters', INITIAL_LEGAL_MATTERS);
  }

  static async createLegalMatter(data: {
    title: string;
    category: MatterCategory;
    client_name: string;
    client_phone?: string;
    client_email?: string;
    client_address?: string;
    opened_date?: string;
    notes?: string;
  }): Promise<LegalMatter> {
    const actor = this.getAuditActor();
    const managerId = this.getEffectiveManagerId() || null;
    const nowIso = new Date().toISOString();

    const newMatter: LegalMatter = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      manager_id: managerId,
      matter_number: generateSerialRef('MAT'),
      title: data.title.trim(),
      category: data.category,
      client_name: data.client_name.trim(),
      client_phone: data.client_phone?.trim() || null,
      client_email: data.client_email?.trim() || null,
      client_address: data.client_address?.trim() || null,
      status: 'ACTIVE',
      opened_date: data.opened_date || nowIso.slice(0, 10),
      notes: data.notes?.trim() || null,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    const matters = this.getLegalMatters();
    matters.unshift(newMatter);
    setStorage('legal_matters', matters);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase.from('legal_matters').insert(newMatter);
      } catch {}
    }

    return newMatter;
  }

  static getSolicitorFeeNotes(): SolicitorFeeNote[] {
    return getStorage<SolicitorFeeNote[]>('solicitor_fee_notes', INITIAL_SOLICITOR_FEE_NOTES);
  }

  static async createSolicitorFeeNote(data: {
    matter_id: string;
    description: string;
    agreed_fee: number;
    initial_deposit?: number;
    due_date: string;
    promise_to_pay_date?: string | null;
    bank_reference?: string;
  }): Promise<{ feeNote: SolicitorFeeNote; initialTranche?: TranchePayment }> {
    const matter = this.getLegalMatters().find((m) => m.id === data.matter_id);
    if (!matter) throw new Error('Selected Legal Matter not found.');

    const actor = this.getAuditActor();
    const managerId = this.getEffectiveManagerId() || null;
    const nowIso = new Date().toISOString();

    const agreedFee = Number(data.agreed_fee) || 0;
    const newFeeNote: SolicitorFeeNote = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      manager_id: managerId,
      fee_note_number: generateSerialRef('FN'),
      matter_id: matter.id,
      matter_title: matter.title,
      matter_category: matter.category,
      client_name: matter.client_name,
      client_phone: matter.client_phone,
      client_email: matter.client_email,
      description: data.description.trim(),
      agreed_fee: agreedFee,
      amount_paid: 0,
      balance_due: agreedFee,
      due_date: data.due_date,
      promise_to_pay_date: data.promise_to_pay_date || null,
      status: 'SENT',
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    const feeNotes = this.getSolicitorFeeNotes();
    feeNotes.unshift(newFeeNote);
    setStorage('solicitor_fee_notes', feeNotes);

    if (supabase) {
      try {
        await supabase.from('solicitor_fee_notes').insert(newFeeNote);
      } catch {}
    }

    let initialTranche: TranchePayment | undefined;
    if (data.initial_deposit && Number(data.initial_deposit) > 0) {
      const res = await this.recordFeeNoteTranchePayment({
        fee_note_id: newFeeNote.id,
        amount: Number(data.initial_deposit),
        payment_date: nowIso.slice(0, 10),
        bank_reference: data.bank_reference || 'Initial Retainer Deposit',
        promise_to_pay_date: data.promise_to_pay_date || null,
      });
      return { feeNote: res.feeNote, initialTranche: res.tranche };
    }

    notifySubscribers();
    return { feeNote: newFeeNote, initialTranche };
  }

  static async recordFeeNoteTranchePayment(data: {
    fee_note_id: string;
    amount: number;
    payment_date: string;
    bank_reference?: string;
    promise_to_pay_date?: string | null;
    proof_url?: string | null;
  }): Promise<{ feeNote: SolicitorFeeNote; tranche: TranchePayment }> {
    const feeNotes = this.getSolicitorFeeNotes();
    const idx = feeNotes.findIndex((fn) => fn.id === data.fee_note_id);
    if (idx === -1) throw new Error('Solicitor Fee Note not found');

    const fn = feeNotes[idx];
    const trancheAmount = Number(data.amount) || 0;
    if (trancheAmount <= 0) throw new Error('Payment amount must be greater than zero.');

    const actor = this.getAuditActor();
    const managerId = this.getEffectiveManagerId() || null;
    const nowIso = new Date().toISOString();

    const newPaid = (Number(fn.amount_paid) || 0) + trancheAmount;
    const newBalance = Math.max(0, Number(fn.agreed_fee) - newPaid);
    const isFullyPaid = newBalance <= 0;

    const receiptNumber = generateSerialRef('RCT');

    const tranche: TranchePayment = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      manager_id: managerId,
      receipt_number: receiptNumber,
      payment_scope: 'SOLICITOR_FEE_NOTE',
      invoice_id: null,
      fee_note_id: fn.id,
      property_id: null,
      unit_id: null,
      payer_name: fn.client_name,
      payer_email: fn.client_email,
      payer_phone: fn.client_phone,
      amount: trancheAmount,
      cumulative_paid: newPaid,
      balance_remaining: newBalance,
      payment_date: data.payment_date || nowIso.slice(0, 10),
      promise_to_pay_date: isFullyPaid ? null : data.promise_to_pay_date || fn.promise_to_pay_date || null,
      bank_reference: data.bank_reference || 'Chambers Client Transfer',
      proof_url: data.proof_url || null,
      email_sent: false,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    const tranches = getStorage<TranchePayment[]>('tranche_payments', INITIAL_TRANCHE_PAYMENTS);
    tranches.unshift(tranche);
    setStorage('tranche_payments', tranches);

    const updatedFn: SolicitorFeeNote = {
      ...fn,
      amount_paid: newPaid,
      balance_due: newBalance,
      promise_to_pay_date: tranche.promise_to_pay_date,
      status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
    };
    feeNotes[idx] = updatedFn;
    setStorage('solicitor_fee_notes', feeNotes);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase.from('tranche_payments').insert(tranche);
      } catch {}
      try {
        await supabase
          .from('solicitor_fee_notes')
          .update({
            amount_paid: updatedFn.amount_paid,
            balance_due: updatedFn.balance_due,
            promise_to_pay_date: updatedFn.promise_to_pay_date,
            status: updatedFn.status,
          })
          .eq('id', fn.id);
      } catch {}
    }

    return { feeNote: updatedFn, tranche };
  }

  static getFirmExpenses(): FirmExpense[] {
    return getStorage<FirmExpense[]>('firm_expenses', INITIAL_FIRM_EXPENSES);
  }

  static async logFirmExpense(data: {
    category: FirmExpenseCategory;
    matter_id?: string | null;
    title: string;
    vendor_or_registry?: string;
    amount: number;
    expense_date?: string;
    receipt_url?: string | null;
    notes?: string;
  }): Promise<FirmExpense> {
    const actor = this.getAuditActor();
    const managerId = this.getEffectiveManagerId() || null;
    const nowIso = new Date().toISOString();

    let cloudReceiptUrl = data.receipt_url || null;
    if (cloudReceiptUrl && cloudReceiptUrl.startsWith('data:')) {
      cloudReceiptUrl = await uploadReceiptToStorage(cloudReceiptUrl, 'artisans');
    }

    const matter = data.matter_id
      ? this.getLegalMatters().find((m) => m.id === data.matter_id)
      : undefined;

    const newExpense: FirmExpense = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      manager_id: managerId,
      voucher_number: generateSerialRef('FVCH'),
      category: data.category,
      matter_id: data.matter_id || null,
      matter_title: matter?.title || null,
      title: data.title.trim(),
      vendor_or_registry: data.vendor_or_registry?.trim() || null,
      amount: Number(data.amount) || 0,
      expense_date: data.expense_date || nowIso.slice(0, 10),
      receipt_url: cloudReceiptUrl,
      notes: data.notes?.trim() || null,
      created_by: actor.created_by,
      created_by_name: actor.created_by_name,
    };

    const expenses = this.getFirmExpenses();
    expenses.unshift(newExpense);
    setStorage('firm_expenses', expenses);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase.from('firm_expenses').insert(newExpense);
      } catch {}
    }

    return newExpense;
  }

  static async deleteFirmExpense(id: string): Promise<boolean> {
    if (this.isAccountantClerk()) {
      throw new Error('Access Denied: Only the Head of Chambers can delete firm expense records.');
    }
    const list = this.getFirmExpenses().filter((e) => e.id !== id);
    setStorage('firm_expenses', list);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase.from('firm_expenses').delete().eq('id', id);
      } catch {}
    }
    return true;
  }

  /**
   * Requirement 9: Real-Time Law Firm Net Profit Summary
   * Tracks First-Year 10% Legal Fees + 10% Renewal Management Fees + Solicitor Fee Notes
   * against COURT_REGISTRY_DISBURSEMENT and FIRM_OVERHEAD.
   */
  static getFirmProfitSummary(): FirmProfitSummary {
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const feeNotes = this.getSolicitorFeeNotes();
    const firmExpenses = this.getFirmExpenses();

    let firstYearLegalFees = 0;
    let renewalManagementFees = 0;

    for (const tx of transactions) {
      const amt = Number(tx.amount) || 0;
      if (tx.tx_type === 'TENANT_LEGAL_FEE') {
        firstYearLegalFees += amt;
      } else if (tx.tx_type === 'MANAGEMENT_FEE') {
        renewalManagementFees += amt;
      }
    }

    const solicitorFeeNotesCollected = feeNotes.reduce(
      (sum, fn) => sum + (Number(fn.amount_paid) || 0),
      0
    );

    const totalFirmInflows =
      firstYearLegalFees + renewalManagementFees + solicitorFeeNotesCollected;

    let courtRegistryDisbursements = 0;
    let firmOverheads = 0;

    for (const exp of firmExpenses) {
      const amt = Number(exp.amount) || 0;
      if (exp.category === 'COURT_REGISTRY_DISBURSEMENT') {
        courtRegistryDisbursements += amt;
      } else {
        firmOverheads += amt;
      }
    }

    const totalFirmExpenses = courtRegistryDisbursements + firmOverheads;
    const netFirmProfit = totalFirmInflows - totalFirmExpenses;

    return {
      firstYearLegalFees,
      renewalManagementFees,
      solicitorFeeNotesCollected,
      totalFirmInflows,
      courtRegistryDisbursements,
      firmOverheads,
      totalFirmExpenses,
      netFirmProfit,
    };
  }

  // ============================================================================
  // 9. REAL-TIME PROPERTY ESCROW BALANCES VIEW (Strictly Isolated from Chambers)
  // ============================================================================
  static getPropertyBalances(propertyId?: string, includeArchived: boolean = false): PropertyBalances[] {
    const properties = this.getProperties(includeArchived);
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);

    const targetProps = propertyId
      ? properties.filter((p) => p.id === propertyId)
      : properties;

    return targetProps.map((p) => {
      const propTx = transactions.filter((t) => t.property_id === p.id);

      let landlordNet = 0;
      let serviceChargeNet = 0;
      let cautionEscrowNet = 0;
      let lawyerFeeRetained = 0;
      let firstYearLegalFees = 0;

      for (const tx of propTx) {
        const amt = Number(tx.amount) || 0;

        // Landlord Net Pool (Note: FIRST_YEAR TENANT_LEGAL_FEE does NOT deduct from Landlord Rent Pool)
        if (tx.tx_type === 'RENT_INFLOW') {
          landlordNet += amt;
        } else if (tx.tx_type === 'MANAGEMENT_FEE' || tx.tx_type === 'OWNER_REMITTANCE') {
          landlordNet -= amt;
        } else if (
          tx.tx_type === 'MAINTENANCE_EXPENSE' &&
          tx.funding_source === 'LANDLORD_RENT_POOL'
        ) {
          landlordNet -= amt;
        }

        // Service Charge Reserve Pool
        if (tx.tx_type === 'SERVICE_CHARGE') {
          serviceChargeNet += amt;
        } else if (
          tx.tx_type === 'MAINTENANCE_EXPENSE' &&
          tx.funding_source === 'SERVICE_CHARGE_POOL'
        ) {
          serviceChargeNet -= amt;
        }

        // Caution Escrow Pool
        if (tx.tx_type === 'CAUTION_DEPOSIT') {
          cautionEscrowNet += amt;
        } else if (
          tx.tx_type === 'CAUTION_REFUND' ||
          (tx.tx_type === 'MAINTENANCE_EXPENSE' && tx.funding_source === 'CAUTION_ESCROW')
        ) {
          cautionEscrowNet -= amt;
        }

        // Lawyer's Retained Fees (Renewal 10% Mgt Fee + First-Year 10% Tenant Legal Fee)
        if (tx.tx_type === 'MANAGEMENT_FEE') {
          lawyerFeeRetained += amt;
        } else if (tx.tx_type === 'TENANT_LEGAL_FEE') {
          firstYearLegalFees += amt;
          lawyerFeeRetained += amt;
        }
      }

      return {
        property_id: p.id,
        title: p.title,
        is_archived: p.is_archived,
        landlord_net_balance: landlordNet,
        service_charge_balance: serviceChargeNet,
        caution_escrow_balance: cautionEscrowNet,
        total_lawyer_fee_retained: lawyerFeeRetained,
        total_first_year_legal_fees: firstYearLegalFees,
      };
    });
  }

  // 10. Chambers / Firm Profile & Dynamic Letterhead Branding
  static getChamberProfile(): ChamberProfile {
    return getStorage<ChamberProfile>('chamber_profile', INITIAL_CHAMBER_PROFILE);
  }

  static async updateChamberProfile(updates: Partial<ChamberProfile>): Promise<ChamberProfile> {
    const current = this.getChamberProfile();
    let managerId = current.id;

    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          managerId = user.id;
        }
      } catch {}
    }

    const updated: ChamberProfile = {
      ...current,
      ...updates,
      id: updates.id || managerId || current.id,
      updated_at: new Date().toISOString(),
    };

    setStorage('chamber_profile', updated);
    notifySubscribers();

    if (supabase) {
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: updated.id,
            firm_name: updated.firm_name,
            solicitor_name: updated.solicitor_name,
            enrollment_no: updated.enrollment_no,
            phone: updated.phone,
            email: updated.email,
            office_address: updated.office_address,
            bank_name: updated.bank_name,
            account_number: updated.account_number,
            account_name: updated.account_name,
            letterhead_logo_url: updated.letterhead_logo_url,
            updated_at: updated.updated_at,
          });
      } catch (e) {
        console.warn('Supabase upsert profile warning:', e);
      }
    }

    return updated;
  }

  static async refreshFromCloud(): Promise<void> {
    hasInitializedCloudSync = false;
    await syncWithSupabase();
  }

  static resetState(): void {
    if (typeof window !== 'undefined') {
      try {
        if (currentUserId) {
          localStorage.removeItem(`estate_store_${currentUserId}`);
        }
        localStorage.removeItem(localStorageKey);
        localStorage.removeItem('estate_store_guest');
        purgeLegacyStorageKeys();
      } catch (e) {
        console.warn('Error clearing localStorage on resetState:', e);
      }
    }

    currentUserId = null;
    localStorageKey = 'estate_store_guest';

    setStorage('landlords', []);
    setStorage('properties', []);
    setStorage('units', []);
    setStorage('invoices', []);
    setStorage('transactions', []);
    setStorage('tenancy_history', []);
    setStorage('tranche_payments', []);
    setStorage('legal_matters', []);
    setStorage('solicitor_fee_notes', []);
    setStorage('firm_expenses', []);
    setStorage('cloud_balances', []);
    setStorage('chamber_profile', INITIAL_CHAMBER_PROFILE);

    notifySubscribers();
  }

  static resetToDefault(): void {
    this.resetState();
  }
}
