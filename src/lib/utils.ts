import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format amounts into Nigerian Naira (₦) with commas and decimals
 */
export function formatNaira(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₦0.00';
  }
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace('NGN', '₦');
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Format date into Nigerian business standard (e.g. 15 Nov 2026).
 * Safely parses YYYY-MM-DD directly to prevent UTC/locale timezone drift between server & client.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const isoDateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const year = isoDateMatch[1];
      const monthIdx = parseInt(isoDateMatch[2], 10) - 1;
      const day = parseInt(isoDateMatch[3], 10);
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${day} ${MONTH_NAMES[monthIdx]} ${year}`;
      }
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateString;
  }
}

/**
 * Sanitize a phone number into strict international digits for WhatsApp.
 * Strips '+', spaces, dashes, brackets.
 * Converts local Nigerian numbers like '08031234567' to '2348031234567'.
 */
export function sanitizeWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  // If local Nigerian number (11 digits starting with 0), convert to 234 format
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '234' + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Build a valid WhatsApp share URL that never hangs on the 'Send message to' spinner.
 * If a valid phone number is present, targets that chat directly: https://wa.me/<digits>?text=...
 * If no phone number is provided, uses https://api.whatsapp.com/send?text=... which opens contact picker.
 */
export function buildWhatsAppShareUrl(
  phone: string | null | undefined,
  encodedText: string
): string {
  const cleanPhone = sanitizeWhatsAppPhone(phone);
  if (cleanPhone && cleanPhone.length >= 8) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Generate formal WhatsApp demand note for a Nigerian tenant
 */
export function generateWhatsAppDemandText({
  tenantName,
  propertyTitle,
  unitName,
  rentDue,
  serviceChargeDue,
  cautionDue,
  totalDue,
  dueDate,
  paymentLink,
  accountDetails,
  firmName,
  solicitorName,
}: {
  tenantName: string;
  propertyTitle: string;
  unitName: string;
  rentDue: number;
  serviceChargeDue: number;
  cautionDue: number;
  totalDue: number;
  dueDate: string;
  paymentLink: string;
  accountDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  firmName?: string;
  solicitorName?: string;
}): string {
  const breakdown = [
    `*Rent Due:* ${formatNaira(rentDue)}`,
    serviceChargeDue > 0 ? `*Estate Service Charge:* ${formatNaira(serviceChargeDue)}` : null,
    cautionDue > 0 ? `*Caution Deposit (Refundable Escrow):* ${formatNaira(cautionDue)}` : null,
    `*TOTAL PAYABLE:* ${formatNaira(totalDue)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const firmHeader = (firmName || 'CHAMBERS OF LEGAL PROPERTY MANAGERS').toUpperCase();
  const signOffSolicitor = solicitorName || 'Legal Practitioners & Estate Solicitors';
  const signOffFirm = firmName || 'Chambers of Legal Property Managers';

  const cleanPaymentLink = paymentLink.trim();

  return encodeURIComponent(`*DEMAND NOTICE / RENT INVOICE*
*${firmHeader}*

Dear ${tenantName},

RE: *${unitName.toUpperCase()} - ${propertyTitle.toUpperCase()}*

This serves as the formal Rent Demand Notice for your upcoming lease tenancy cycle due on *${formatDate(dueDate)}*.

*FINANCIAL BREAKDOWN:*
${breakdown}

*OFFICIAL CLIENT TRUST ACCOUNT DETAILS:*
• *Bank:* ${accountDetails.bankName}
• *Account Number:* ${accountDetails.accountNumber}
• *Account Name:* ${accountDetails.accountName}

*SUBMIT PROOF OF PAYMENT:*
Please click your secure tenant payment link below to view your formal demand letter and upload your bank transfer receipt / session ID:

${cleanPaymentLink}

Thank you for your prompt attention and continuous cooperation.

_${signOffSolicitor}_
_${signOffFirm}_`);
}

export interface NoticeGeneratorParams {
  tenantName: string;
  propertyTitle: string;
  unitName: string;
  rentDue: number;
  serviceChargeDue: number;
  cautionDue: number;
  totalDue: number;
  dueDate: string;
  periodEnd?: string;
  paymentLink: string;
  accountDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  firmName?: string;
  solicitorName?: string;
}

/**
 * Tier 1: 9-Month Advance Notice (~90 days before expiration)
 * Polite early renewal notice of upcoming lease expiry.
 */
