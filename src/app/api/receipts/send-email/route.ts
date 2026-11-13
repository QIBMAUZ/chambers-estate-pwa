import { NextRequest, NextResponse } from 'next/server';
import { sendTrancheReceiptEmail, SendTrancheReceiptEmailParams } from '@/lib/mailer';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SendTrancheReceiptEmailParams;

    if (!body.to || !body.to.includes('@')) {
      return NextResponse.json(
        { skipped: true, reason: 'No valid recipient email address provided.' },
        { status: 200 }
      );
    }

    const result = await sendTrancheReceiptEmail(body);
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('Error dispatching tranche receipt email via Zoho SMTP:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to dispatch receipt email' },
      { status: 500 }
    );
  }
}
