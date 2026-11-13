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
import { SolicitorFeeNote, ChamberProfile, TranchePayment } from '@/types/database';
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
  bannerBox: {
    backgroundColor: '#064e3b',
    padding: 8,
    borderRadius: 4,
    textAlign: 'center',
    marginBottom: 14,
  },
  bannerTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  bannerSubtitle: {
    fontSize: 7.5,
    color: '#fef3c7',
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 10,
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
  descriptionBox: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    marginBottom: 12,
  },
  ledgerBox: {
    padding: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 4,
    marginBottom: 12,
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    fontSize: 9,
  },
  bankBox: {
    padding: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 4,
    marginBottom: 12,
  },
  footerSign: {
    marginTop: 24,
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

export interface SolicitorFeeNotePDFProps {
  feeNote: SolicitorFeeNote;
  profile?: ChamberProfile;
  tranche?: TranchePayment;
}

export function SolicitorFeeNoteDocument({
  feeNote,
  profile,
  tranche,
}: SolicitorFeeNotePDFProps) {
  const firmName = profile?.firm_name || 'BARR. T. A. BABATUNDE & ASSOCIATES';
  const solicitorName = profile?.solicitor_name || 'Barr. T. A. Babatunde, LL.B, B.L';
  const enrollmentNo = profile?.enrollment_no || 'SCN/2004/0981';
  const address = profile?.office_address || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State';
  const phone = profile?.phone || '+234 803 555 0192';
  const email = profile?.email || 'chambers@babatundelaw.ng';
  const bankName = profile?.bank_name || 'Zenith Bank PLC';
  const accountNo = profile?.account_number || '1019928374';
  const accountName = profile?.account_name || `${firmName} - CHAMBERS SOLICITORS ACCOUNT`;
  const logoUrl = profile?.letterhead_logo_url ? String(profile.letterhead_logo_url).trim() : null;

  const isReceipt = Boolean(tranche) || feeNote.status === 'PAID';
  const receiptSerial = tranche?.receipt_number || feeNote.fee_note_number;

  return (
    <Document title={`Solicitor_Fee_Note_${feeNote.fee_note_number}`}>
      <Page size="A4" style={styles.page}>
        {/* Chambers Letterhead */}
        <View style={styles.headerContainer}>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          <Text style={styles.chambersTitle}>{firmName}</Text>
          <Text style={styles.chambersSub}>
            BARRISTERS, SOLICITORS &amp; CORPORATE LEGAL PRACTITIONERS OF THE SUPREME COURT OF NIGERIA
          </Text>
          <Text style={styles.chambersAddress}>
            {address} • Phone: {phone} • Email: {email}
          </Text>
        </View>

        {/* Title Banner */}
        <View style={styles.bannerBox}>
          <Text style={styles.bannerTitle}>
            {tranche
              ? `CHAMBERS OFFICIAL FEE NOTE RECEIPT (${tranche.receipt_number})`
              : `OFFICIAL SOLICITOR FEE NOTE & PROFESSIONAL BILL OF CHARGES (${feeNote.fee_note_number})`}
          </Text>
          <Text style={styles.bannerSubtitle}>
            Chambers Legal Practice Revenue — Strictly Isolated from Landlord Rent Escrow Accounts
          </Text>
        </View>

        {/* Metadata Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Client / Instructing Party:</Text>
            <Text style={styles.metaValue}>{feeNote.client_name}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Client Contact:</Text>
            <Text style={styles.metaValue}>
              {feeNote.client_phone || 'On File'} {feeNote.client_email ? `• ${feeNote.client_email}` : ''}
            </Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Legal Practice Category:</Text>
            <Text style={styles.metaValue}>{(feeNote.matter_category || 'GENERAL_SOLICITOR').replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Fee Note Reference:</Text>
            <Text style={[styles.metaValue, { color: '#064e3b' }]}>{feeNote.fee_note_number}</Text>
            {tranche && (
              <>
                <Text style={[styles.metaLabel, { marginTop: 4 }]}>Tranche Receipt Serial:</Text>
                <Text style={[styles.metaValue, { color: '#b45309' }]}>{tranche.receipt_number}</Text>
              </>
            )}
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Due Date:</Text>
            <Text style={styles.metaValue}>{formatDate(feeNote.due_date)}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Prepared By:</Text>
            <Text style={styles.metaValue}>{feeNote.created_by_name || solicitorName}</Text>
          </View>
        </View>

        {/* Professional Brief Description */}
        <Text style={styles.sectionTitle}>Particulars of Legal Instructions &amp; Professional Services</Text>
        <View style={styles.descriptionBox}>
          <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
            {feeNote.description}
          </Text>
          <Text style={{ fontSize: 8, color: '#475569', marginTop: 4 }}>
            Professional legal fees rendered pursuant to the Legal Practitioners (Remuneration for Legal Documentation and Other Land Matters) Order.
          </Text>
        </View>

        {/* Fee & Tranche Ledger Summary */}
        <Text style={styles.sectionTitle}>Fee Note &amp; Installment Settlement Ledger</Text>
        <View style={styles.ledgerBox}>
          <View style={styles.ledgerRow}>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
              TOTAL AGREED PROFESSIONAL FEE:
            </Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
              {formatNaira(feeNote.agreed_fee).replace('₦', 'NGN ')}
            </Text>
          </View>
          {tranche && (
            <View style={styles.ledgerRow}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#065f46' }}>
                THIS TRANCHE RECEIPT ({tranche.receipt_number}):
              </Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#065f46' }}>
                {formatNaira(tranche.amount).replace('₦', 'NGN ')}
              </Text>
            </View>
          )}
          <View style={styles.ledgerRow}>
            <Text style={{ color: '#334155' }}>Cumulative Retainer / Deposits Paid to Date:</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', color: '#065f46' }}>
              {formatNaira(feeNote.amount_paid).replace('₦', 'NGN ')}
            </Text>
          </View>
          <View style={styles.ledgerRow}>
            <Text
              style={{
                fontFamily: 'Helvetica-Bold',
                color: feeNote.balance_due > 0 ? '#b45309' : '#065f46',
              }}
            >
              OUTSTANDING BALANCE DUE TO CHAMBERS:
            </Text>
            <Text
              style={{
                fontFamily: 'Helvetica-Bold',
                color: feeNote.balance_due > 0 ? '#b45309' : '#065f46',
              }}
            >
              {feeNote.balance_due > 0
                ? formatNaira(feeNote.balance_due).replace('₦', 'NGN ')
                : 'NGN 0.00 (FULLY SETTLED)'}
            </Text>
          </View>
          {feeNote.balance_due > 0 && feeNote.promise_to_pay_date && (
            <View style={styles.ledgerRow}>
              <Text style={{ fontSize: 8, color: '#92400e' }}>
                Agreed Promise-to-Pay Date for Balance:
              </Text>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#92400e' }}>
                {formatDate(feeNote.promise_to_pay_date)}
              </Text>
            </View>
          )}
        </View>

        {/* Chambers Bank Account Box */}
        <View style={styles.bankBox}>
          <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#064e3b' }}>
            DESIGNATED CHAMBERS SOLICITORS COLLECTION ACCOUNT (NON-ESCROW):
          </Text>
          <Text style={{ fontSize: 8.5, color: '#065f46', marginTop: 3 }}>
            Bank: {bankName} • Account Number: {accountNo} • Account Name: {accountName}
          </Text>
          <Text style={{ fontSize: 7.5, color: '#047857', marginTop: 2 }}>
            Please quote Reference {receiptSerial} on your transfer narration.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.footerSign}>
          <View style={styles.signBlock}>
            <Text style={styles.signName}>{solicitorName}</Text>
            <Text style={styles.signTitle}>Principal Solicitor &amp; Head of Chambers</Text>
            <Text style={styles.signTitle}>For: {firmName}</Text>
          </View>
          <View style={[styles.signBlock, { textAlign: 'right' }]}>
            <Text style={styles.signName}>Chambers Official Seal</Text>
            <Text style={styles.signTitle}>Supreme Court Enrolment #{enrollmentNo}</Text>
            <Text style={styles.signTitle}>
              Status: {isReceipt ? 'OFFICIAL RECEIPT ISSUED' : feeNote.status}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
