'use client';

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { Invoice, ChamberProfile, TranchePayment } from '@/types/database';
import { formatNaira, formatDate } from '@/lib/utils';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    borderBottomWidth: 2,
    borderBottomColor: '#064e3b',
    paddingBottom: 12,
    marginBottom: 14,
    textAlign: 'center',
  },
  logo: {
    width: 80,
    height: 60,
    objectFit: 'contain',
    marginBottom: 6,
    alignSelf: 'center',
  },
  chambersTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chambersSub: {
    fontSize: 8,
    color: '#d97706',
    marginTop: 2,
    fontFamily: 'Helvetica-Bold',
  },
  chambersAddress: {
    fontSize: 7.5,
    color: '#64748b',
    marginTop: 2,
  },
  receiptTitleBox: {
    backgroundColor: '#064e3b',
    padding: 6,
    borderRadius: 4,
    textAlign: 'center',
    marginBottom: 12,
  },
  receiptTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  receiptSubtitle: {
    fontSize: 7.5,
    color: '#fef3c7',
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaCol: {
    width: '48%',
  },
  metaLabel: {
    fontSize: 7.5,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    marginTop: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2,
    textTransform: 'uppercase',
  },
  table: {
    width: '100%',
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#064e3b',
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    padding: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 4,
    fontSize: 8,
  },
  colDesc: {
    width: '60%',
  },
  colCategory: {
    width: '20%',
  },
  colAmount: {
    width: '20%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
  },
  totalBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    borderTopWidth: 1.5,
    borderTopColor: '#064e3b',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
  },
  trancheSummaryBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  trancheRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    fontSize: 8.5,
  },
  tenancyNote: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 4,
  },
  tenancyNoteText: {
    fontSize: 7.5,
    color: '#065f46',
    lineHeight: 1.3,
  },
  footerSign: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signBlock: {
    width: '45%',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    paddingTop: 4,
  },
  signName: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  signTitle: {
    fontSize: 7.5,
    color: '#64748b',
  },
});

export interface RentReceiptPDFProps {
  invoice: Invoice;
  profile?: ChamberProfile;
  tranche?: TranchePayment;
}

