import { Landlord, Property, Unit, Invoice, Transaction, ChamberProfile } from '@/types/database';

export const INITIAL_CHAMBER_PROFILE: ChamberProfile = {
  id: '',
  firm_name: 'Estate Management',
  solicitor_name: 'Property Manager',
  enrollment_no: '',
  phone: '',
  email: '',
  office_address: '',
  letterhead_logo_url: null,
  bank_name: 'Zenith Bank PLC',
  account_number: '',
  account_name: '',
};

export const INITIAL_LANDLORDS: Landlord[] = [];
export const INITIAL_PROPERTIES: Property[] = [];
export const INITIAL_UNITS: Unit[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
