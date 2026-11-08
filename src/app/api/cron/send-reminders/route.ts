import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generate9MonthRenewalNotice,
  generate30DayDemandNotice,
  generateDailyReminderNotice,
  buildWhatsAppShareUrl,
} from '@/lib/utils';
import { sendRenewalNoticeEmail } from '@/lib/mailer';

interface DispatchedNotice {
  invoiceId: string;
  tenantName: string;
  tenantPhone: string | null;
  tenantEmail: string | null;
  emailDispatched: boolean;
  propertyTitle: string;
  unitName: string;
  tier: '9M' | '30D' | 'DAILY';
  daysToDue: number;
  whatsAppUrl: string;
  message: string;
  dispatchedAt: string;
}

async function handleRemindersCron(request: NextRequest) {
  // 1. Authorization: Verify Bearer token against CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET?.replace(/^"(.*)"$/, '$1');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Initialize Supabase Service Role Client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^"(.*)"$/, '$1');

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase service role credentials not configured.' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    // 3. Query Unpaid Invoices (status in ['pending', 'overdue'] or non-paid enum values)
    let invoices: any[] = [];
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        unit:units(
          *,
          property:properties(*)
        ),
        property:properties(*),
        profile:profiles!manager_id(*)
      `)
      .in('status', ['pending', 'overdue']);

    if (!error && data) {
      invoices = data;
    } else {
      // Fallback query without profile join and supporting both lowercase ('pending', 'overdue')
      // and uppercase ('DRAFT', 'SENT', 'AWAITING_VERIFICATION', 'OVERDUE') invoice_status enums
      let fallback = await supabase
        .from('invoices')
        .select(`
          *,
          unit:units(
            *,
            property:properties(*)
          ),
          property:properties(*)
        `)
        .in('status', ['pending', 'overdue']);

      if (fallback.error && fallback.error.message?.includes('invalid input value for enum')) {
        fallback = await supabase
          .from('invoices')
          .select(`
            *,
            unit:units(
              *,
              property:properties(*)
            ),
            property:properties(*)
          `)
          .in('status', ['DRAFT', 'SENT', 'AWAITING_VERIFICATION', 'OVERDUE']);
      }

      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }

      invoices = (fallback.data || []).filter(
        (inv: any) => String(inv.status || '').toLowerCase() !== 'paid'
      );

      // Fetch corresponding manager profiles
      const managerIds = Array.from(
        new Set(invoices.map((inv) => inv.manager_id).filter(Boolean))
      ) as string[];

      const profileMap = new Map<string, any>();
      if (managerIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('*')
          .in('id', managerIds);

        (profs || []).forEach((p: any) => {
          profileMap.set(p.id, p);
        });
      }

      // Default fallback profile if manager_id is missing or unmapped
      let defaultChamberProfile: any = null;
      const { data: defaultProfs } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);

      if (defaultProfs && defaultProfs.length > 0) {
        defaultChamberProfile = defaultProfs[0];
      }

      invoices.forEach((inv) => {
        inv.profile =
          (inv.manager_id ? profileMap.get(inv.manager_id) : null) || defaultChamberProfile;
      });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayIso = now.toISOString();
    const todayDateStr = today.toISOString().split('T')[0];

    const dispatched: DispatchedNotice[] = [];

    // 4. Milestone Logic & Template Selection
    for (const inv of invoices) {
      const targetDueDateStr = inv.due_date || inv.period_end || inv.unit?.lease_end_date;
      if (!targetDueDateStr) continue;

      const [dueY, dueM, dueD] = targetDueDateStr.split('-').map(Number);
      const targetDueDate = new Date(dueY, dueM - 1, dueD);
      const diffMs = targetDueDate.getTime() - today.getTime();
      const daysToDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Calculate elapsed tenure (at or past 9 months / ~270 days)
      const startDateStr = inv.period_start || inv.unit?.lease_start_date;
      let isPast9Months = false;
      if (startDateStr) {
        const [startY, startM, startD] = startDateStr.split('-').map(Number);
        const startDate = new Date(startY, startM - 1, startD);
        const elapsedDays = Math.ceil(
          (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (elapsedDays >= 270) {
          isPast9Months = true;
        }
      }
      // In annual leases, 9 months into tenure also corresponds to <= 90 days to due date
      if (daysToDue <= 90) {
        isPast9Months = true;
      }

      const lastDailyDate = inv.last_daily_reminder_sent_at
        ? new Date(inv.last_daily_reminder_sent_at).toISOString().split('T')[0]
        : null;
      const alreadySentDailyToday = lastDailyDate === todayDateStr;

      let selectedTier: '9M' | '30D' | 'DAILY' | null = null;

      // Tier 3: 10 Days to Expiry / Overdue (daysToDue <= 10 and last_daily_reminder_sent_at !== todayIso)
      if (daysToDue <= 10) {
        if (!alreadySentDailyToday) {
          selectedTier = 'DAILY';
        }
      }
      // Tier 2: 12th Month Entry (daysToDue <= 30 and > 10 and !notice_30d_sent)
      else if (daysToDue <= 30 && daysToDue > 10) {
        if (!inv.notice_30d_sent) {
          selectedTier = '30D';
        }
      }
      // Tier 1: 9 Months into Tenure (isPast9Months and !notice_9m_sent and daysToDue > 30)
      else if (isPast9Months && daysToDue > 30) {
        if (!inv.notice_9m_sent) {
          selectedTier = '9M';
        }
      }

      if (!selectedTier) {
        continue;
      }

      const profile = inv.profile || {};
      const propertyTitle = inv.property?.title || inv.unit?.property?.title || 'Managed Estate';
      const unitName = inv.unit?.unit_name || 'Tenancy Flat';
      const appBaseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'https://estateadvocate.ng';
      const paymentLink = `${appBaseUrl}/pay/${inv.access_token || inv.id}`;

      const accountDetails = {
        bankName: profile.bank_name || 'Zenith Bank PLC',
        accountNumber: profile.account_number || '1012345678',
        accountName:
          profile.account_name || profile.firm_name || 'Babatunde & Associates Client Account',
      };

      const noticeParams = {
        tenantName: inv.tenant_name,
        propertyTitle,
        unitName,
        rentDue: Number(inv.rent_due) || 0,
        serviceChargeDue: Number(inv.service_charge_due) || 0,
        cautionDue: Number(inv.caution_due) || 0,
        totalDue:
          Number(inv.total_amount_payable) ||
          (Number(inv.rent_due) || 0) +
            (Number(inv.service_charge_due) || 0) +
            (Number(inv.caution_due) || 0),
        dueDate: inv.due_date,
        periodEnd: inv.period_end,
        paymentLink,
        accountDetails,
        firmName: profile.firm_name,
        solicitorName: profile.solicitor_name,
      };

      let encodedNotice = '';
      let updatePayload: Record<string, any> = {};

      if (selectedTier === '9M') {
        encodedNotice = generate9MonthRenewalNotice(noticeParams);
        updatePayload = {
          notice_9m_sent: true,
          notice_9m_sent_at: todayIso,
        };
      } else if (selectedTier === '30D') {
        encodedNotice = generate30DayDemandNotice(noticeParams);
        updatePayload = {
          notice_30d_sent: true,
          notice_30d_sent_at: todayIso,
        };
      } else if (selectedTier === 'DAILY') {
        encodedNotice = generateDailyReminderNotice(noticeParams);
        updatePayload = {
          last_daily_reminder_sent_at: todayIso,
        };
      }

      // 5. Automated SMTP Email Dispatch via Zoho Mail (if tenant has valid email)
      const tenantEmail = inv.unit?.tenant_email?.trim() || null;
      let emailDispatched = false;

      if (tenantEmail && tenantEmail.includes('@')) {
        try {
          const emailRes = await sendRenewalNoticeEmail({
            to: tenantEmail,
            tenantName: inv.tenant_name,
            propertyName: propertyTitle,
            unitName,
            amountDue: noticeParams.totalDue,
            rentDue: noticeParams.rentDue,
            serviceChargeDue: noticeParams.serviceChargeDue,
            cautionDue: noticeParams.cautionDue,
            dueDate: inv.due_date,
            daysRemaining: daysToDue,
            tier: selectedTier,
            magicLink: paymentLink,
            firmName: profile.firm_name,
            solicitorName: profile.solicitor_name,
            accountDetails,
          });
          emailDispatched = !emailRes.skipped;
        } catch (smtpError) {
          console.error(
            `SMTP dispatch error for invoice ${inv.id} (${tenantEmail}):`,
            smtpError
          );
        }
      }

      // 6. Update Database Record in Supabase
      const { error: updateError } = await supabase
        .from('invoices')
        .update(updatePayload)
        .eq('id', inv.id);

      if (updateError) {
        console.error(`Supabase update error on invoice ${inv.id}:`, updateError);
      } else {
        const whatsAppPhone = inv.unit?.tenant_phone;
        dispatched.push({
          invoiceId: inv.id,
          tenantName: inv.tenant_name,
          tenantPhone: whatsAppPhone || null,
          tenantEmail,
          emailDispatched,
          propertyTitle,
          unitName,
          tier: selectedTier,
          daysToDue,
          whatsAppUrl: buildWhatsAppShareUrl(whatsAppPhone, encodedNotice),
          message: decodeURIComponent(encodedNotice),
          dispatchedAt: todayIso,
        });
      }
    }

    // 5. Response: JSON payload
    return NextResponse.json({
      success: true,
      count: dispatched.length,
      dispatched,
    });
  } catch (err: any) {
    console.error('Unhandled cron error in /api/cron/send-reminders:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRemindersCron(request);
}

export async function POST(request: NextRequest) {
  return handleRemindersCron(request);
}
