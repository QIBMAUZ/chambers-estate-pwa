import nodemailer from 'nodemailer';
import { formatNaira, formatDate } from '@/lib/utils';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtppro.zoho.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface SendRenewalNoticeEmailParams {
  to: string;
  tenantName: string;
  propertyName: string;
  unitName: string;
  amountDue: number;
  rentDue?: number;
  legalFeeDue?: number;
  serviceChargeDue?: number;
  cautionDue?: number;
  dueDate: string;
  daysRemaining?: number;
  tier: '9M' | '30D' | 'DAILY' | 1 | 2 | 3;
  magicLink: string;
  firmName?: string;
  solicitorName?: string;
  accountDetails?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
}

export async function sendRenewalNoticeEmail({
  to,
  tenantName,
  propertyName,
  unitName,
  amountDue,
  rentDue,
  legalFeeDue,
  serviceChargeDue,
  cautionDue,
  dueDate,
  daysRemaining,
  tier,
  magicLink,
  firmName,
  solicitorName,
  accountDetails,
}: SendRenewalNoticeEmailParams): Promise<{ messageId?: string; skipped?: boolean }> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials (SMTP_USER / SMTP_PASS) not configured; skipping email dispatch.');
    return { skipped: true };
  }

  const normalizedTier =
    tier === 1 || tier === '9M' ? '9M' : tier === 2 || tier === '30D' ? '30D' : 'DAILY';

  let subject = '';
  let badgeText = '';
  let badgeColor = '#0284c7';
  let introParagraph = '';

  if (normalizedTier === '9M') {
    subject = `Advance Tenancy Renewal Advisory - ${unitName}, ${propertyName}`;
    badgeText = 'ADVANCE RENEWAL ADVISORY (9-MONTH MILESTONE)';
    badgeColor = '#0284c7';
    introParagraph = `As property managers for <strong>${propertyName}</strong>, we are writing to provide advance notice that your current tenancy cycle for <strong>${unitName}</strong> is scheduled to expire on <strong>${formatDate(dueDate)}</strong>. Kindly review your upcoming renewal assessment below and confirm your renewal intentions ahead of schedule.`;
  } else if (normalizedTier === '30D') {
    subject = `STATUTORY 30-DAY RENEWAL DEMAND NOTICE - ${unitName}`;
    badgeText = 'STATUTORY 30-DAY PRE-EXPIRY DEMAND';
    badgeColor = '#d97706';
    introParagraph = `TAKE NOTICE that your tenancy in respect of <strong>${unitName}, ${propertyName}</strong> falls due on <strong>${formatDate(dueDate)}</strong>. In accordance with your tenancy covenants, this serves as a formal statutory 30-day demand notice for the settlement of your renewal rent and ancillary charges.`;
  } else {
    subject = `URGENT PAYMENT DEMAND: Tenancy Expiration Countdown - ${unitName}`;
    badgeText = 'URGENT PAYMENT DEMAND / EXPIRATION COUNTDOWN';
    badgeColor = '#dc2626';
    introParagraph = `This is an urgent reminder regarding your tenancy at <strong>${unitName}, ${propertyName}</strong>, with a due date of <strong>${formatDate(dueDate)}</strong>. Please complete your payment immediately or upload your transfer receipt via the secure portal button below so our team can verify and issue your official receipt.`;
  }

  const displayFirm = (firmName || 'Chambers & Estate Management').toUpperCase();
  const displaySolicitor = solicitorName || 'Principal Solicitor & Estate Manager';

  let computedDaysRemaining = daysRemaining;
  if (computedDaysRemaining === undefined && dueDate) {
    const [y, m, d] = dueDate.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    computedDaysRemaining = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const daysStatusLabel =
    computedDaysRemaining === undefined
      ? formatDate(dueDate)
      : computedDaysRemaining < 0
      ? `${Math.abs(computedDaysRemaining)} days overdue`
      : computedDaysRemaining === 0
      ? 'Due Today'
      : `${computedDaysRemaining} days remaining`;

  const bankName = accountDetails?.bankName || 'Designated Client Trust Account';
  const accountNumber = accountDetails?.accountNumber || 'See Portal for Account No.';
  const accountName = accountDetails?.accountName || displayFirm;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
          
          <!-- Firm Branding Header -->
          <tr>
            <td style="background-color:#022c22;padding:28px 32px;border-bottom:3px solid #f59e0b;">
              <div style="display:inline-block;padding:4px 10px;border-radius:9999px;background-color:${badgeColor};color:#ffffff;font-size:10px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:10px;">
                ${badgeText}
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.4px;">
                ${displayFirm}
              </h1>
              <p style="margin:4px 0 0 0;color:#a7f3d0;font-size:12px;">
                Chambers &amp; Property Management Portal
              </p>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px 0;font-size:15px;color:#1e293b;">
                Dear <strong>${tenantName}</strong>,
              </p>

              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#334155;">
                ${introParagraph}
              </p>

              <!-- Breakdown Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:20px;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="padding-bottom:12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:#475569;">
                    Tenancy &amp; Financial Summary
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:12px;font-size:13px;color:#64748b;">Property / Unit</td>
                  <td align="right" style="padding-top:12px;font-size:13px;font-weight:700;color:#0f172a;">${unitName} — ${propertyName}</td>
                </tr>
                ${
                  typeof rentDue === 'number' && rentDue > 0
                    ? `<tr>
                  <td style="padding-top:8px;font-size:13px;color:#64748b;">Annual Rent Payable</td>
                  <td align="right" style="padding-top:8px;font-size:13px;font-weight:600;color:#0f172a;">${formatNaira(rentDue)}</td>
                </tr>`
                    : ''
                }
                ${
                  typeof legalFeeDue === 'number' && legalFeeDue > 0
                    ? `<tr>
                  <td style="padding-top:8px;font-size:13px;color:#64748b;">10% First-Year Legal/Agreement Fee</td>
                  <td align="right" style="padding-top:8px;font-size:13px;font-weight:600;color:#b45309;">${formatNaira(legalFeeDue)}</td>
                </tr>`
                    : ''
                }
                ${
                  typeof serviceChargeDue === 'number' && serviceChargeDue > 0
                    ? `<tr>
                  <td style="padding-top:8px;font-size:13px;color:#64748b;">Service Charge</td>
                  <td align="right" style="padding-top:8px;font-size:13px;font-weight:600;color:#0f172a;">${formatNaira(serviceChargeDue)}</td>
                </tr>`
                    : ''
                }
                ${
                  typeof cautionDue === 'number' && cautionDue > 0
                    ? `<tr>
                  <td style="padding-top:8px;font-size:13px;color:#64748b;">Caution Deposit</td>
                  <td align="right" style="padding-top:8px;font-size:13px;font-weight:600;color:#0f172a;">${formatNaira(cautionDue)}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding-top:10px;font-size:13px;color:#64748b;">Due Date</td>
                  <td align="right" style="padding-top:10px;font-size:13px;font-weight:700;color:#0f172a;">${formatDate(dueDate)}</td>
                </tr>
                <tr>
                  <td style="padding-top:8px;font-size:13px;color:#64748b;">Timeline Status</td>
                  <td align="right" style="padding-top:8px;font-size:13px;font-weight:700;color:${badgeColor};">${daysStatusLabel}</td>
                </tr>
                <tr>
                  <td style="padding-top:14px;border-top:1px dashed #cbd5e1;margin-top:10px;font-size:14px;font-weight:800;color:#0f172a;">Total Amount Payable</td>
                  <td align="right" style="padding-top:14px;border-top:1px dashed #cbd5e1;margin-top:10px;font-size:18px;font-weight:900;color:#047857;">${formatNaira(amountDue)}</td>
                </tr>
              </table>

              <!-- Bank Transfer Instructions -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:18px;margin-bottom:28px;">
                <tr>
                  <td colspan="2" style="padding-bottom:8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:#92400e;">
                    Designated Bank Payment Details
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:4px;font-size:13px;color:#78350f;">Bank Name:</td>
                  <td align="right" style="padding-top:4px;font-size:13px;font-weight:700;color:#451a03;">${bankName}</td>
                </tr>
                <tr>
                  <td style="padding-top:6px;font-size:13px;color:#78350f;">Account Number (NUBAN):</td>
                  <td align="right" style="padding-top:6px;font-size:15px;font-weight:900;font-family:monospace;color:#451a03;letter-spacing:1px;">${accountNumber}</td>
                </tr>
                <tr>
                  <td style="padding-top:6px;font-size:13px;color:#78350f;">Account Name:</td>
                  <td align="right" style="padding-top:6px;font-size:13px;font-weight:700;color:#451a03;">${accountName}</td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <a href="${magicLink}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#047857;color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:10px;box-shadow:0 2px 6px rgba(4,120,87,0.25);">
                      Open Tenant Payment Portal &amp; Upload Proof &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

              <p style="margin:0;font-size:13px;color:#334155;">
                Yours faithfully,<br />
                <strong>${displaySolicitor}</strong><br />
                <span style="color:#64748b;font-size:12px;">${displayFirm}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
              Automated Statutory Notice dispatched via Chambers &amp; Estate Management Portal.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const fromAddress = process.env.SMTP_FROM || `"${displayFirm}" <${process.env.SMTP_USER}>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });

  return { messageId: info.messageId };
}

