import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Calculator,
  Ticket,
} from 'lucide-react';
import type { RiskScore, VulnerabilityNode, OwnerNode } from '../types/api';

interface FindingsStoryProps {
  riskScores: RiskScore[];
  vulnerabilities: VulnerabilityNode[];
  owners?: OwnerNode[];
  targetServiceId?: string;
  onCreateTicket?: (serviceId: string, vulnId: string) => void;
}

export function FindingsStory({
  riskScores,
  vulnerabilities,
  targetServiceId,
  onCreateTicket,
}: FindingsStoryProps) {
  const [expandedVuln, setExpandedVuln] = useState<string | null>(null);

  const hasRiskScores = riskScores && riskScores.length > 0;

  return (
    <div className="space-y-10 text-left py-2">
      {/* ── Section Header ── */}
      <div className="pb-4 border-b border-slate-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-1">
          Section 04 · Findings Dossier
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          What the Graph Revealed
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Verified security findings prioritized through topological blast radius mathematics rather than arbitrary severity labels.
        </p>
      </div>

      {/* ── Transparent Risk Scoring Formula Banner ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-500 font-medium">
          <span className="font-bold text-slate-800 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" />
            Transparent Mathematical Risk Engine
          </span>
          <span className="font-mono text-[11px]">FalkorDB Formula</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Term A
            </span>
            <div className="text-xl font-bold text-slate-900">Severity Base</div>
            <p className="text-xs text-slate-500">
              Critical = 40.0 · High = 30.0 · Medium = 20.0 · Low = 10.0
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/60 space-y-1">
            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider block">
              Term B
            </span>
            <div className="text-xl font-bold text-blue-700">Impact Bonus</div>
            <p className="text-xs text-slate-500">
              +10.0 points per unique reachable downstream microservice
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/60 space-y-1">
            <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">
              Term C
            </span>
            <div className="text-xl font-bold text-rose-700">Depth Bonus</div>
            <p className="text-xs text-slate-500">
              +5.0 points per maximum hop depth traversed along DEPENDS_ON
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 text-white font-mono text-xs flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <span className="font-semibold text-blue-300">
            TOTAL RISK SCORE = Base + (Impacted × 10) + (Depth × 5)
          </span>
          <span className="text-slate-400 text-[11px]">Normalized [0 - 100]</span>
        </div>
      </div>

      {/* ── Findings Intelligence Report Rows ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
        <div className="p-5 bg-slate-50/80 flex items-center justify-between text-xs font-bold text-slate-700">
          <span className="uppercase tracking-wider">
            Active Security Findings
          </span>
          <span className="text-slate-500 font-normal">
            {hasRiskScores ? `${riskScores.length} Scored Findings` : `${vulnerabilities.length} Known CVEs`}
          </span>
        </div>

        {hasRiskScores ? (
          riskScores.map((score, idx) => {
            const isExpanded = expandedVuln === score.vulnerability_id;
            return (
              <div key={score.vulnerability_id} className="p-5 sm:p-6 transition-colors hover:bg-slate-50/40">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: ID & Title */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400 font-bold">0{idx + 1} ·</span>
                      <span className="font-mono font-bold text-rose-600">{score.vulnerability_id}</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase">
                        {score.severity}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold text-slate-900">
                      {score.vulnerability_title}
                    </h4>
                  </div>

                  {/* Right: Scores & Actions */}
                  <div className="flex flex-wrap items-center gap-5 text-xs">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Risk Score</div>
                      <div className="text-2xl font-extrabold text-slate-900 leading-none">
                        {score.risk_score.toFixed(1)}
                        <span className="text-xs font-bold text-rose-600 ml-1">
                          [{score.priority}]
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Blast Radius</div>
                      <div className="font-bold text-blue-600">
                        {score.affected_service_count} svcs · {score.observed_depth} hops
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedVuln(isExpanded ? null : score.vulnerability_id)}
                      className="btn-modern-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>{isExpanded ? 'Hide details' : 'Inspect dossier'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Drawer */}
                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-slate-100 space-y-3.5 text-xs">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                        Reasoning & Evidence Path
                      </span>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {score.explanation}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-slate-500">
                        Target Service Node: <strong className="text-slate-800">{targetServiceId || 'Target Mesh'}</strong>
                      </span>

                      {onCreateTicket && targetServiceId && (
                        <button
                          onClick={() => onCreateTicket(targetServiceId, score.vulnerability_id)}
                          className="btn-modern-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Ticket className="w-4 h-4" />
                          <span>Dispatch Remediation Ticket</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          vulnerabilities.map((vuln, idx) => (
            <div key={vuln.id} className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-bold">0{idx + 1} ·</span>
                  <span className="font-mono font-bold text-rose-600">{vuln.id}</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase">
                    {vuln.severity}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900">{vuln.title}</h4>
                <p className="text-xs text-slate-500 max-w-xl">{vuln.description}</p>
              </div>

              <div className="text-xs text-right">
                <div className="text-[10px] text-slate-400 uppercase font-bold">CVE Identifier</div>
                <div className="font-mono font-bold text-slate-800">{vuln.cve || 'CVE-PENDING'}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