export function RentReceiptDocument({ invoice, profile, tranche }: RentReceiptPDFProps) {
  const firmName = profile?.firm_name || 'BARR. T. A. BABATUNDE & ASSOCIATES';
  const solicitorName = profile?.solicitor_name || 'Barr. T. A. Babatunde, LL.B, B.L';
  const enrollmentNo = profile?.enrollment_no || 'SCN/2004/0981';
  const address = profile?.office_address || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State';
  const phone = profile?.phone || '+234 803 555 0192';
  const email = profile?.email || 'chambers@babatundelaw.ng';
  const logoUrl = profile?.letterhead_logo_url ? String(profile.letterhead_logo_url).trim() : null;

  const rentDue = Number(invoice.rent_due) || 0;
  const sCharge = Number(invoice.service_charge_due) || 0;
  const caution = Number(invoice.caution_due) || 0;
  const legalFeeDue = Number(invoice.legal_fee_due) || 0;
  const totalDemand = Number(invoice.total_amount_payable) || 0;

  const receiptNumber =
    tranche?.receipt_number ||
    `RCT-${new Date().getFullYear()}-${invoice.id.slice(0, 6).toUpperCase()}`;

  const cumulativePaid =
    typeof invoice.amount_paid === 'number' ? invoice.amount_paid : totalDemand;
  const balanceDue =
    typeof invoice.balance_due === 'number'
      ? invoice.balance_due
      : Math.max(0, totalDemand - cumulativePaid);
  const currentTranchePaid = tranche ? Number(tranche.amount) : cumulativePaid;

  return (
    <Document title={`Rent_Receipt_${receiptNumber}_${invoice.tenant_name.replace(/\s+/g, '_')}`}>
      <Page size="A4" style={styles.page}>
        {/* Chambers Letterhead */}
        <View style={styles.headerContainer}>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          <Text style={styles.chambersTitle}>{firmName}</Text>
          <Text style={styles.chambersSub}>
            LEGAL PRACTITIONERS &amp; REAL ESTATE SOLICITORS OF THE SUPREME COURT OF NIGERIA
          </Text>
          <Text style={styles.chambersAddress}>
            {address} • Phone: {phone} • Email: {email}
          </Text>
        </View>

        {/* Receipt Title Banner */}
        <View style={styles.receiptTitleBox}>
          <Text style={styles.receiptTitle}>
            {balanceDue > 0
              ? 'OFFICIAL TRANCHE / PART-PAYMENT RENT RECEIPT'
              : 'STATUTORY RENT RECEIPT & SETTLEMENT CERTIFICATE'}
          </Text>
          <Text style={styles.receiptSubtitle}>
            Issued pursuant to Section 5, Lagos State Tenancy Law 2011 • Receipt #{receiptNumber}
          </Text>
        </View>

        {/* Metadata Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Tenant / Lessee Name:</Text>
            <Text style={styles.metaValue}>{invoice.tenant_name}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Demised Premises:</Text>
            <Text style={styles.metaValue}>
              {invoice.unit?.unit_name || 'Residential Unit'} • {invoice.property?.title}
            </Text>
            <Text style={{ fontSize: 7.5, color: '#64748b' }}>
              {invoice.property?.address}, {invoice.property?.state || 'Lagos'}
            </Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Tenancy Type:</Text>
            <Text style={styles.metaValue}>
              {invoice.tenancy_type === 'FIRST_YEAR'
                ? 'First-Year Intake (+10% Legal Agreement Fee)'
                : 'Renewal Tenancy'}
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Receipt Serial Reference:</Text>
            <Text style={[styles.metaValue, { fontFamily: 'Helvetica-Bold', color: '#064e3b' }]}>
              {receiptNumber}
            </Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Tenancy Period Covered:</Text>
            <Text style={styles.metaValue}>
              {formatDate(invoice.period_start)} to {formatDate(invoice.period_end)}
            </Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Payment Verification Reference:</Text>
            <Text style={{ fontSize: 7.5, color: '#064e3b', fontFamily: 'Helvetica-Bold' }}>
              {tranche?.bank_reference ||
                invoice.bank_session_id ||
                'Direct Electronic Funds Transfer (NIP)'}
            </Text>
            {(tranche?.created_by_name || invoice.created_by_name) && (
              <>
                <Text style={[styles.metaLabel, { marginTop: 4 }]}>Processed &amp; Audited By:</Text>
                <Text style={{ fontSize: 7.5, color: '#334155', fontFamily: 'Helvetica-Bold' }}>
                  {tranche?.created_by_name || invoice.created_by_name}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Itemized Consideration Table */}
        <Text style={styles.sectionTitle}>Full Demand Breakdown &amp; Statutory Allocation</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Payment Component</Text>
            <Text style={styles.colCategory}>Classification</Text>
            <Text style={styles.colAmount}>Amount (NGN)</Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.colDesc}>Annual Rent for Demised Premises</Text>
            <Text style={styles.colCategory}>Gross Rent Pool</Text>
            <Text style={styles.colAmount}>{formatNaira(rentDue).replace('₦', '')}</Text>
          </View>

          {legalFeeDue > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>
                10% First-Year Legal &amp; Tenancy Agreement Fee
              </Text>
              <Text style={styles.colCategory}>Chambers Legal Fee</Text>
              <Text style={styles.colAmount}>{formatNaira(legalFeeDue).replace('₦', '')}</Text>
            </View>
          )}

          {sCharge > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>Estate Operations &amp; Running Service Charge</Text>
              <Text style={styles.colCategory}>Service Charge Pool</Text>
              <Text style={styles.colAmount}>{formatNaira(sCharge).replace('₦', '')}</Text>
            </View>
          )}

          {caution > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colDesc}>Refundable Caution Deposit (Held in Escrow)</Text>
              <Text style={styles.colCategory}>Caution Escrow</Text>
              <Text style={styles.colAmount}>{formatNaira(caution).replace('₦', '')}</Text>
            </View>
          )}
        </View>

        {/* Total Box */}
        <View style={styles.totalBox}>
          <Text>TOTAL INVOICED DEMAND:</Text>
          <Text>{formatNaira(totalDemand).replace('₦', 'NGN ')}</Text>
        </View>

        {/* Tranche / Ledger Status Box */}
        <View style={styles.trancheSummaryBox}>
          <View style={styles.trancheRow}>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: '#064e3b' }}>
              THIS TRANCHE / RECEIPT AMOUNT PAID ({receiptNumber}):
            </Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: '#064e3b' }}>
              {formatNaira(currentTranchePaid).replace('₦', 'NGN ')}
            </Text>
          </View>
          <View style={styles.trancheRow}>
            <Text style={{ color: '#334155' }}>Cumulative Paid to Date:</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: '#334155' }}>
              {formatNaira(cumulativePaid).replace('₦', 'NGN ')}
            </Text>
          </View>
          <View style={styles.trancheRow}>
            <Text
              style={{
                fontFamily: 'Helvetica-Bold',
                color: balanceDue > 0 ? '#b45309' : '#065f46',
              }}
            >
              OUTSTANDING BALANCE DUE:
            </Text>
            <Text
              style={{
                fontFamily: 'Helvetica-Bold',
                color: balanceDue > 0 ? '#b45309' : '#065f46',
              }}
            >
              {balanceDue > 0
                ? formatNaira(balanceDue).replace('₦', 'NGN ')
                : 'NGN 0.00 (FULLY SETTLED)'}
            </Text>
          </View>
          {balanceDue > 0 && (tranche?.promise_to_pay_date || invoice.promise_to_pay_date) && (
            <View style={styles.trancheRow}>
              <Text style={{ color: '#92400e', fontSize: 8 }}>
                Agreed Promise-to-Pay Date for Balance:
              </Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#92400e', fontSize: 8 }}>
                {formatDate(tranche?.promise_to_pay_date || invoice.promise_to_pay_date)}
              </Text>
            </View>
          )}
        </View>

        {/* Tenancy Legal Certificate Note */}
        <View style={styles.tenancyNote}>
          <Text style={styles.tenancyNoteText}>
            THIS IS TO CERTIFY that the sum of {formatNaira(currentTranchePaid).replace('₦', 'NGN ')}{' '}
            has been received under Official Receipt {receiptNumber} into the designated client account.{' '}
            {balanceDue > 0
              ? `An outstanding balance of ${formatNaira(balanceDue).replace('₦', 'NGN ')} remains payable on or before the agreed promise-to-pay date.`
              : 'All statutory rent, legal fees, and operational allocations have been settled in full compliance with the Lagos State Tenancy Law 2011.'}
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.footerSign}>
          <View style={styles.signBlock}>
            <Text style={styles.signName}>{solicitorName}</Text>
            <Text style={styles.signTitle}>Principal Solicitor &amp; Estate Advocate</Text>
            <Text style={styles.signTitle}>For: {firmName}</Text>
          </View>
          <View style={[styles.signBlock, { textAlign: 'right' }]}>
            <Text style={styles.signName}>Chambers Stamp &amp; Attestation</Text>
            <Text style={styles.signTitle}>Supreme Court Enrolment #{enrollmentNo}</Text>
            <Text style={styles.signTitle}>
              Date Issued:{' '}
              {formatDate(
                tranche?.payment_date ||
                  (invoice.verified_at
                    ? invoice.verified_at.slice(0, 10)
                    : new Date().toISOString().slice(0, 10))
              )}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
