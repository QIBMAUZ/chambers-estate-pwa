// Database Types & Domain Models for Nigerian Legal Property & Chambers Management PWA

export type UserRole = 'HEAD_OF_CHAMBERS' | 'ACCOUNTANT_CLERK';

export type TenancyType = 'FIRST_YEAR' | 'RENEWAL';

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_PAID'
  | 'AWAITING_VERIFICATION'
  | 'PAID'
  | 'OVERDUE';

export type TransactionType =
  | 'RENT_INFLOW'
  | 'TENANT_LEGAL_FEE'
  | 'SERVICE_CHARGE'
  | 'CAUTION_DEPOSIT'
  | 'CAUTION_REFUND'
  | 'MAINTENANCE_EXPENSE'
  | 'MANAGEMENT_FEE'
  | 'OWNER_REMITTANCE';

export type FundingSource =
  | 'LANDLORD_RENT_POOL'
  | 'SERVICE_CHARGE_POOL'
  | 'CAUTION_ESCROW'
  | 'FIRM_REVENUE_POOL';

export type MatterCategory =
  | 'LITIGATION'
  | 'CAC'
  | 'LAND_PERFECTION'
  | 'CONSULTANCY'
  | 'GENERAL_SOLICITOR';

export type FirmExpenseCategory =
  | 'COURT_REGISTRY_DISBURSEMENT'
  | 'FIRM_OVERHEAD';

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AgreementStatus = 'PENDING' | 'TENANT_E_SIGNED' | 'EXECUTED_HARD_COPY';

