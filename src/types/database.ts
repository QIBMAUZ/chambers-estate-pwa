// Database Types & Domain Models for Nigerian Legal Property Management

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'AWAITING_VERIFICATION' | 'PAID' | 'OVERDUE';

export type TransactionType = 
  | 'RENT_INFLOW' 
  | 'SERVICE_CHARGE' 
  | 'CAUTION_DEPOSIT' 
  | 'MAINTENANCE_EXPENSE' 
  | 'MANAGEMENT_FEE' 
  | 'OWNER_REMITTANCE';

export type FundingSource = 
  | 'LANDLORD_RENT_POOL' 
  | 'SERVICE_CHARGE_POOL' 
  | 'CAUTION_ESCROW';

export interface Landlord {
  id: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  bank_name: string;
  account_number: string;
  account_name: string;
  default_mgt_rate: number; // e.g. 10.00
}

export interface Property {
  id: string;
  created_at: string;
  manager_id?: string | null;
  landlord_id: string;
  title: string;
  address: string;
  state: string;
  landlord?: Landlord;
}

export interface Unit {
  id: string;
  created_at: string;
  manager_id?: string | null;
  property_id: string;
  unit_name: string; // e.g. "Flat 1", "Penthouse"
  current_tenant_name: string | null;
  tenant_phone: string | null;
  tenant_email: string | null;
  annual_rent: number;
  annual_service_charge: number;
  caution_fee: number;
  lease_start_date: string | null;
  lease_end_date: string | null;
  is_occupied: boolean;
  property?: Property;
}

export interface Invoice {
  id: string;
  access_token: string;
  manager_id?: string | null;
  property_id: string;
  unit_id: string;
  tenant_name: string;
  rent_due: number;
  service_charge_due: number;
  caution_due: number;
  management_fee_rate?: number;
  total_amount_payable: number;
  due_date: string;
  period_start: string;
  period_end: string;
  status: InvoiceStatus;
  proof_image_url: string | null;
  bank_session_id: string | null;
  verified_at: string | null;
  notice_9m_sent?: boolean;
  notice_9m_sent_at?: string | null;
  notice_30d_sent?: boolean;
  notice_30d_sent_at?: string | null;
  last_daily_reminder_sent_at?: string | null;
  created_at: string;
  property?: Property;
  unit?: Unit;
}

export interface Transaction {
  id: string;
  created_at: string;
  property_id: string;
  unit_id: string | null;
  invoice_id: string | null;
  tx_date: string;
  tx_type: TransactionType;
  funding_source: FundingSource | null;
  amount: number;
  description: string;
  reference_note: string | null;
  receipt_url: string | null;
  recorded_by: string | null;
  property?: Property;
  unit?: Unit;
}

export interface PropertyBalances {
  property_id: string;
  title: string;
  landlord_net_balance: number;
  service_charge_balance: number;
  total_lawyer_fee_retained: number;
}

export interface ChamberProfile {
  id: string;
  firm_name: string;
  solicitor_name: string;
  enrollment_no: string;
  phone: string;
  email: string;
  office_address: string;
  letterhead_logo_url: string | null;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  updated_at?: string;
}