export interface SendTrancheReceiptEmailParams {
  to: string;
  payerName: string;
  receiptNumber: string; // e.g. RCT-20261112-8421
  paymentScope: 'ESTATE_INVOICE' | 'SOLICITOR_FEE_NOTE';
  itemDescription: string; // e.g. "Flat 1 — Fred DV Estate" or "Litigation Fee Note FN-..."
  totalBilled: number;
  trancheAmountPaid: number;
  cumulativeAmountPaid: number;
  balanceRemaining: number;
  paymentDate: string;
  promiseToPayDate?: string | null;
  bankReference?: string | null;
  recordedByName?: string | null;
  firmName?: string;
  solicitorName?: string;
}

/**
 * Requirement 2 & 8: Dispatch Official Tranche / Part-Payment Receipt (`RCT-...`) via Zoho SMTP
 */
export async function sendTrancheReceiptEmail({
  to,
  payerName,
  receiptNumber,
  paymentScope,
  itemDescription,
  totalBilled,
  trancheAmountPaid,
  cumulativeAmountPaid,
  balanceRemaining,
  paymentDate,
  promiseToPayDate,
  bankReference,
  recordedByName,
  firmName,
  solicitorName,
}: SendTrancheReceiptEmailParams): Promise<{ messageId?: string; skipped?: boolean }> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP credentials (SMTP_USER / SMTP_PASS) not configured; skipping receipt email dispatch.');
    return { skipped: true };
  }

  const displayFirm = (firmName || 'BARR. T. A. BABATUNDE & ASSOCIATES').toUpperCase();
  const displaySolicitor = solicitorName || 'Barr. T. A. Babatunde, LL.B, B.L';
  const isFullyPaid = balanceRemaining <= 0;
  const statusLabel = isFullyPaid ? 'FULLY SETTLED (PAID)' : 'PARTIAL / TRANCHE PAYMENT';
  const statusColor = isFullyPaid ? '#047857' : '#d97706';

  const subject = `Official Chambers Payment Receipt [${receiptNumber}] - ${itemDescription}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#022c22;padding:28px 32px;border-bottom:3px solid #f59e0b;">
              <div style="display:inline-block;padding:4px 10px;border-radius:9999px;background-color:${statusColor};color:#ffffff;font-size:10px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:10px;">
                OFFICIAL RECEIPT • ${receiptNumber}
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.4px;">
                ${displayFirm}
              </h1>
              <p style="margin:4px 0 0 0;color:#a7f3d0;font-size:12px;">
                ${paymentScope === 'SOLICITOR_FEE_NOTE' ? 'Chambers Legal Practice &amp; Fee Note Receipt' : 'Statutory Tenancy &amp; Estate Escrow Receipt'}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 14px 0;font-size:15px;color:#1e293b;">
                Dear <strong>${payerName}</strong>,
              </p>
              <p style="margin:0 0 20px 0;font-size:14px;line-height:1.6;color:#334155;">
                We acknowledge with thanks the receipt of your payment in respect of <strong>${itemDescription}</strong>. Below is your official tranche ledger summary:
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:20px;margin-bottom:24px;">
                <tr>
                  <td style="padding-bottom:8px;font-size:13px;color:#64748b;">Receipt Serial No:</td>
                  <td align="right" style="padding-bottom:8px;font-size:13px;font-weight:800;font-family:monospace;color:#0f172a;">${receiptNumber}</td>
                </tr>
                <tr>
                  <td style="padding-top:6px;font-size:13px;color:#64748b;">Payment Date:</td>
                  <td align="right" style="padding-top:6px;font-size:13px;font-weight:700;color:#0f172a;">${formatDate(paymentDate)}</td>
                </tr>
                <tr>
                  <td style="padding-top:6px;font-size:13px;color:#64748b;">Bank Reference:</td>
                  <td align="right" style="padding-top:6px;font-size:12px;font-family:monospace;color:#334155;">${bankReference || 'Verified Transfer'}</td>
                </tr>
                <tr>
                  <td style="padding-top:10px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">Total Assessment Billed:</td>
                  <td align="right" style="padding-top:10px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#0f172a;">${formatNaira(totalBilled)}</td>
                </tr>
                <tr>
                  <td style="padding-top:8px;font-size:14px;font-weight:800;color:#047857;">This Tranche Paid:</td>
                  <td align="right" style="padding-top:8px;font-size:16px;font-weight:900;color:#047857;">${formatNaira(trancheAmountPaid)}</td>
                </tr>
                <tr>
                  <td style="padding-top:8px;font-size:13px;color:#64748b;">Cumulative Paid to Date:</td>
                  <td align="right" style="padding-top:8px;font-size:13px;font-weight:700;color:#0f172a;">${formatNaira(cumulativeAmountPaid)}</td>
                </tr>
                <tr>
                  <td style="padding-top:10px;border-top:1px dashed #cbd5e1;font-size:14px;font-weight:800;color:${statusColor};">Outstanding Balance Due:</td>
                  <td align="right" style="padding-top:10px;border-top:1px dashed #cbd5e1;font-size:16px;font-weight:900;color:${statusColor};">${formatNaira(balanceRemaining)}</td>
                </tr>
                ${
                  !isFullyPaid && promiseToPayDate
                    ? `<tr>
                  <td style="padding-top:8px;font-size:12px;color:#b45309;">Promise-to-Pay Next Installment Date:</td>
                  <td align="right" style="padding-top:8px;font-size:12px;font-weight:800;color:#b45309;">${formatDate(promiseToPayDate)}</td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding-top:8px;font-size:12px;color:#64748b;">Account Status:</td>
                  <td align="right" style="padding-top:8px;font-size:12px;font-weight:800;color:${statusColor};">${statusLabel}</td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#334155;">
                Issued by: <strong>${recordedByName || displaySolicitor}</strong><br />
                <span style="color:#64748b;font-size:12px;">${displayFirm}</span>
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
              Official Electronic Receipt generated by ${displayFirm} via Zoho Mail.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const fromAddress = process.env.SMTP_FROM || `"${displayFirm}" <${process.env.SMTP_USER}>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
  });

  return { messageId: info.messageId };
}
