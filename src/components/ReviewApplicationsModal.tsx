'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ClipboardList,
  UserCheck,
  XCircle,
  Download,
  Phone,
  Mail,
  Briefcase,
  MapPin,
  Users,
  Eye,
  Loader2,
  CheckCircle2,
  CreditCard,
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { TenancyApplication, Unit } from '@/types/database';
import { EstateStore, subscribeToStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { TenancyApplicationDocument } from '@/components/TenancyApplicationPDF';

interface ReviewApplicationsModalProps {
  unit: Unit | null;
  isOpen: boolean;
  onClose: () => void;
  onApproveAndOnboard: (app: TenancyApplication) => void;
}

export function ReviewApplicationsModal({
  unit,
  isOpen,
  onClose,
  onApproveAndOnboard,
}: ReviewApplicationsModalProps) {
  const [applications, setApplications] = useState<TenancyApplication[]>([]);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ title: string; url: string } | null>(null);

  const refreshApps = () => {
    if (!unit) return;
    setApplications(EstateStore.getTenancyApplications(unit.id));
  };

  useEffect(() => {
    if (isOpen && unit) {
      refreshApps();
      const unsub = subscribeToStore(() => refreshApps());
      return () => unsub();
    }
  }, [isOpen, unit]);

  if (!isOpen || !unit) return null;

  const handleExportPDF = async (app: TenancyApplication) => {
    setExportingId(app.id);
    try {
      const profile = EstateStore.getChamberProfile();
      const blob = await pdf(
        <TenancyApplicationDocument
          application={app}
          unit={unit}
          profile={profile}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tenancy_Application_${app.applicant_name.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || 'Failed to generate Tenancy Application PDF.');
    } finally {
      setExportingId(null);
    }
  };

  const handleReject = async (app: TenancyApplication) => {
    if (!confirm(`Mark ${app.applicant_name}'s tenancy application as REJECTED?`)) return;
    setUpdatingId(app.id);
    try {
      await EstateStore.updateTenancyApplicationStatus(app.id, 'REJECTED');
      refreshApps();
    } catch (err: any) {
      alert(err?.message || 'Could not update application status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="bg-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-emerald-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-emerald-950 font-bold">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Pre-Entry Tenancy Applications ({unit.unit_name})
              </h3>
              <p className="text-xs text-emerald-300">
                {unit.property?.title} • Review KYC Documents, Export PDF Form, or Approve &amp; Onboard
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-300 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 max-h-[80vh] overflow-y-auto space-y-4 text-xs">
          {applications.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
              <ClipboardList className="w-8 h-8 mx-auto text-slate-400" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                No Applications Submitted Yet for {unit.unit_name}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Share the public application link (<code className="font-mono">/apply/{unit.id}</code>) with prospective tenants so they can submit their bio-data, guarantor details, Passport Photograph, and Valid ID from their phone.
              </p>
            </div>
          ) : (
            applications.map((app) => {
              const statusBadge =
                app.status === 'APPROVED'
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                  : app.status === 'REJECTED'
                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300'
                  : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300';

              return (
                <div
                  key={app.id}
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs"
                >
                  {/* Top Row: Applicant Name, Photo & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3.5">
                    <div className="flex items-center gap-3.5">
                      {app.passport_photo_url ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: `Passport Photograph — ${app.applicant_name}`,
                              url: app.passport_photo_url!,
                            })
                          }
                          className="w-14 h-14 rounded-xl overflow-hidden border-2 border-emerald-700 shrink-0 relative group"
                        >
                          <img
                            src={app.passport_photo_url}
                            alt={app.applicant_name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                            <Eye className="w-4 h-4" />
                          </span>
                        </button>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-emerald-900/10 border border-emerald-700/30 flex items-center justify-center text-emerald-800 dark:text-emerald-300 font-bold text-sm shrink-0">
                          KYC
                        </div>
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                            {app.applicant_name}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${statusBadge}`}
                          >
                            {app.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-slate-500 mt-1">
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            {app.applicant_phone}
                          </span>
                          {app.applicant_email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3 text-emerald-600" />
                              {app.applicant_email}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            Applied: {formatDate(app.created_at.slice(0, 10))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Export Form PDF Button */}
                    <button
                      type="button"
                      disabled={exportingId === app.id}
                      onClick={() => handleExportPDF(app)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs shadow-2xs transition shrink-0"
                    >
                      {exportingId === app.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      )}
                      <span>Export Application PDF</span>
                    </button>
                  </div>

                  {/* Bio-Data & Guarantor Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        Applicant Employment &amp; KYC
                      </span>
                      <div>
                        <strong>NIN / ID Ref:</strong>{' '}
                        <span className="font-mono">{app.nin_or_id_number || 'Attached ID'}</span>
                      </div>
                      <div>
                        <strong>Occupation:</strong> {app.occupation || '—'}
                      </div>
                      <div>
                        <strong>Employer:</strong> {app.employer || '—'}
                      </div>
                      <div>
                        <strong>Previous Address:</strong> {app.previous_address || '—'}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Nominated Guarantor Particulars
                      </span>
                      <div>
                        <strong>Guarantor Name:</strong> {app.guarantor_name}
                      </div>
                      <div>
                        <strong>Phone:</strong>{' '}
                        <span className="font-mono">{app.guarantor_phone}</span>
                      </div>
                      <div>
                        <strong>Occupation:</strong> {app.guarantor_occupation || '—'}
                      </div>
                      <div>
                        <strong>Address:</strong> {app.guarantor_address}
                      </div>
                    </div>
                  </div>

                  {/* Uploaded KYC Documents Bar + Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      {app.passport_photo_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: `Passport Photograph — ${app.applicant_name}`,
                              url: app.passport_photo_url!,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-[11px]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Passport Photo</span>
                        </button>
                      )}

                      {app.valid_id_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: `Government Valid ID — ${app.applicant_name}`,
                              url: app.valid_id_url!,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-semibold text-[11px]"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>View Valid ID Card</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      {app.status !== 'REJECTED' && (
                        <button
                          type="button"
                          disabled={updatingId === app.id}
                          onClick={() => handleReject(app)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onApproveAndOnboard(app)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition"
                      >
                        <UserCheck className="w-4 h-4 text-amber-300" />
                        <span>Approve &amp; Onboard Tenant</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Lightbox Document Preview Modal */}
        {previewDoc && (
          <div
            className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-4 space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {previewDoc.title}
                </h4>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-950 rounded-xl p-3">
                {previewDoc.url.toLowerCase().endsWith('.pdf') ||
                previewDoc.url.startsWith('data:application/pdf') ? (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.title}
                    className="w-full h-[60vh] rounded-lg"
                  />
                ) : (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    className="max-h-[65vh] w-auto object-contain rounded-lg"
                  />
                )}
              </div>
              <div className="flex justify-end gap-2">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-800 text-white text-xs font-bold"
                >
                  Open Full File
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-xs font-semibold"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
