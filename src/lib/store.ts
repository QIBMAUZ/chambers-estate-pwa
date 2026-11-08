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
} from '@/types/database';
import {
  INITIAL_LANDLORDS,
  INITIAL_PROPERTIES,
  INITIAL_UNITS,
  INITIAL_INVOICES,
  INITIAL_TRANSACTIONS,
  INITIAL_CHAMBER_PROFILE,
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

    // Listen for auth state transitions (login/logout/switch account)
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        EstateStore.resetState();
      } else if (session?.user?.id && session.user.id !== currentUserId) {
        await EstateStore.init(session.user.id);
      }
    });

    // Subscribe to Supabase Realtime changes scoped to active manager
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
          const { data } = await supabase
            .from('invoices')
            .select('*')
            .eq('manager_id', currentUserId);
          setStorage('invoices', data || []);
          notifySubscribers();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        async () => {
          if (!currentUserId) return;
          const { data } = await supabase
            .from('transactions')
            .select('*')
            .eq('manager_id', currentUserId)
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

// Trigger initial sync on client
if (typeof window !== 'undefined') {
  setTimeout(() => {
    syncWithSupabase();
  }, 100);
}

export class EstateStore {
  // 0. Multi-Tenant Initialization & User-Scoped Storage
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

  static async fetchFromSupabase(userId: string): Promise<void> {
    if (!supabase || !userId) return;

    currentUserId = userId;
    localStorageKey = `estate_store_${userId}`;

    try {
      // 1. Landlords filtered by manager_id
      const { data: cloudLandlords } = await supabase
        .from('landlords')
        .select('*')
        .eq('manager_id', userId);
      setStorage('landlords', cloudLandlords || []);

      // 2. Properties filtered by manager_id
      const { data: cloudProperties } = await supabase
        .from('properties')
        .select('*')
        .eq('manager_id', userId);
      setStorage('properties', cloudProperties || []);

      // 3. Units filtered by manager_id
      const { data: cloudUnits } = await supabase
        .from('units')
        .select('*')
        .eq('manager_id', userId);
      setStorage('units', cloudUnits || []);

      // 4. Invoices filtered by manager_id
      const { data: cloudInvoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('manager_id', userId);
      setStorage('invoices', cloudInvoices || []);

      // 5. Transactions filtered by manager_id
      const { data: cloudTransactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('manager_id', userId)
        .order('created_at', { ascending: false });
      setStorage('transactions', cloudTransactions || []);

      // 6. Balances View scoped to this manager's properties
      const propIds = (cloudProperties || []).map((p: any) => p.id);
      if (propIds.length > 0) {
        const { data: cloudBalances } = await supabase
          .from('property_balances')
          .select('*')
          .in('property_id', propIds);
        setStorage('cloud_balances', cloudBalances || []);
      } else {
        setStorage('cloud_balances', []);
      }

      // 7. Manager Profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userProfile) {
        setStorage('chamber_profile', userProfile);
      } else {
        setStorage('chamber_profile', {
          ...INITIAL_CHAMBER_PROFILE,
          id: userId,
        });
      }

      notifySubscribers();
    } catch (err) {
      console.warn('Error fetching user-scoped data from Supabase:', err);
    }
  }

  // 1. Landlords
  static getLandlords(): Landlord[] {
    return getStorage<Landlord[]>('landlords', INITIAL_LANDLORDS);
  }

  static getLandlordById(id: string): Landlord | undefined {
    return this.getLandlords().find((l) => l.id === id);
  }

  static async createLandlord(landlord: Omit<Landlord, 'id' | 'created_at'>): Promise<Landlord> {
    let managerId: string | null = landlord.manager_id || currentUserId || null;
    if (!managerId && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        managerId = user?.id || null;
      } catch (err) {
        console.warn('Could not retrieve user for landlord manager_id:', err);
      }
    }

    const newLandlord: Landlord = {
      ...landlord,
      manager_id: managerId,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
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
        if (managerId) {
          payload.manager_id = managerId;
        }

        const { error } = await supabase.from('landlords').insert(payload);
        if (error) {
          console.error('Supabase insert landlord error:', error);
          throw new Error(error.message || 'Database error creating landlord');
        }
      } catch (e: any) {
        console.warn('Supabase insert landlord note:', e);
        throw e;
      }
    }

    const landlords = getStorage<Landlord[]>('landlords', INITIAL_LANDLORDS);
    landlords.push(newLandlord);
    setStorage('landlords', landlords);
    notifySubscribers();

    return newLandlord;
  }

  static async updateLandlord(id: string, updates: Partial<Landlord>): Promise<Landlord | undefined> {
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

  // 2. Properties
  static getProperties(): Property[] {
    const props = getStorage<Property[]>('properties', INITIAL_PROPERTIES);
    const landlords = this.getLandlords();
    return props.map((p) => {
      const normalizedTitle = p.title?.replace(/^Mr\.\s+/i, '') || p.title;
      return {
        ...p,
        title: normalizedTitle,
        landlord: landlords.find((l) => l.id === p.landlord_id),
      };
    });
  }

  static getPropertyById(id: string): Property | undefined {
    return this.getProperties().find((p) => p.id === id);
  }

  static async createProperty(property: Omit<Property, 'id' | 'created_at'>): Promise<Property> {
    let managerId: string | null = property.manager_id || null;
    if (!managerId && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        managerId = user?.id || null;
      } catch (err) {
        console.warn('Could not retrieve user for property manager_id:', err);
      }
    }

    const newProp: Property = {
      ...property,
      manager_id: managerId,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    // Persist to Supabase if configured
    if (supabase) {
      const payload: Record<string, any> = {
        id: newProp.id,
        landlord_id: newProp.landlord_id,
        title: newProp.title.trim(),
        address: newProp.address.trim(),
        state: newProp.state || 'Lagos',
      };
      if (managerId) {
        payload.manager_id = managerId;
      }

      const { error } = await supabase.from('properties').insert(payload);
      if (error) {
        if (payload.manager_id && error.message?.includes('column "manager_id" of relation "properties" does not exist')) {
          delete payload.manager_id;
          const retry = await supabase.from('properties').insert(payload);
          if (retry.error) {
            console.error('Supabase retry insert property error:', retry.error);
            throw new Error(retry.error.message || 'Database error creating property');
          }
        } else {
          console.error('Supabase insert property error:', error);
          throw new Error(error.message || 'Database error creating property');
        }
      }
    }

    // Update local store
    const properties = getStorage<Property[]>('properties', INITIAL_PROPERTIES);
    properties.unshift(newProp);
    setStorage('properties', properties);
    notifySubscribers();

    return newProp;
  }

  // 3. Units
  static getUnits(propertyId?: string): Unit[] {
    const units = getStorage<Unit[]>('units', INITIAL_UNITS);
    const properties = this.getProperties();
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
    let managerId: string | null = unit.manager_id || null;

    if (!managerId && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          managerId = user.id;
        }
      } catch (err) {
        console.warn('Could not retrieve user for unit manager_id:', err);
      }
    }

    const todayIso = new Date().toISOString();
    const defaultStart = todayIso.split('T')[0];
    const defaultEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const newUnit: Unit = {
      ...unit,
      id: crypto.randomUUID(),
      manager_id: managerId,
      created_at: todayIso,
      lease_start_date: unit.lease_start_date || defaultStart,
      lease_end_date: unit.lease_end_date || defaultEnd,
    };

    // Persist to Supabase if configured
    if (supabase) {
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
        is_occupied: Boolean(newUnit.is_occupied),
      };

      if (managerId) {
        payload.manager_id = managerId;
      }

      const { error } = await supabase.from('units').insert(payload);
      if (error) {
        if (payload.manager_id && error.message?.includes('column "manager_id" of relation "units" does not exist')) {
          delete payload.manager_id;
          const retry = await supabase.from('units').insert(payload);
          if (retry.error) {
            console.error('Supabase retry insert unit error:', retry.error);
            throw new Error(retry.error.message || 'Database error inserting tenancy unit');
          }
        } else {
          console.error('Supabase insert unit error:', error);
          throw new Error(error.message || 'Database error inserting tenancy unit');
        }
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

    const resolvedPhone =
      updates.tenant_phone !== undefined ? updates.tenant_phone : existing.tenant_phone;

    const resolvedEmail =
      updates.tenant_email !== undefined ? updates.tenant_email : existing.tenant_email;

    const resolvedLeaseStart =
      updates.lease_start_date !== undefined ? updates.lease_start_date : existing.lease_start_date;

    const resolvedLeaseEnd =
      updates.lease_end_date !== undefined ? updates.lease_end_date : existing.lease_end_date;

    const resolvedIsOccupied =
      updates.is_occupied !== undefined
        ? updates.is_occupied
        : Boolean(resolvedTenantName && resolvedTenantName.trim());

    const updatedUnit: Unit = {
      ...existing,
      unit_name: resolvedUnitName.trim(),
      current_tenant_name: resolvedTenantName ? resolvedTenantName.trim() : null,
      tenant_phone: resolvedPhone ? resolvedPhone.trim() : null,
      tenant_email: resolvedEmail ? resolvedEmail.trim() : null,
      annual_rent: resolvedAnnualRent,
      annual_service_charge: resolvedServiceCharge,
      caution_fee: resolvedCautionFee,
      lease_start_date: resolvedLeaseStart,
      lease_end_date: resolvedLeaseEnd,
      is_occupied: resolvedIsOccupied,
    };

    units[index] = updatedUnit;
    setStorage('units', units);

    // Sync active unpaid/draft invoices tied to this unit so Renewal Radar updates immediately
    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
    let invoicesModified = false;
    const unpaidInvoiceIdsToSync: Array<{ id: string; payload: Record<string, any> }> = [];

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      if (inv.unit_id === unitId && inv.status !== 'PAID') {
        const invUpdate: Partial<Invoice> = {};
        if (updatedUnit.current_tenant_name && inv.tenant_name !== updatedUnit.current_tenant_name) {
          invUpdate.tenant_name = updatedUnit.current_tenant_name;
        }
        if (updatedUnit.lease_start_date && inv.period_start !== updatedUnit.lease_start_date) {
          invUpdate.period_start = updatedUnit.lease_start_date;
        }
        if (updatedUnit.lease_end_date && inv.period_end !== updatedUnit.lease_end_date) {
          invUpdate.period_end = updatedUnit.lease_end_date;
          invUpdate.due_date = updatedUnit.lease_end_date;
        }

        if (Object.keys(invUpdate).length > 0) {
          invoices[i] = { ...inv, ...invUpdate };
          invoicesModified = true;
          unpaidInvoiceIdsToSync.push({ id: inv.id, payload: invUpdate });
        }
      }
    }

    if (invoicesModified) {
      setStorage('invoices', invoices);
    }

    notifySubscribers();

    // Persist to Supabase
    if (supabase) {
      const dbUpdates: Record<string, any> = {
        unit_name: updatedUnit.unit_name,
        current_tenant_name: updatedUnit.current_tenant_name,
        tenant_phone: updatedUnit.tenant_phone,
        tenant_email: updatedUnit.tenant_email,
        annual_rent: updatedUnit.annual_rent,
        annual_service_charge: updatedUnit.annual_service_charge,
        caution_fee: updatedUnit.caution_fee,
        lease_start_date: updatedUnit.lease_start_date,
        lease_end_date: updatedUnit.lease_end_date,
        is_occupied: updatedUnit.is_occupied,
      };

      const { error } = await supabase
        .from('units')
        .update(dbUpdates)
        .eq('id', unitId);

      if (error) {
        console.error('Supabase update unit error:', error);
        throw new Error(error.message || 'Database error updating tenancy unit');
      }

      // Sync corresponding unpaid invoices in Supabase
      for (const item of unpaidInvoiceIdsToSync) {
        try {
          await supabase.from('invoices').update(item.payload).eq('id', item.id);
        } catch (invErr) {
          console.warn('Could not sync invoice dates on unit update:', invErr);
        }
      }
    }

    return updatedUnit;
  }

  // 4. Invoices
  static getInvoices(propertyId?: string): Invoice[] {
    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
    const properties = this.getProperties();
    const units = this.getUnits();

    const joined = invoices.map((inv) => ({
      ...inv,
      property: properties.find((p) => p.id === inv.property_id),
      unit: units.find((u) => u.id === inv.unit_id),
    }));

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

    // 1. Check local storage first
    const local = this.getInvoiceByToken(cleanToken);
    if (local && local.property && local.property.landlord) {
      return local;
    }

    // 2. Fetch directly from live Supabase
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
          return data as Invoice;
        }
      } catch (err) {
        console.warn('Error fetching invoice from Supabase by token:', err);
      }
    }

    // 3. Fallback to getInvoices()
    return this.getInvoiceByToken(cleanToken);
  }

  static async createInvoice(data: {
    property_id: string;
    unit_id: string;
    tenant_name: string;
    rent_due: number;
    service_charge_due: number;
    caution_due: number;
    due_date: string;
    period_start: string;
    period_end: string;
    management_fee_rate?: number;
    manager_id?: string | null;
  }): Promise<Invoice> {
    let managerId = data.manager_id || null;
    if (!managerId && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        managerId = user?.id || null;
      } catch (err) {
        console.warn('Could not read user for invoice manager_id:', err);
      }
    }

    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
    const total_amount_payable =
      Number(data.rent_due) + Number(data.service_charge_due || 0) + Number(data.caution_due || 0);

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      access_token: crypto.randomUUID(),
      manager_id: managerId,
      property_id: data.property_id,
      unit_id: data.unit_id,
      tenant_name: data.tenant_name,
      rent_due: Number(data.rent_due),
      service_charge_due: Number(data.service_charge_due || 0),
      caution_due: Number(data.caution_due || 0),
      management_fee_rate: data.management_fee_rate ?? 10.0,
      total_amount_payable,
      due_date: data.due_date,
      period_start: data.period_start,
      period_end: data.period_end,
      status: 'SENT',
      proof_image_url: null,
      bank_session_id: null,
      verified_at: null,
      created_at: new Date().toISOString(),
    };

    invoices.unshift(newInvoice);
    setStorage('invoices', invoices);
    notifySubscribers();

    // Persist to Supabase
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
        if (managerId) {
          payload.manager_id = managerId;
        }

        const { error } = await supabase.from('invoices').insert(payload);
        if (error) {
          console.warn('Supabase insert invoice warning:', error);
        }
      } catch (e) {
        console.warn('Supabase insert invoice note:', e);
      }
    }

    return newInvoice;
  }

  static async submitProofOfPayment(
    invoiceId: string,
    proofUrl: string,
    bankSessionId: string
  ): Promise<Invoice> {
    // 1. Upload proof image to Supabase Storage if it's a data URL
    let cloudProofUrl = proofUrl;
    if (proofUrl && proofUrl.startsWith('data:')) {
      cloudProofUrl = await uploadReceiptToStorage(proofUrl, 'proofs');
    }

    // 2. Update local state
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

    // 3. Persist to Supabase
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
        await supabase
          .from('invoices')
          .update(updates)
          .eq('id', invoiceId);
      } catch (e) {
        console.warn('Supabase mark notification sent warning:', e);
      }
    }

    return invoices[index];
  }

  // 5. Automated Verification RPC Execution
  /**
   * Strictly follows the PostgreSQL PL/pgSQL function:
   * verify_tenant_invoice(p_invoice_id, p_verified_by)
   */
  static async verifyTenantInvoice(
    invoiceId: string,
    verifiedBy: string = 'Barr. T. A. Babatunde'
  ): Promise<{ invoice: Invoice; transactions: Transaction[] }> {
    const invoices = getStorage<Invoice[]>('invoices', INITIAL_INVOICES);
    const invoiceIndex = invoices.findIndex((i) => i.id === invoiceId);
    if (invoiceIndex === -1) throw new Error('Invoice not found');

    const inv = invoices[invoiceIndex];
    if (inv.status === 'PAID') {
      throw new Error('Invoice has already been marked as PAID.');
    }

    // Call Supabase RPC verify_tenant_invoice if available
    if (supabase) {
      try {
        const { error: rpcError } = await supabase.rpc('verify_tenant_invoice', {
          p_invoice_id: invoiceId,
          p_verified_by: null,
        });
        if (rpcError) {
          console.warn('Supabase RPC note:', rpcError.message);
        }
      } catch (err) {
        console.warn('Supabase RPC invocation note:', err);
      }
    }

    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const units = getStorage<Unit[]>('units', INITIAL_UNITS);
    const createdTx: Transaction[] = [];
    const properties = this.getProperties();
    const property = properties.find((p) => p.id === inv.property_id);
    const landlord = property?.landlord;
    const feeRate = typeof inv.management_fee_rate === 'number'
      ? inv.management_fee_rate
      : typeof landlord?.default_mgt_rate === 'number'
      ? landlord.default_mgt_rate
      : 10.0;

    const mgtFee = Number(inv.rent_due) * (feeRate / 100);
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);

    // 1. Inflow: Gross Rent into Landlord Rent Pool
    const rentTx: Transaction = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      property_id: inv.property_id,
      unit_id: inv.unit_id,
      invoice_id: inv.id,
      tx_date: today,
      tx_type: 'RENT_INFLOW',
      funding_source: 'LANDLORD_RENT_POOL',
      amount: Number(inv.rent_due),
      description: `Rent Payment: ${inv.tenant_name}`,
      reference_note: inv.bank_session_id || 'Direct Verification',
      receipt_url: inv.proof_image_url,
      recorded_by: verifiedBy,
    };
    createdTx.push(rentTx);
    transactions.unshift(rentTx);

    // 2. Outflow: Lawyer Retained Legal Management Fee
    const feeTx: Transaction = {
      id: crypto.randomUUID(),
      created_at: nowIso,
      property_id: inv.property_id,
      unit_id: inv.unit_id,
      invoice_id: inv.id,
      tx_date: today,
      tx_type: 'MANAGEMENT_FEE',
      funding_source: null,
      amount: mgtFee,
      description: `${feeRate}% Legal Fee: ${inv.tenant_name}`,
      reference_note: `Auto-calculated on verification (${feeRate}% agreed rate)`,
      receipt_url: null,
      recorded_by: verifiedBy,
    };
    createdTx.push(feeTx);
    transactions.unshift(feeTx);

    // 3. Inflow: Service Charge (earmarked for estate running costs, exempt from 10% fee)
    if (Number(inv.service_charge_due) > 0) {
      const scTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        property_id: inv.property_id,
        unit_id: inv.unit_id,
        invoice_id: inv.id,
        tx_date: today,
        tx_type: 'SERVICE_CHARGE',
        funding_source: 'SERVICE_CHARGE_POOL',
        amount: Number(inv.service_charge_due),
        description: `Service Charge: ${inv.tenant_name}`,
        reference_note: 'Earmarked for Estate Ops (Exempt from 10% Legal Fee)',
        receipt_url: inv.proof_image_url,
        recorded_by: verifiedBy,
      };
      createdTx.push(scTx);
      transactions.unshift(scTx);
    }

    // 4. Inflow: Caution Deposit (held in escrow, exempt from 10% fee)
    if (Number(inv.caution_due) > 0) {
      const cautionTx: Transaction = {
        id: crypto.randomUUID(),
        created_at: nowIso,
        property_id: inv.property_id,
        unit_id: inv.unit_id,
        invoice_id: inv.id,
        tx_date: today,
        tx_type: 'CAUTION_DEPOSIT',
        funding_source: 'CAUTION_ESCROW',
        amount: Number(inv.caution_due),
        description: `Caution Deposit: ${inv.tenant_name}`,
        reference_note: 'Held in Escrow for Tenancy Duration',
        receipt_url: inv.proof_image_url,
        recorded_by: verifiedBy,
      };
      createdTx.push(cautionTx);
      transactions.unshift(cautionTx);
    }

    // 5. Update Invoice status & timestamp
    const updatedInvoice: Invoice = {
      ...inv,
      status: 'PAID',
      verified_at: nowIso,
    };
    invoices[invoiceIndex] = updatedInvoice;

    // 6. Extend tenancy lease on unit
    const unitIndex = units.findIndex((u) => u.id === inv.unit_id);
    if (unitIndex !== -1) {
      units[unitIndex] = {
        ...units[unitIndex],
        lease_start_date: inv.period_start,
        lease_end_date: inv.period_end,
        is_occupied: true,
      };
      setStorage('units', units);
    }

    setStorage('invoices', invoices);
    setStorage('transactions', transactions);
    notifySubscribers();

    return { invoice: updatedInvoice, transactions: createdTx };
  }

  // 6. Transactions Ledger
  static getTransactions(propertyId?: string): Transaction[] {
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const properties = this.getProperties();
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

  // 7. Log Maintenance Expense
  static async logMaintenanceExpense(data: {
    property_id: string;
    unit_id?: string | null;
    amount: number;
    description: string;
    funding_source: FundingSource;
    artisan_name?: string;
    receipt_url?: string | null;
    recorded_by?: string;
  }): Promise<Transaction> {
    // 1. Upload receipt to Supabase Storage if data URL
    let cloudReceiptUrl = data.receipt_url || null;
    if (data.receipt_url && data.receipt_url.startsWith('data:')) {
      cloudReceiptUrl = await uploadReceiptToStorage(data.receipt_url, 'artisans');
    }

    let managerId: string | null = currentUserId || null;
    if (!managerId && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        managerId = user?.id || null;
      } catch {}
    }

    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const nowIso = new Date().toISOString();

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
      reference_note: data.artisan_name ? `Artisan / Vendor: ${data.artisan_name}` : null,
      receipt_url: cloudReceiptUrl,
      recorded_by: data.recorded_by || 'Property Manager',
    };

    transactions.unshift(newTx);
    setStorage('transactions', transactions);
    notifySubscribers();

    // Persist to Supabase
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
        if (managerId) {
          payload.manager_id = managerId;
        }
        await supabase.from('transactions').insert(payload);
      } catch (e) {
        console.warn('Supabase log expense note:', e);
      }
    }

    return newTx;
  }

  // 8. Record Landlord Remittance
  static async recordRemittance(data: {
    property_id: string;
    amount: number;
    reference_note: string;
    bank_name: string;
    account_number: string;
    recorded_by?: string;
  }): Promise<Transaction> {
    let managerId: string | null = currentUserId || null;
    if (!managerId && supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        managerId = user?.id || null;
      } catch {}
    }

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
      recorded_by: data.recorded_by || 'Property Manager',
    };

    transactions.unshift(newTx);
    setStorage('transactions', transactions);
    notifySubscribers();

    // Persist to Supabase
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
        if (managerId) {
          payload.manager_id = managerId;
        }
        await supabase.from('transactions').insert(payload);
      } catch (e) {
        console.warn('Supabase record remittance note:', e);
      }
    }

    return newTx;
  }

  // Delete transaction (reversing ledger balances immediately)
  static async deleteTransaction(id: string): Promise<boolean> {
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);
    const filtered = transactions.filter((t) => t.id !== id);
    setStorage('transactions', filtered);
    notifySubscribers();

    if (supabase) {
      try {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) {
          console.error('Supabase delete transaction error:', error);
          throw new Error(error.message);
        }
      } catch (e: any) {
        console.warn('Error deleting transaction from Supabase:', e);
        throw e;
      }
    }

    return true;
  }

  // 9. Real-time Balances View implementation (property_balances)
  static getPropertyBalances(propertyId?: string): PropertyBalances[] {
    const properties = this.getProperties();
    const transactions = getStorage<Transaction[]>('transactions', INITIAL_TRANSACTIONS);

    const targetProps = propertyId
      ? properties.filter((p) => p.id === propertyId)
      : properties;

    return targetProps.map((p) => {
      const propTx = transactions.filter((t) => t.property_id === p.id);

      let landlordNet = 0;
      let serviceChargeNet = 0;
      let lawyerFeeRetained = 0;

      for (const tx of propTx) {
        const amt = Number(tx.amount) || 0;

        // Landlord Net Pool
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

        // Lawyer's Retained 10% Fee
        if (tx.tx_type === 'MANAGEMENT_FEE') {
          lawyerFeeRetained += amt;
        }
      }

      return {
        property_id: p.id,
        title: p.title,
        landlord_net_balance: landlordNet,
        service_charge_balance: serviceChargeNet,
        total_lawyer_fee_retained: lawyerFeeRetained,
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

    // Persist to Supabase if configured
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

  // Force re-sync with Supabase
  static async refreshFromCloud(): Promise<void> {
    hasInitializedCloudSync = false;
    await syncWithSupabase();
  }

  // Reset all properties, units, invoices, and ledger pools to empty values
  static resetState(): void {
    if (typeof window !== 'undefined') {
      try {
        if (currentUserId) {
          localStorage.removeItem(`estate_store_${currentUserId}`);
        }
        localStorage.removeItem(localStorageKey);
        localStorage.removeItem('estate_store_guest');
        purgeLegacyStorageKeys();

        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('estate_store_') || k.startsWith(LEGACY_KEY_PREFIX))) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
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
    setStorage('cloud_balances', []);
    setStorage('chamber_profile', INITIAL_CHAMBER_PROFILE);

    notifySubscribers();
  }

  // Alias for backwards compatibility
  static resetToDefault(): void {
    this.resetState();
  }
}
