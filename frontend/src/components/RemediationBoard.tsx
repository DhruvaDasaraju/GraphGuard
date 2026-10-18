import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Plus,
  X,
  Terminal,
} from 'lucide-react';
import type {
  RemediationTicket,
  ServiceNode,
  VulnerabilityNode,
} from '../types/api';

interface RemediationBoardProps {
  tickets: RemediationTicket[];
  services: ServiceNode[];
  vulnerabilities: VulnerabilityNode[];
  initialServiceId?: string;
  initialVulnId?: string;
  onCreateTicket: (payload: {
    service_id: string;
    vulnerability_id: string;
    reason: string;
    recommended_steps: string[];
  }) => Promise<void>;
  loading?: boolean;
}

export function RemediationBoard({
  tickets,
  services,
  vulnerabilities,
  initialServiceId = '',
  initialVulnId = '',
  onCreateTicket,
}: RemediationBoardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<RemediationTicket | null>(
    tickets.length > 0 ? tickets[0] : null
  );

  // Form State
  const [serviceId, setServiceId] = useState(
    initialServiceId || (services[0]?.id ?? 'payment-service')
  );
  const [vulnId, setVulnId] = useState(
    initialVulnId || (vulnerabilities[0]?.id ?? 'vuln-1')
  );
  const [reason, setReason] = useState(
    'SQL injection vulnerability exposes the payment transaction ledger and downstream dependencies.'
  );
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setFormError('Please enter a valid remediation reason.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      await onCreateTicket({
        service_id: serviceId,
        vulnerability_id: vulnId,
        reason,
        recommended_steps: [
          'Sanitize all input parameters using parameterized ORM queries',
          'Deploy hotfix patch to staging cluster',
          'Verify regression testing on downstream checkout services',
        ],
      });

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to dispatch ticket to FalkorDB.');
    } finally {
      setSubmitting(false);
    }
  };

  const featured = selectedTicket || (tickets.length > 0 ? tickets[0] : null);

  return (
    <div className="space-y-10 text-left py-2">
      {/* ── Section Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-1">
            Section 05 · Action Engine
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            From Evidence to Action
          </h2>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Proposed remediation tickets persisted in FalkorDB. Grounded in graph evidence with explicit escalation paths and blast radius contexts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-modern-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>File new ticket</span>
        </button>
      </div>

      {/* ── Featured Ticket Card (Smooth Rounded, Crisp White) ── */}
      {featured && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold uppercase">
                {featured.priority || 'P1 Critical'}
              </span>
              <span className="font-mono text-xs text-slate-500">
                Ticket #{featured.id}
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              Status: {featured.status || 'PROPOSED'}
            </span>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-2xl font-bold text-slate-900">
              {featured.title}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              {featured.description}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Target Service</span>
              <span className="font-mono font-bold text-slate-800">{featured.target_service_id}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Vulnerability</span>
              <span className="font-mono font-bold text-rose-600">{featured.vulnerability_id}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Risk Score</span>
              <span className="font-bold text-blue-600">{featured.risk_score ? featured.risk_score.toFixed(1) : '95.0'} / 100</span>
            </div>
          </div>
        </div>
      )}

      {/* ── All Tickets Grid / List ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
        <div className="p-5 bg-slate-50/80 flex items-center justify-between text-xs font-bold text-slate-700">
          <span className="uppercase tracking-wider">
            Active Remediation Queue ({tickets.length} Tickets)
          </span>
          <span className="text-slate-500 font-normal">Persisted in FalkorDB</span>
        </div>

        {tickets.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Terminal className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">No remediation tickets filed yet.</p>
            <p className="text-xs text-slate-500">
              Run an investigation or click "File new ticket" to create an action item.
            </p>
          </div>
        ) : (
          tickets.map((t, idx) => (
            <div
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className={`p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-colors ${
                selectedTicket?.id === t.id ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-bold">0{idx + 1} ·</span>
                  <span className="font-mono font-bold text-slate-900">{t.id}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                    {t.priority}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900">{t.title}</h4>
                <div className="text-xs text-slate-500">
                  Target: <strong className="text-slate-800 font-mono">{t.target_service_id}</strong> · Vuln: <strong className="text-rose-600 font-mono">{t.vulnerability_id}</strong>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
                  {t.status}
                </span>
                <span className="text-xl font-extrabold text-blue-600">
                  {t.risk_score ? t.risk_score.toFixed(1) : '90.0'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create Ticket Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg w-full p-6 sm:p-7 space-y-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] text-blue-600 uppercase font-bold tracking-wider block">
                  Action Dispatch
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Propose Remediation Ticket
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block uppercase text-[10px] text-slate-500 mb-1 font-bold">
                  Target Microservice
                </label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block uppercase text-[10px] text-slate-500 mb-1 font-bold">
                  Target Vulnerability
                </label>
                <select
                  value={vulnId}
                  onChange={(e) => setVulnId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {vulnerabilities.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id}: {v.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block uppercase text-[10px] text-slate-500 mb-1 font-bold">
                  Remediation Justification & Evidence
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-modern-secondary px-4 py-2 rounded-xl text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-modern-primary px-5 py-2 rounded-xl text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Persisting...' : 'Persist to FalkorDB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
