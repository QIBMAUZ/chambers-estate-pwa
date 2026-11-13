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
import { TenancyApplication, Unit, ChamberProfile } from '@/types/database';
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
    paddingBottom: 10,
    marginBottom: 12,
    textAlign: 'center',
  },
  logo: {
    width: 72,
    height: 54,
    objectFit: 'contain',
    marginBottom: 5,
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
  titleBanner: {
    backgroundColor: '#064e3b',
    padding: 6,
    borderRadius: 4,
    textAlign: 'center',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  subtitleText: {
    fontSize: 7.5,
    color: '#fef3c7',
    marginTop: 2,
  },
  topBioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  bioLeft: {
    width: '72%',
  },
  passportBox: {
    width: '25%',
    height: 105,
    borderWidth: 1.5,
    borderColor: '#064e3b',
    borderRadius: 4,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  passportImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
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
  gridBox: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
  },
  fieldLabel: {
    width: '38%',
    fontSize: 8,
    color: '#64748b',
    fontFamily: 'Helvetica-Bold',
  },
  fieldValue: {
    width: '60%',
    fontSize: 8.5,
    color: '#0f172a',
    fontFamily: 'Helvetica-Bold',
  },
  idImageBox: {
    marginTop: 6,
    height: 110,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  declarationBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 4,
  },
  footerSign: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signBlock: {
    width: '45%',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    paddingTop: 4,
  },
});

export interface TenancyApplicationPDFProps {
  application: TenancyApplication;
  unit: Unit;
  profile?: ChamberProfile;
}

