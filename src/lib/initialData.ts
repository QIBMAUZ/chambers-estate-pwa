import { Landlord, Property, Unit, Invoice, Transaction, ChamberProfile } from '@/types/database';

export const INITIAL_CHAMBER_PROFILE: ChamberProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  firm_name: 'BARR. T. A. BABATUNDE & ASSOCIATES',
  solicitor_name: 'Barr. T. A. Babatunde, LL.B, B.L',
  enrollment_no: 'SCN/2004/0981',
  phone: '+234 803 555 0192',
  email: 'chambers@babatundelaw.ng',
  office_address: 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria',
  letterhead_logo_url: null,
  bank_name: 'Zenith Bank PLC',
  account_number: '1012345678',
  account_name: 'Babatunde & Associates Client Account',
};

export const INITIAL_LANDLORDS: Landlord[] = [];
export const INITIAL_PROPERTIES: Property[] = [];
export const INITIAL_UNITS: Unit[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