export function generate9MonthRenewalNotice(params: NoticeGeneratorParams): string {
  const {
    tenantName,
    propertyTitle,
    unitName,
    rentDue,
    serviceChargeDue,
    cautionDue,
    totalDue,
    dueDate,
    periodEnd,
    paymentLink,
    accountDetails,
    firmName,
    solicitorName,
  } = params;

  const breakdown = [
    `*Rent:* ${formatNaira(rentDue)}`,
    serviceChargeDue > 0 ? `*Service Charge:* ${formatNaira(serviceChargeDue)}` : null,
    cautionDue > 0 ? `*Caution Deposit:* ${formatNaira(cautionDue)}` : null,
    `*TOTAL:* ${formatNaira(totalDue)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const firmHeader = (firmName || 'CHAMBERS OF LEGAL PROPERTY MANAGERS').toUpperCase();
  const signOffSolicitor = solicitorName || 'Legal Practitioners & Estate Solicitors';
  const signOffFirm = firmName || 'Chambers of Legal Property Managers';
  const expiryDate = periodEnd || dueDate;
  const cleanPaymentLink = paymentLink.trim();

  return encodeURIComponent(`*ADVANCE LEASE EXPIRATION & RENEWAL NOTICE*
*${firmHeader}*

Dear ${tenantName},

RE: *ADVANCE NOTICE OF LEASE EXPIRATION - ${unitName.toUpperCase()}, ${propertyTitle.toUpperCase()}*

We hope this notice finds you well. As legal property managers for the above premises, we are writing to provide advance notice that your current tenancy cycle expires on *${formatDate(expiryDate)}*.

To ensure uninterrupted occupancy, kindly review the renewal schedule below:

*FINANCIAL SUMMARY:*
${breakdown}

*OFFICIAL CLIENT TRUST ACCOUNT DETAILS:*
• *Bank:* ${accountDetails.bankName}
• *Account Number:* ${accountDetails.accountNumber}
• *Account Name:* ${accountDetails.accountName}

*ACCESS TENANT PORTAL:*
You can review your tenancy statement and submit confirmation at:

${cleanPaymentLink}

Kindly confirm your renewal intentions well ahead of the expiry date.

_${signOffSolicitor}_
_${signOffFirm}_`);
}

/**
 * Tier 2: 30-Day Critical Demand Notice
 * Statutory pre-action demand for rent & service charge.
 */
export function generate30DayDemandNotice(params: NoticeGeneratorParams): string {
  const {
    tenantName,
    propertyTitle,
    unitName,
    rentDue,
    serviceChargeDue,
    cautionDue,
    totalDue,
    dueDate,
    paymentLink,
    accountDetails,
    firmName,
    solicitorName,
  } = params;

  const breakdown = [
    `*Rent Due:* ${formatNaira(rentDue)}`,
    serviceChargeDue > 0 ? `*Estate Service Charge:* ${formatNaira(serviceChargeDue)}` : null,
    cautionDue > 0 ? `*Caution Deposit:* ${formatNaira(cautionDue)}` : null,
    `*TOTAL PAYABLE:* ${formatNaira(totalDue)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const firmHeader = (firmName || 'CHAMBERS OF LEGAL PROPERTY MANAGERS').toUpperCase();
  const signOffSolicitor = solicitorName || 'Legal Practitioners & Estate Solicitors';
  const signOffFirm = firmName || 'Chambers of Legal Property Managers';
  const cleanPaymentLink = paymentLink.trim();

  return encodeURIComponent(`*STATUTORY 30-DAY RENEWAL DEMAND NOTICE*
*${firmHeader}*

Dear ${tenantName},

RE: *DEMAND FOR PAYMENT OF RENT & SERVICE CHARGES - ${unitName.toUpperCase()}, ${propertyTitle.toUpperCase()}*

TAKE NOTICE that your tenancy in respect of the above property falls due on *${formatDate(dueDate)}*. In accordance with tenancy covenants, this serves as formal statutory 30-day pre-expiry demand for the settlement of your renewal dues.

*ASSESSMENT & BREAKDOWN:*
${breakdown}

*OFFICIAL CLIENT TRUST ACCOUNT DETAILS:*
• *Bank:* ${accountDetails.bankName}
• *Account Number:* ${accountDetails.accountNumber}
• *Account Name:* ${accountDetails.accountName}

*SUBMIT PROOF OF PAYMENT:*
Please complete payment on or before the due date and upload your transfer receipt or bank session ID via your secure tenant portal:

${cleanPaymentLink}

Prompt compliance is required to formalize your renewal documentation and retain peaceful possession.

_${signOffSolicitor}_
_${signOffFirm}_`);
}

/**
 * Tier 3: Daily Overdue Chaser Reminder
 * Immediate overdue chase demanding payment and transfer proof upload.
 */
export function generateDailyReminderNotice(params: NoticeGeneratorParams): string {
  const {
    tenantName,
    propertyTitle,
    unitName,
    rentDue,
    serviceChargeDue,
    cautionDue,
    totalDue,
    dueDate,
    paymentLink,
    accountDetails,
    firmName,
    solicitorName,
  } = params;

  const breakdown = [
    `*Outstanding Rent:* ${formatNaira(rentDue)}`,
    serviceChargeDue > 0 ? `*Service Charge:* ${formatNaira(serviceChargeDue)}` : null,
    cautionDue > 0 ? `*Caution Deposit:* ${formatNaira(cautionDue)}` : null,
    `*TOTAL OVERDUE:* ${formatNaira(totalDue)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const firmHeader = (firmName || 'CHAMBERS OF LEGAL PROPERTY MANAGERS').toUpperCase();
  const signOffSolicitor = solicitorName || 'Legal Practitioners & Estate Solicitors';
  const signOffFirm = firmName || 'Chambers of Legal Property Managers';
  const cleanPaymentLink = paymentLink.trim();

  return encodeURIComponent(`*URGENT: OVERDUE RENT PAYMENT REMINDER*
*${firmHeader}*

Dear ${tenantName},

RE: *OVERDUE TENANCY DUES - ${unitName.toUpperCase()}, ${propertyTitle.toUpperCase()}*

This is an urgent reminder that your tenancy renewal dues for the above-captioned property fell due on *${formatDate(dueDate)}* and remain outstanding in our records.

*OUTSTANDING BALANCE:*
${breakdown}

*OFFICIAL CLIENT TRUST ACCOUNT DETAILS:*
• *Bank:* ${accountDetails.bankName}
• *Account Number:* ${accountDetails.accountNumber}
• *Account Name:* ${accountDetails.accountName}

*IMMEDIATE ACTION REQUIRED:*
If you have already made this bank transfer, please IMMEDIATELY upload your transfer receipt or bank session ID via your secure link below so our accounts team can verify and issue your legal receipt:

${cleanPaymentLink}

If payment has not been made, kindly settle the outstanding sum immediately to avert statutory recovery procedures.

_${signOffSolicitor}_
_${signOffFirm}_`);
}
