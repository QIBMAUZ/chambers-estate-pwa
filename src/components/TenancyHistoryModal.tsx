'use client';

import React from 'react';
import { X, History, User, Shield, Calendar, FileText, Eye, CheckCircle2 } from 'lucide-react';
import { EstateStore } from '@/lib/store';
import { formatNaira, formatDate } from '@/lib/utils';

interface TenancyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId?: string;
  unitId?: string;
  title?: string;
}

export function TenancyHistoryModal({
  isOpen,
  onClose,
  propertyId,
  unitId,
  title,
}: TenancyHistoryModalProps) {
  if (!isOpen) return null;

  const history = EstateStore.getTenancyHistory(propertyId, unitId);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden my-6">
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Archived Tenancy &amp; Move-Out History
              </h3>
              <p className="text-xs text-slate-400">
                {title || 'Complete KYC, Guarantor, Executed Agreement & Caution Settlement Archive'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 max-h-[78vh] overflow-y-auto space-y-4 text-xs">
          {history.length === 0 ? (
            <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <History className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">
                No Vacated Tenancy Records Found
              </p>
              <p className="text-xs text-slate-400 mt-1">
                When a tenant vacates a unit via &quot;End Tenancy / Vacate&quot;, their full KYC, guarantor, executed agreement, and caution settlement snapshot is archived here.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2.5">
                  <div className="flex items-center gap-3">
                    {item.passport_photo_url && (
                      <a
                        href={item.passport_photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-xl overflow-hidden border border-emerald-700 shrink-0"
                      >
                        <img
                          src={item.passport_photo_url}
                          alt={item.tenant_name}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {item.tenant_name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                          {item.unit_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {item.property_title} • Vacated on <strong>{formatDate(item.move_out_date)}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Archived By</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {item.created_by_name || 'Chambers Officer'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="font-bold text-[10px] uppercase text-emerald-700 dark:text-emerald-400 block">
                      Tenant KYC Snapshot
                    </span>
                    <div><strong>Phone:</strong> {item.tenant_phone || '—'}</div>
                    <div><strong>Email:</strong> {item.tenant_email || '—'}</div>
                    <div><strong>NIN / ID:</strong> {item.tenant_nin_or_id || '—'}</div>
                    <div><strong>Occupation:</strong> {item.tenant_occupation || '—'} ({item.tenant_employer || '—'})</div>
                    <div><strong>Lease Term:</strong> {formatDate(item.lease_start_date)} → {formatDate(item.lease_end_date)}</div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="font-bold text-[10px] uppercase text-amber-700 dark:text-amber-400 block">
                      Guarantor &amp; Caution Settlement
                    </span>
                    <div><strong>Guarantor:</strong> {item.guarantor_name || '—'} ({item.guarantor_phone || '—'})</div>
                    <div><strong>Guarantor Address:</strong> {item.guarantor_address || '—'}</div>
                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                      <span>Caution Held: {formatNaira(item.caution_deposit_held)}</span>
                      <span className="text-rose-600">Deductions: -{formatNaira(item.deductions_amount)}</span>
                    </div>
                    <div className="font-bold text-emerald-700 dark:text-emerald-400">
                      Net Caution Refunded: {formatNaira(item.refund_amount)}
                    </div>
                  </div>
                </div>

                {/* Archived KYC & Agreement Document Links */}
                {(item.passport_photo_url || item.valid_id_url || item.executed_agreement_scan_url) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {item.passport_photo_url && (
                      <a
                        href={item.passport_photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold text-[11px]"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Archived Passport Photo</span>
                      </a>
                    )}
                    {item.valid_id_url && (
                      <a
                        href={item.valid_id_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-semibold text-[11px]"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Archived Valid ID</span>
                      </a>
                    )}
                    {item.executed_agreement_scan_url && (
                      <a
                        href={item.executed_agreement_scan_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold text-[11px]"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Archived Executed Agreement</span>
                      </a>
                    )}
                  </div>
                )}

                {item.settlement_notes && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    <strong>Settlement Notes:</strong> {item.settlement_notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
