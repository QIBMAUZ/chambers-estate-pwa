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
import { Property, Landlord, Transaction, ChamberProfile } from '@/types/database';
import { formatNaira, formatDate } from '@/lib/utils';

// Styles for legal letterhead PDF document
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
    marginBottom: 16,
    textAlign: 'center',
  },
  logo: {
    width: 80,
    height: 60,
    objectFit: 'contain',
    marginBottom: 8,
    alignSelf: 'center',
  },
  chambersTitle: {
    fontSize: 14,
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
  statementTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
    textTransform: 'uppercase',
    backgroundColor: '#f1f5f9',
    padding: 6,
    borderRadius: 4,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
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
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    marginTop: 10,
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
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontSize: 8,
  },
  colDate: { width: '15%' },
  colDesc: { width: '55%' },
  colPool: { width: '15%' },
  colAmount: { width: '15%', textAlign: 'right' },
  boldText: {
    fontFamily: 'Helvetica-Bold',
  },
  summaryBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    fontSize: 8.5,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: '#064e3b',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
  },
  bankBox: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 4,
  },
  bankTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    marginBottom: 3,
  },
  bankText: {
    fontSize: 7.5,
    color: '#065f46',
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

export interface LandlordStatementPDFProps {
  property: Property;
  landlord: Landlord;
  transactions: Transaction[];
  startDate: string;
  endDate: string;
  profile?: ChamberProfile;
  summary: {
    grossRent: number;
    managementFee: number;
    landlordRepairs: number;
    remittancesPaid: number;
    netBalanceDue: number;
    serviceChargeCollected: number;
  };
}

export function LandlordStatementDocument({
  property,
  landlord,
  transactions,
  startDate,
  endDate,
  profile,
  summary,
}: LandlordStatementPDFProps) {
  const firmName = profile?.firm_name || 'BARR. T. A. BABATUNDE & ASSOCIATES';
  const solicitorName = profile?.solicitor_name || 'Barr. T. A. Babatunde, LL.B, B.L';
  const enrollmentNo = profile?.enrollment_no || 'SCN/2004/0981';
  const address = profile?.office_address || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State';
  const phone = profile?.phone || '+234 803 555 0192';
  const email = profile?.email || 'chambers@babatundelaw.ng';
  const logoUrl = profile?.letterhead_logo_url ? String(profile.letterhead_logo_url).trim() : null;

  return (
    <Document title={`Landlord_Statement_${property.title.replace(/\s+/g, '_')}`}>
      <Page size="A4" style={styles.page}>
        {/* Chambers Letterhead */}
        <View style={styles.headerContainer}>
          {logoUrl ? (
            <Image
              src={logoUrl}
              style={styles.logo}
            />
          ) : null}
          <Text style={styles.chambersTitle}>{firmName}</Text>
          <Text style={styles.chambersSub}>
            LEGAL PRACTITIONERS &amp; REAL ESTATE SOLICITORS OF THE SUPREME COURT OF NIGERIA
          </Text>
          <Text style={styles.chambersAddress}>
            {address} • Phone: {phone} • Email: {email}
          </Text>
        </View>

        {/* Statement Title */}
        <Text style={styles.statementTitle}>
          FORMAL STATEMENT OF ACCOUNT &amp; RENT RECONCILIATION
        </Text>

        {/* Metadata */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Client / Landlord:</Text>
            <Text style={styles.metaValue}>{landlord.name}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Property / Estate:</Text>
            <Text style={styles.metaValue}>{property.title}</Text>
            <Text style={{ fontSize: 7.5, color: '#64748b' }}>{property.address}, {property.state}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Statement Accounting Cycle:</Text>
            <Text style={styles.metaValue}>{formatDate(startDate)} to {formatDate(endDate)}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Statutory Management Fee Rate:</Text>
            <Text style={styles.metaValue}>10.00% (Strictly on Gross Rent Inflow)</Text>
          </View>
        </View>

        {/* Schedule of Inflows & Outflows */}
        <Text style={styles.sectionTitle}>1. Itemized Transactions &amp; Ledger Audit Trail</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDate}>Date</Text>
            <Text style={styles.colDesc}>Description / Reference Note</Text>
            <Text style={styles.colPool}>Fund Category</Text>
            <Text style={styles.colAmount}>Amount (NGN)</Text>
          </View>

          {transactions.map((tx, idx) => (
            <View key={idx} style={styles.tableRow}>
              <Text style={styles.colDate}>{formatDate(tx.tx_date)}</Text>
              <Text style={styles.colDesc}>
                {tx.description}
                {tx.reference_note ? ` (${tx.reference_note})` : ''}
              </Text>
              <Text style={styles.colPool}>
                {tx.tx_type === 'RENT_INFLOW'
                  ? 'Rent Inflow'
                  : tx.tx_type === 'MANAGEMENT_FEE'
                  ? '10% Legal Fee'
                  : tx.tx_type === 'MAINTENANCE_EXPENSE'
                  ? 'Repair Expense'
                  : tx.tx_type === 'OWNER_REMITTANCE'
                  ? 'Remittance'
                  : tx.tx_type}
              </Text>
              <Text
                style={[
                  styles.colAmount,
                  tx.tx_type === 'MAINTENANCE_EXPENSE' || tx.tx_type === 'OWNER_REMITTANCE'
                    ? { color: '#dc2626' }
                    : tx.tx_type === 'MANAGEMENT_FEE'
                    ? { color: '#d97706' }
                    : { color: '#047857' },
                ]}
              >
                {tx.tx_type === 'MAINTENANCE_EXPENSE' || tx.tx_type === 'OWNER_REMITTANCE' ? '-' : '+'}
                {formatNaira(tx.amount).replace('₦', 'NGN ')}
              </Text>
            </View>
          ))}
        </View>

        {/* Financial Reconciliation Summary */}
        <Text style={styles.sectionTitle}>2. Financial Reconciliation &amp; Net Landlord Remittance</Text>
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text>Total Gross Rent Collections:</Text>
            <Text style={styles.boldText}>+{formatNaira(summary.grossRent).replace('₦', 'NGN ')}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Less: Solicitor Agreed Legal Management Fee (Retained):</Text>
            <Text style={{ color: '#d97706', fontFamily: 'Helvetica-Bold' }}>
              -{formatNaira(summary.managementFee).replace('₦', 'NGN ')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Less: Landlord-Funded Repairs &amp; Maintenance Disbursements:</Text>
            <Text style={{ color: '#dc2626', fontFamily: 'Helvetica-Bold' }}>
              -{formatNaira(summary.landlordRepairs).replace('₦', 'NGN ')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Less: Prior Remittances Paid to Landlord Bank Account:</Text>
            <Text style={{ color: '#4f46e5', fontFamily: 'Helvetica-Bold' }}>
              -{formatNaira(summary.remittancesPaid).replace('₦', 'NGN ')}
            </Text>
          </View>
          <View style={styles.summaryTotalRow}>
            <Text>NET REMITTANCE BALANCE PAYABLE TO LANDLORD:</Text>
            <Text>{formatNaira(summary.netBalanceDue).replace('₦', 'NGN ')}</Text>
          </View>
        </View>

        {/* Landlord Verified Account Details */}
        <View style={styles.bankBox}>
          <Text style={styles.bankTitle}>LANDLORD DESIGNATED DISBURSEMENT ACCOUNT (VERIFIED)</Text>
          <Text style={styles.bankText}>
            Bank Name: {landlord.bank_name} • Account Number: {landlord.account_number} • Account Name: {landlord.account_name}
          </Text>
        </View>

        {/* Legal Sign-off */}
        <View style={styles.footerSign}>
          <View style={styles.signBlock}>
            <Text style={styles.signName}>{solicitorName}</Text>
            <Text style={styles.signTitle}>Principal Solicitor &amp; Estate Advocate</Text>
            <Text style={styles.signTitle}>For: {firmName}</Text>
          </View>
          <View style={[styles.signBlock, { textAlign: 'right' }]}>
            <Text style={styles.signName}>Stamp &amp; Certification</Text>
            <Text style={styles.signTitle}>Supreme Court Enrolment #{enrollmentNo}</Text>
            <Text style={styles.signTitle}>Date Issued: {formatDate(endDate)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
