import {
  Landlord,
  Property,
  Unit,
  Invoice,
  Transaction,
  ChamberProfile,
  TenancyHistory,
  TranchePayment,
  LegalMatter,
  SolicitorFeeNote,
  FirmExpense,
  TenancyApplication,
} from '@/types/database';

export const INITIAL_CHAMBER_PROFILE: ChamberProfile = {
  id: '',
  firm_name: 'BARR. T. A. BABATUNDE & ASSOCIATES',
  solicitor_name: 'Barr. T. A. Babatunde, LL.B, B.L',
  enrollment_no: 'SCN/2004/0981',
  phone: '+234 803 555 0192',
  email: 'chambers@babatundelaw.ng',
  office_address: 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State, Nigeria',
  letterhead_logo_url: null,
  bank_name: 'Zenith Bank PLC',
  account_number: '1012345678',
  account_name: 'Babatunde & Associates Client Escrow',
  role: 'HEAD_OF_CHAMBERS',
  full_name: 'Barr. T. A. Babatunde (Head of Chambers)',
};

export const INITIAL_LANDLORDS: Landlord[] = [];
export const INITIAL_PROPERTIES: Property[] = [];
export const INITIAL_UNITS: Unit[] = [];
export const INITIAL_INVOICES: Invoice[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
export const INITIAL_TENANCY_HISTORY: TenancyHistory[] = [];
export const INITIAL_TRANCHE_PAYMENTS: TranchePayment[] = [];
export const INITIAL_LEGAL_MATTERS: LegalMatter[] = [];
export const INITIAL_SOLICITOR_FEE_NOTES: SolicitorFeeNote[] = [];
export const INITIAL_FIRM_EXPENSES: FirmExpense[] = [];
export const INITIAL_TENANCY_APPLICATIONS: TenancyApplication[] = [];