export interface Landlord {
  id: string;
  created_at: string;
  manager_id?: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  bank_name: string;
  account_number: string;
  account_name: string;
  default_mgt_rate: number; // e.g. 10.00
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface Property {
  id: string;
  created_at: string;
  manager_id?: string | null;
  landlord_id: string;
  title: string;
  address: string;
  state: string;
  default_mgt_rate?: number;
  is_archived?: boolean;
  archived_at?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
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
  tenant_nin_or_id?: string | null;
  tenant_occupation?: string | null;
  tenant_employer?: string | null;
  guarantor_name?: string | null;
  guarantor_phone?: string | null;
  guarantor_address?: string | null;
  guarantor_occupation?: string | null;
  tenancy_type?: TenancyType;
  annual_rent: number;
  annual_service_charge: number;
  caution_fee: number;
  lease_start_date: string | null;
  lease_end_date: string | null;
  is_occupied: boolean;
  agreement_token?: string | null;
  passport_photo_url?: string | null;
  valid_id_url?: string | null;
  tenant_signature_url?: string | null;
  tenant_signed_at?: string | null;
  executed_agreement_scan_url?: string | null;
  agreement_status?: AgreementStatus;
  created_by?: string | null;
  created_by_name?: string | null;
  property?: Property;
}

export interface TenancyApplication {
  id: string;
  created_at: string;
  manager_id?: string | null;
  unit_id: string;
  property_id: string;
  applicant_name: string;
  applicant_phone: string;
  applicant_email: string | null;
  nin_or_id_number?: string | null;
  occupation: string | null;
  employer: string | null;
  previous_address: string | null;
  guarantor_name: string;
  guarantor_phone: string;
  guarantor_address: string;
  guarantor_occupation: string | null;
  passport_photo_url: string | null;
  valid_id_url: string | null;
  status: ApplicationStatus;
}

export interface TenancyHistory {
  id: string;
  created_at: string;
  manager_id?: string | null;
  property_id: string;
  unit_id: string;
  unit_name: string;
  property_title?: string;
  tenant_name: string;
  tenant_phone: string | null;
  tenant_email: string | null;
  tenant_nin_or_id: string | null;
  tenant_occupation: string | null;
  tenant_employer: string | null;
  guarantor_name: string | null;
  guarantor_phone: string | null;
  guarantor_address: string | null;
  guarantor_occupation: string | null;
  annual_rent: number;
  lease_start_date: string | null;
  lease_end_date: string | null;
  move_out_date: string;
  caution_deposit_held: number;
  deductions_amount: number;
  refund_amount: number;
  settlement_notes: string | null;
  passport_photo_url?: string | null;
  valid_id_url?: string | null;
  tenant_signature_url?: string | null;
  tenant_signed_at?: string | null;
  executed_agreement_scan_url?: string | null;
  agreement_status?: AgreementStatus;
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface Invoice {
  id: string;
  access_token: string;
  manager_id?: string | null;
  property_id: string;
  unit_id: string;
  tenant_name: string;
  tenancy_type?: TenancyType; // 'FIRST_YEAR' | 'RENEWAL'
  rent_due: number;
  legal_fee_due?: number; // 10% Tenant Legal/Agreement Fee for FIRST_YEAR (0 for RENEWAL)
  service_charge_due: number;
  caution_due: number;
  management_fee_rate?: number; // 0% for FIRST_YEAR, 10% for RENEWAL
  total_amount_payable: number;
  amount_paid?: number;
  balance_due?: number;
  promise_to_pay_date?: string | null;
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
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  property?: Property;
  unit?: Unit;
}

export interface TranchePayment {
  id: string;
  created_at: string;
  manager_id?: string | null;
  receipt_number: string; // e.g. "RCT-20261112-4091"
  payment_scope: 'ESTATE_INVOICE' | 'SOLICITOR_FEE_NOTE';
  invoice_id: string | null;
  fee_note_id: string | null;
  property_id?: string | null;
  unit_id?: string | null;
  payer_name: string;
  payer_email: string | null;
  payer_phone: string | null;
  amount: number;
  cumulative_paid: number;
  balance_remaining: number;
  payment_date: string;
  promise_to_pay_date: string | null;
  bank_reference: string | null;
  proof_url: string | null;
  email_sent?: boolean;
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface Transaction {
  id: string;
  created_at: string;
  manager_id?: string | null;
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
  voucher_number?: string | null; // e.g. "VCH-20261112-1024"
  is_stamped?: boolean;
  work_photo_url?: string | null;
  artisan_name?: string | null;
  artisan_phone?: string | null;
  recorded_by: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  property?: Property;
  unit?: Unit;
}

export interface LegalMatter {
  id: string;
  created_at: string;
  manager_id?: string | null;
  matter_number: string; // e.g. "MAT-2026-001"
  title: string;
  category: MatterCategory;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_address?: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  opened_date: string;
  notes: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface SolicitorFeeNote {
  id: string;
  created_at: string;
  manager_id?: string | null;
  fee_note_number: string; // e.g. "FN-20261112-8821"
  matter_id: string;
  matter_title: string;
  matter_category: MatterCategory;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  description: string;
  agreed_fee: number;
  amount_paid: number;
  balance_due: number;
  due_date: string;
  promise_to_pay_date: string | null;
  status: InvoiceStatus;
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface FirmExpense {
  id: string;
  created_at: string;
  manager_id?: string | null;
  voucher_number: string; // e.g. "FVCH-20261112-001"
  category: FirmExpenseCategory; // 'COURT_REGISTRY_DISBURSEMENT' | 'FIRM_OVERHEAD'
  matter_id: string | null;
  matter_title?: string | null;
  title: string;
  vendor_or_registry: string | null;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  notes: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
}

export interface PropertyBalances {
  property_id: string;
  title: string;
  is_archived?: boolean;
  landlord_net_balance: number;
  service_charge_balance: number;
  caution_escrow_balance?: number;
  total_lawyer_fee_retained: number;
  total_first_year_legal_fees?: number;
}

export interface FirmProfitSummary {
  firstYearLegalFees: number;
  renewalManagementFees: number;
  solicitorFeeNotesCollected: number;
  totalFirmInflows: number;
  courtRegistryDisbursements: number;
  firmOverheads: number;
  totalFirmExpenses: number;
  netFirmProfit: number;
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
  role?: UserRole;
  chambers_id?: string | null;
  full_name?: string | null;
  updated_at?: string;
}
