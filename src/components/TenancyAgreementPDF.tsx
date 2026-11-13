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
import { Unit, ChamberProfile } from '@/types/database';
import { formatNaira, formatDate } from '@/lib/utils';

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 8.8,
    fontFamily: 'Helvetica',
    color: '#1e293b',
    backgroundColor: '#ffffff',
    lineHeight: 1.4,
  },
  headerContainer: {
    borderBottomWidth: 2,
    borderBottomColor: '#064e3b',
    paddingBottom: 8,
    marginBottom: 10,
    textAlign: 'center',
  },
  logo: {
    width: 68,
    height: 50,
    objectFit: 'contain',
    marginBottom: 4,
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
    fontSize: 7.5,
    color: '#d97706',
    marginTop: 2,
    fontFamily: 'Helvetica-Bold',
  },
  chambersAddress: {
    fontSize: 7.2,
    color: '#64748b',
    marginTop: 2,
  },
  titleBanner: {
    backgroundColor: '#064e3b',
    padding: 6,
    borderRadius: 4,
    textAlign: 'center',
    marginBottom: 10,
  },
  titleText: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  subtitleText: {
    fontSize: 7.2,
    color: '#fef3c7',
    marginTop: 1.5,
  },
  partiesBox: {
    padding: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    marginBottom: 10,
  },
  partyBlock: {
    marginBottom: 6,
  },
  partyLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    textTransform: 'uppercase',
  },
  partyText: {
    fontSize: 8.5,
    color: '#0f172a',
    marginTop: 1,
  },
  sectionHeading: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    marginTop: 7,
    marginBottom: 3,
    textTransform: 'uppercase',
    borderBottomWidth: 0.8,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 1.5,
  },
  clauseText: {
    fontSize: 8.2,
    color: '#1e293b',
    marginBottom: 4,
    textAlign: 'justify',
  },
  financialGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 4,
    padding: 7,
    marginVertical: 5,
  },
  finCol: {
    width: '24%',
  },
  finLabel: {
    fontSize: 7,
    color: '#065f46',
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  finVal: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#064e3b',
    marginTop: 1,
  },
  executionWrapper: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: '#064e3b',
  },
  executionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  signBox: {
    width: '48%',
    padding: 8,
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    minHeight: 112,
    justifyContent: 'space-between',
  },
  signatureImage: {
    width: 140,
    height: 45,
    objectFit: 'contain',
    marginVertical: 4,
  },
  wetInkBox: {
    height: 45,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    borderStyle: 'dashed',
    marginVertical: 6,
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  frankingFooter: {
    marginTop: 10,
    padding: 6,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export interface TenancyAgreementPDFProps {
  unit: Unit;
  profile?: ChamberProfile;
}

export function TenancyAgreementDocument({
  unit,
  profile,
}: TenancyAgreementPDFProps) {
  const firmName = profile?.firm_name || 'BARR. T. A. BABATUNDE & ASSOCIATES';
  const solicitorName = profile?.solicitor_name || 'Barr. T. A. Babatunde, LL.B, B.L';
  const enrollmentNo = profile?.enrollment_no || 'SCN/2004/0981';
  const officeAddress = profile?.office_address || 'Plot 14 Admiralty Way, Lekki Phase 1, Lagos State';
  const phone = profile?.phone || '+234 803 555 0192';
  const email = profile?.email || 'chambers@babatundelaw.ng';
  const logoUrl = profile?.letterhead_logo_url ? String(profile.letterhead_logo_url).trim() : null;

  const landlordName = unit.property?.landlord?.name || 'THE REGISTERED LANDLORD';
  const propertyTitle = unit.property?.title || 'Managed Residential Estate';
  const propertyAddress = unit.property?.address || officeAddress;
  const propertyState = unit.property?.state || 'Lagos';

  const tenantName = unit.current_tenant_name || 'PROSPECTIVE TENANT';
  const tenantPhone = unit.tenant_phone || 'N/A';
  const tenantNin = unit.tenant_nin_or_id || 'On File';
  const tenantOccupation = unit.tenant_occupation || 'Resident';

  const annualRent = Number(unit.annual_rent || 0);
  const legalFee10 = Math.round(annualRent * 0.1);
  const serviceCharge = Number(unit.annual_service_charge || 0);
  const cautionFee = Number(unit.caution_fee || 0);

  return (
    <Document
      title={`Tenancy_Agreement_${unit.unit_name.replace(/\s+/g, '_')}_${tenantName.replace(/\s+/g, '_')}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Chambers Letterhead */}
        <View style={styles.headerContainer}>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          <Text style={styles.chambersTitle}>{firmName}</Text>
          <Text style={styles.chambersSub}>
            LEGAL PRACTITIONERS, CONVEYANCERS &amp; CHARTERED ESTATE SOLICITORS
          </Text>
          <Text style={styles.chambersAddress}>
            {officeAddress} • Tel: {phone} • Email: {email}
          </Text>
        </View>

        {/* Title Banner */}
        <View style={styles.titleBanner}>
          <Text style={styles.titleText}>
            TENANCY AGREEMENT IN RESPECT OF {unit.unit_name.toUpperCase()}, {propertyTitle.toUpperCase()}
          </Text>
          <Text style={styles.subtitleText}>
            Hybrid Execution Instrument: Tenant Electronic Signature + Landlord Physical Wet-Ink Execution
          </Text>
        </View>

        {/* Parties Recital */}
        <View style={styles.partiesBox}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>THIS TENANCY AGREEMENT IS MADE BETWEEN:</Text>
            <Text style={styles.partyText}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{landlordName}</Text> of {propertyAddress}, {propertyState} State, Nigeria (acting through his retained Legal Practitioners &amp; Property Managers, <Text style={{ fontFamily: 'Helvetica-Bold' }}>{firmName}</Text>) (hereinafter called <Text style={{ fontFamily: 'Helvetica-Bold' }}>&quot;THE LANDLORD&quot;</Text> which expression shall where the context so admits include his heirs, assigns, and legal representatives) of the ONE PART;
            </Text>
          </View>

          <View style={[styles.partyBlock, { marginBottom: 0 }]}>
            <Text style={styles.partyLabel}>AND:</Text>
            <Text style={styles.partyText}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{tenantName}</Text> ({tenantOccupation} • Tel: {tenantPhone} • ID/NIN: {tenantNin}) (hereinafter called <Text style={{ fontFamily: 'Helvetica-Bold' }}>&quot;THE TENANT&quot;</Text> which expression shall where the context so admits include his/her personal representatives) of the OTHER PART.
            </Text>
          </View>
        </View>

        {/* Clause 1: Demised Premises & Habendum */}
        <Text style={styles.sectionHeading}>
          1. DEMISED PREMISES, FIXED TERM &amp; FINANCIAL CONSIDERATION
        </Text>
        <Text style={styles.clauseText}>
          1.1 THE LANDLORD hereby lets and THE TENANT hereby takes ALL THAT residential accommodation known and situate at <Text style={{ fontFamily: 'Helvetica-Bold' }}>{unit.unit_name}, {propertyTitle}, {propertyAddress}, {propertyState} State</Text> (hereinafter called &quot;the Demised Premises&quot;) for a fixed term of ONE (1) YEAR Certain commencing on <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatDate(unit.lease_start_date)}</Text> and expiring on <Text style={{ fontFamily: 'Helvetica-Bold' }}>{formatDate(unit.lease_end_date)}</Text>.
        </Text>

        {/* Financial Summary Grid */}
        <View style={styles.financialGrid}>
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>Annual Rent</Text>
            <Text style={styles.finVal}>{formatNaira(annualRent).replace('₦', 'NGN ')}</Text>
          </View>
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>10% Legal Fee (Yr 1)</Text>
            <Text style={styles.finVal}>{formatNaira(legalFee10).replace('₦', 'NGN ')}</Text>
          </View>
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>Service Charge</Text>
            <Text style={styles.finVal}>{formatNaira(serviceCharge).replace('₦', 'NGN ')}</Text>
          </View>
          <View style={styles.finCol}>
            <Text style={styles.finLabel}>Caution Deposit</Text>
            <Text style={styles.finVal}>{formatNaira(cautionFee).replace('₦', 'NGN ')}</Text>
          </View>
        </View>

        {/* Clause 2: Tenant Covenants */}
        <Text style={styles.sectionHeading}>2. TENANT&apos;S STATUTORY &amp; EXPRESS COVENANTS</Text>
        <Text style={styles.clauseText}>
          2.1 To pay the reserved Annual Rent, Service Charge, and Caution Deposit promptly in advance into the designated Client Escrow Account managed by {firmName} prior to taking possession or upon renewal.
        </Text>
        <Text style={styles.clauseText}>
          2.2 To use the Demised Premises strictly for private residential occupation only, and NOT to assign, sublet, short-let, or part with possession of the Demised Premises or any part thereof without the prior written consent of the Landlord and {firmName}.
        </Text>
        <Text style={styles.clauseText}>
          2.3 To keep the interior of the Demised Premises, electrical fittings, plumbing fixtures, doors, windows, and glass panes in good and tenantable repair (fair wear and tear excepted), failing which the cost of restoration upon vacating shall be deducted from the Refundable Caution Deposit.
        </Text>
        <Text style={styles.clauseText}>
          2.4 Not to make any structural alterations or additions to the Demised Premises, nor cause any nuisance or annoyance to adjoining occupants in the Estate.
        </Text>

        {/* Clause 3: Landlord Covenants & Guarantor Undertaking */}
        <Text style={styles.sectionHeading}>3. LANDLORD&apos;S COVENANTS &amp; GUARANTOR INDEMNITY</Text>
        <Text style={styles.clauseText}>
          3.1 THE LANDLORD covenants with the Tenant that the Tenant paying the rent hereby reserved and observing the covenants herein contained shall peaceably hold and enjoy the Demised Premises during the tenancy term without lawful interruption by the Landlord.
        </Text>
        {unit.guarantor_name && (
          <Text style={styles.clauseText}>
            3.2 GUARANTOR UNDERTAKING: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{unit.guarantor_name}</Text> (Tel: {unit.guarantor_phone || 'N/A'} • Address: {unit.guarantor_address || 'On File'}) stands as Guarantor for the Tenant and guarantees the due performance of the Tenant&apos;s financial and dilapidation obligations under this Agreement.
          </Text>
        )}

        {/* Hybrid Execution Block */}
        <View style={styles.executionWrapper}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#064e3b', textTransform: 'uppercase' }}>
            IN WITNESS WHEREOF THE PARTIES HAVE EXECUTED THIS AGREEMENT IN THE MANNER BELOW:
          </Text>

          <View style={styles.executionRow}>
            {/* Left Box: Tenant E-Signature */}
            <View style={styles.signBox}>
              <View>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#065f46', textTransform: 'uppercase' }}>
                  SIGNED ELECTRONICALLY BY THE TENANT:
                </Text>
                {unit.tenant_signature_url ? (
                  <Image src={unit.tenant_signature_url} style={styles.signatureImage} />
                ) : (
                  <View style={styles.wetInkBox}>
                    <Text style={{ fontSize: 7.5, color: '#94a3b8' }}>
                      [Awaiting Tenant E-Signature via /sign/{unit.agreement_token || unit.id}]
                    </Text>
                  </View>
                )}
              </View>

              <View>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
                  {tenantName}
                </Text>
                <Text style={{ fontSize: 7.2, color: '#475569' }}>
                  {unit.tenant_signed_at
                    ? `E-Signed on: ${formatDate(unit.tenant_signed_at.slice(0, 10))} (${new Date(unit.tenant_signed_at).toLocaleTimeString()})`
                    : 'Date of Tenant Execution: ______________________'}
                </Text>
              </View>
            </View>

            {/* Right Box: Landlord Wet-Ink Hard Copy Signature */}
            <View style={styles.signBox}>
              <View>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#92400e', textTransform: 'uppercase' }}>
                  SIGNED BY THE LANDLORD (WET-INK HARD COPY):
                </Text>
                <View style={styles.wetInkBox}>
                  <Text style={{ fontSize: 7, color: '#64748b' }}>
                    Landlord Physical Signature / Stamp (Sign After Printing)
                  </Text>
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
                  {landlordName}
                </Text>
                <Text style={{ fontSize: 7.2, color: '#475569' }}>
                  Date of Wet-Ink Execution: ______________________
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Solicitor Franking Footer */}
        <View style={styles.frankingFooter}>
          <View>
            <Text style={{ fontSize: 7.5, color: '#fbbf24', fontFamily: 'Helvetica-Bold' }}>
              PREPARED &amp; FRANKED BY SOLICITORS:
            </Text>
            <Text style={{ fontSize: 8.5, color: '#ffffff', fontFamily: 'Helvetica-Bold', marginTop: 1 }}>
              {solicitorName} • {firmName}
            </Text>
          </View>
          <View style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: 7.5, color: '#a7f3d0', fontFamily: 'Helvetica-Bold' }}>
              SUPREME COURT ENROLMENT NO: {enrollmentNo}
            </Text>
            <Text style={{ fontSize: 7, color: '#94a3b8', marginTop: 1 }}>
              Status: {unit.agreement_status || 'PENDING'}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
