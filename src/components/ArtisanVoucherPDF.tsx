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
import { Transaction, ChamberProfile } from '@/types/database';
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
  voucherTitleBox: {
    backgroundColor: '#064e3b',
    padding: 8,
    borderRadius: 4,
    textAlign: 'center',
    marginBottom: 14,
  },
  voucherTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  voucherSubtitle: {
    fontSize: 8,
    color: '#fef3c7',
    marginTop: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
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
  detailsBox: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    marginBottom: 12,
  },
  totalBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#991b1b',
  },
  stampBox: {
    marginTop: 14,
    padding: 10,
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#059669',
    borderRadius: 6,
    textAlign: 'center',
  },
  stampTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#065f46',
    textTransform: 'uppercase',
  },
  stampSub: {
    fontSize: 7.5,
    color: '#047857',
    marginTop: 2,
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

export interface ArtisanVoucherPDFProps {
  transaction: Transaction;
  profile?: ChamberProfile;
}

export function ArtisanVoucherDocument({ transaction, profile }: ArtisanVoucherPDFProps) {
  const firmName = profile?.firm_name || 'BARR. T. A. BABATUNDE & ASSOCIATES';
  const solicitorName = profile?.solicitor_name || 'Barr. T. A. Babatunde, LL.B, B.L';
  const enrollmentNo = profile?.enrollment_no || 'SCN/2004/0981';
  const address = profile?.office_address || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State';
  const phone = profile?.phone || '+234 803 555 0192';
  const email = profile?.email || 'chambers@babatundelaw.ng';
  const logoUrl = profile?.letterhead_logo_url ? String(profile.letterhead_logo_url).trim() : null;

  const voucherNo =
    transaction.voucher_number ||
    `VCH-${new Date().getFullYear()}-${transaction.id.slice(0, 6).toUpperCase()}`;

  const poolLabel =
    transaction.funding_source === 'SERVICE_CHARGE_POOL'
      ? 'Estate Service Charge Reserve Pool'
      : transaction.funding_source === 'LANDLORD_RENT_POOL'
      ? 'Landlord Net Rent Pool'
      : 'Caution Deposit Escrow Pool';

  return (
    <Document title={`Payment_Voucher_${voucherNo}`}>
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

        {/* Voucher Banner */}
        <View style={styles.voucherTitleBox}>
          <Text style={styles.voucherTitle}>
            OFFICIAL DIGITAL PAYMENT VOUCHER (NO-RECEIPT ARTISAN ATTESTATION)
          </Text>
          <Text style={styles.voucherSubtitle}>
            Voucher Serial: {voucherNo} • Stamped Internal Chambers Disbursement Record
          </Text>
        </View>

        {/* Metadata Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Artisan / Vendor Payee:</Text>
            <Text style={styles.metaValue}>
              {transaction.artisan_name || transaction.reference_note || 'Verified Estate Artisan'}
            </Text>
            {transaction.artisan_phone && (
              <>
                <Text style={[styles.metaLabel, { marginTop: 4 }]}>Artisan Contact Phone:</Text>
                <Text style={styles.metaValue}>{transaction.artisan_phone}</Text>
              </>
            )}
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Property &amp; Demised Unit:</Text>
            <Text style={styles.metaValue}>
              {transaction.property?.title || 'Managed Estate'}
              {transaction.unit?.unit_name ? ` • ${transaction.unit.unit_name}` : ' (Shared Compound)'}
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Payment Voucher Serial:</Text>
            <Text style={[styles.metaValue, { color: '#064e3b' }]}>{voucherNo}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Disbursement Date:</Text>
            <Text style={styles.metaValue}>{formatDate(transaction.tx_date)}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Debited Funding Pool:</Text>
            <Text style={styles.metaValue}>{poolLabel}</Text>
            <Text style={[styles.metaLabel, { marginTop: 4 }]}>Logged &amp; Stamped By:</Text>
            <Text style={styles.metaValue}>
              {transaction.created_by_name || solicitorName}
            </Text>
          </View>
        </View>

        {/* Scope of Work */}
        <Text style={styles.sectionTitle}>Particulars of Completed Artisan Maintenance Work</Text>
        <View style={styles.detailsBox}>
          <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
            {transaction.description}
          </Text>
          <Text style={{ fontSize: 8, color: '#475569', marginTop: 4 }}>
            {transaction.reference_note ||
              `Internal Stamped Voucher ${voucherNo} issued for informal artisan repair work inspected and verified by Chambers.`}
          </Text>
          <Text style={{ fontSize: 7.5, color: '#64748b', marginTop: 6 }}>
            External Paper Receipt Attached: {transaction.receipt_url ? 'Yes (Archived in Storage)' : 'No — Covered by Internal Stamped Voucher'} • Completed Work Photo Proof: {transaction.work_photo_url ? 'Yes (Verified & Archived in Supabase Storage)' : 'Inspected Physically'}
          </Text>
        </View>

        {/* Total Disbursed */}
        <View style={styles.totalBox}>
          <Text>TOTAL ARTISAN SUM DISBURSED &amp; AUDITED:</Text>
          <Text>{formatNaira(transaction.amount).replace('₦', 'NGN ')}</Text>
        </View>

        {/* Official Digital Stamp */}
        <View style={styles.stampBox}>
          <Text style={styles.stampTitle}>
            [ CHAMBERS DIGITAL STAMP • {voucherNo} • LOCKED &amp; VERIFIED ]
          </Text>
          <Text style={styles.stampSub}>
            Certified by {firmName} • Supreme Court Enrolment #{enrollmentNo} • Immutable Audit Record
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.footerSign}>
          <View style={styles.signBlock}>
            <Text style={styles.signName}>{transaction.created_by_name || solicitorName}</Text>
            <Text style={styles.signTitle}>Prepared &amp; Logged By (Chambers Officer)</Text>
          </View>
          <View style={[styles.signBlock, { textAlign: 'right' }]}>
            <Text style={styles.signName}>{solicitorName}</Text>
            <Text style={styles.signTitle}>Head of Chambers Authorization</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