export function TenancyApplicationDocument({
  application,
  unit,
  profile,
}: TenancyApplicationPDFProps) {
  const firmName = profile?.firm_name || 'BARR. T. A. BABATUNDE & ASSOCIATES';
  const solicitorName = profile?.solicitor_name || 'Barr. T. A. Babatunde, LL.B, B.L';
  const enrollmentNo = profile?.enrollment_no || 'SCN/2004/0981';
  const address = profile?.office_address || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State';
  const phone = profile?.phone || '+234 803 555 0192';
  const email = profile?.email || 'chambers@babatundelaw.ng';
  const logoUrl = profile?.letterhead_logo_url ? String(profile.letterhead_logo_url).trim() : null;

  const isIdImage =
    application.valid_id_url &&
    !application.valid_id_url.toLowerCase().endsWith('.pdf') &&
    !application.valid_id_url.startsWith('data:application/pdf');

  return (
    <Document
      title={`Tenancy_Application_${application.applicant_name.replace(/\s+/g, '_')}`}
    >
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

        {/* Form Banner */}
        <View style={styles.titleBanner}>
          <Text style={styles.titleText}>
            PRE-ENTRY TENANCY APPLICATION &amp; STATUTORY KYC INTAKE FORM
          </Text>
          <Text style={styles.subtitleText}>
            Application Ref: APP-{application.id.slice(0, 8).toUpperCase()} • Status: {application.status} • Submitted: {formatDate(application.created_at.slice(0, 10))}
          </Text>
        </View>

        {/* Top Bio & Passport Photograph Row */}
        <View style={styles.topBioRow}>
          <View style={styles.bioLeft}>
            <Text style={{ fontSize: 7.5, color: '#64748b', textTransform: 'uppercase' }}>
              Target Demised Premises Applied For:
            </Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#064e3b', marginTop: 1 }}>
              {unit.unit_name} — {unit.property?.title || 'Managed Estate'}
            </Text>
            <Text style={{ fontSize: 8, color: '#475569', marginTop: 1 }}>
              {unit.property?.address || address}
            </Text>

            <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
              <Text style={{ fontSize: 8, color: '#0f172a', fontFamily: 'Helvetica-Bold' }}>
                Standard Move-In Financial Terms:
              </Text>
              <Text style={{ fontSize: 8, color: '#334155', marginTop: 2 }}>
                • Annual Rent: {formatNaira(unit.annual_rent).replace('₦', 'NGN ')}
              </Text>
              <Text style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>
                • 10% First-Year Legal Agreement Fee: {formatNaira(Math.round((unit.annual_rent || 0) * 0.1)).replace('₦', 'NGN ')}
              </Text>
              <Text style={{ fontSize: 8, color: '#334155', marginTop: 1 }}>
                • Service Charge: {formatNaira(unit.annual_service_charge).replace('₦', 'NGN ')} • Caution Deposit: {formatNaira(unit.caution_fee).replace('₦', 'NGN ')}
              </Text>
            </View>
          </View>

          <View style={styles.passportBox}>
            {application.passport_photo_url ? (
              <Image src={application.passport_photo_url} style={styles.passportImg} />
            ) : (
              <Text style={{ fontSize: 7.5, color: '#64748b', textAlign: 'center' }}>
                PASSPORT PHOTOGRAPH ON FILE
              </Text>
            )}
          </View>
        </View>

        {/* Section 1: Applicant Bio-Data & Employment */}
        <Text style={styles.sectionTitle}>1. Prospective Tenant Bio-Data &amp; Employment Particulars</Text>
        <View style={styles.gridBox}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Full Legal Name:</Text>
            <Text style={styles.fieldValue}>{application.applicant_name}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Telephone / WhatsApp:</Text>
            <Text style={styles.fieldValue}>{application.applicant_phone}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email Address:</Text>
            <Text style={styles.fieldValue}>{application.applicant_email || 'N/A'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Valid ID / NIN Reference:</Text>
            <Text style={styles.fieldValue}>{application.nin_or_id_number || 'Attached Below'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Occupation / Profession:</Text>
            <Text style={styles.fieldValue}>{application.occupation || 'N/A'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Employer / Office Address:</Text>
            <Text style={styles.fieldValue}>{application.employer || 'N/A'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Previous Residential Address:</Text>
            <Text style={styles.fieldValue}>{application.previous_address || 'N/A'}</Text>
          </View>
        </View>

        {/* Section 2: Guarantor Particulars */}
        <Text style={styles.sectionTitle}>2. Nominated Guarantor Undertaking &amp; Contact Particulars</Text>
        <View style={styles.gridBox}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Guarantor Full Name:</Text>
            <Text style={styles.fieldValue}>{application.guarantor_name}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Guarantor Telephone:</Text>
            <Text style={styles.fieldValue}>{application.guarantor_phone}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Guarantor Occupation:</Text>
            <Text style={styles.fieldValue}>{application.guarantor_occupation || 'N/A'}</Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Guarantor Address:</Text>
            <Text style={styles.fieldValue}>{application.guarantor_address}</Text>
          </View>
        </View>

        {/* Section 3: Valid ID Snapshot */}
        {isIdImage && application.valid_id_url && (
          <>
            <Text style={styles.sectionTitle}>3. Uploaded Government-Issued Valid Identification</Text>
            <View style={styles.idImageBox}>
              <Image
                src={application.valid_id_url}
                style={{ width: 220, height: 95, objectFit: 'contain' }}
              />
            </View>
          </>
        )}

        {/* Applicant Declaration */}
        <View style={styles.declarationBox}>
          <Text style={{ fontSize: 7.5, color: '#065f46', lineHeight: 1.35 }}>
            STATUTORY DECLARATION: I, {application.applicant_name}, hereby declare that the bio-data, employment, identification, and guarantor particulars supplied above are true and accurate. I undertake to abide by the covenants of the Tenancy Agreement prepared by {firmName} upon approval of this application.
          </Text>
        </View>

        {/* Signatures */}
        <View style={styles.footerSign}>
          <View style={styles.signBlock}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>
              {application.applicant_name}
            </Text>
            <Text style={{ fontSize: 7.5, color: '#64748b' }}>
              Prospective Tenant (Electronic Intake Submission)
            </Text>
          </View>
          <View style={[styles.signBlock, { textAlign: 'right' }]}>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold' }}>{solicitorName}</Text>
            <Text style={{ fontSize: 7.5, color: '#64748b' }}>
              Reviewed By Chambers • Enrolment #{enrollmentNo}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
