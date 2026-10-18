import { useState } from 'react';
import {
  Zap,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';
import type {
  ServiceNode,
  InvestigationResult,
} from '../types/api';

interface InvestigationWorkspaceProps {
  services: ServiceNode[];
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  onRunInvestigation: (question: string, createTicket: boolean) => Promise<void>;
  investigation: InvestigationResult | null;
  loading: boolean;
  onCreateTicketForVuln?: (serviceId: string, vulnId: string) => void;
}

export function InvestigationWorkspace({
  services,
  selectedServiceId,
  onSelectService,
  onRunInvestigation,
  investigation,
  loading,
  onCreateTicketForVuln,
}: InvestigationWorkspaceProps) {
  const [question, setQuestion] = useState(
    selectedServiceId
      ? `Investigate ${selectedServiceId} for critical security risks and trace dependent blast radius`
      : 'Investigate payment-service for critical security risks and trace dependent blast radius'
  );
  const [autoCreateTicket, setAutoCreateTicket] = useState(false);
  const [showToolHistory, setShowToolHistory] = useState(false);

  // Quick preset alerts
  const presetAlerts = [
    {
      id: 'alert-1',
      svc: 'payment-service',
      title: 'Payment API SQL Injection',
      desc: 'CVE-2024-3094 · Critical 95.0',
    },
    {
      id: 'alert-2',
      svc: 'auth-service',
      title: 'JWT Algorithm Confusion',
      desc: 'CVE-2024-2101 · High 82.5',
    },
    {
      id: 'alert-3',
      svc: 'order-service',
      title: 'Order Processing Blast Radius',
      desc: 'Multi-hop dependency risk trace',
    },
  ];

  const handleSelectPreset = (svc: string, title: string) => {
    onSelectService(svc);
    const q = `Investigate ${svc} for ${title} and trace multi-hop dependent blast radius`;
    setQuestion(q);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;
    onRunInvestigation(question, autoCreateTicket);
  };

  return (
    <div className="space-y-10 text-left py-2">
      {/* ── Section Header ── */}
      <div className="pb-4 border-b border-slate-200">
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-1">
          Section 02 · Investigation Workspace
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Follow the Evidence
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Trace security alert relationships across microservices. Uncover downstream dependents and resolve ownership automatically.
        </p>
      </div>

      {/* ── Alert Selection & Prompt Area (Rounded, Clean White) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
        <div>
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-3">
            01 / Select Security Alert Preset
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {presetAlerts.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.svc, preset.title)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedServiceId === preset.svc
                    ? 'border-blue-500 bg-blue-50/60 shadow-xs'
                    : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-blue-600 font-bold mb-1">
                  <span>{preset.svc}</span>
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="text-sm font-bold text-slate-900">
                  {preset.title}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Selector for All Services */}
        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
          <span className="text-slate-600 font-medium">Or choose indexed service:</span>
          <select
            value={selectedServiceId}
            onChange={(e) => {
              onSelectService(e.target.value);
              setQuestion(`Investigate ${e.target.value} for critical security risks and trace dependent blast radius`);
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id}) — {s.criticality}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask GraphGuard to trace any service or vulnerability..."
                className="w-full px-4 py-3 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="btn-modern-primary px-6 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {loading ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Reasoning...</span>
                </>
              ) : (
                <>
                  <span>Investigate alert</span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCreateTicket}
                onChange={(e) => setAutoCreateTicket(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Automatically propose remediation ticket in FalkorDB</span>
            </label>

            <span className="font-mono text-[11px] text-slate-400">
              FalkorDB Cypher execution
            </span>
          </div>
        </form>
      </div>

      {/* ── Loading Animation ── */}
      {loading && (
        <div className="p-10 bg-white border border-slate-200 rounded-2xl shadow-xs text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h4 className="text-lg font-bold text-slate-900">
            GraphGuard Agent is reasoning across connected data...
          </h4>
          <p className="text-xs text-slate-500">
            Traversing Cypher dependencies · Calculating blast radii · Locating escalation owners
          </p>
        </div>
      )}

      {/* ── Investigation Narrative & Evidence Results ── */}
      {investigation && !loading && (
        <div className="space-y-6">
          {/* Top Result Banner */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold">
                Investigation #{investigation.investigation_id.slice(0, 8)}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                Target: {investigation.target_entity || 'Identified Service'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                {investigation.mode.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="text-xs font-medium text-slate-500">
              Found: {investigation.impacted_services.length} Impacted Services · {investigation.vulnerabilities_found.length} CVEs
            </div>
          </div>

          {/* Two-Column Investigation Narrative Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Numbered Discoveries (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="pb-1 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Investigation Narrative
                </span>
                <span className="text-[11px] text-slate-400">
                  Chronological Reasoning Trace
                </span>
              </div>

              {/* Discovery 01: Alert Received */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>01 / Alert Received</span>
                  <span className="text-slate-400 text-[11px] font-normal">Target Verified</span>
                </div>
                <div className="text-base font-bold text-slate-900">
                  "{investigation.question}"
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Security agent verified root target node <span className="font-mono font-semibold text-slate-800">{investigation.target_entity}</span> in the infrastructure graph mesh.
                </p>
              </div>

              {/* Discovery 02: Vulnerability Located */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-rose-600">
                  <span>02 / Root Vulnerability Located</span>
                  <span className="text-slate-400 text-[11px] font-normal">{investigation.vulnerabilities_found.length} Attached</span>
                </div>
                {investigation.vulnerabilities_found.length > 0 ? (
                  investigation.vulnerabilities_found.map((vuln) => (
                    <div key={vuln.id} className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                        <span>{vuln.id}: {vuln.title}</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold uppercase">
                          {vuln.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700">
                        {vuln.description || 'Vulnerability detected on target service.'}
                      </p>
                      {vuln.cve && (
                        <div className="font-mono text-[11px] text-slate-500 pt-1">
                          CVE Reference: {vuln.cve}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    No critical CVE attachments directly linked to this service node.
                  </p>
                )}
              </div>

              {/* Discovery 03: Dependency Blast Radius Traced */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>03 / Dependency Blast Radius Traced</span>
                  <span className="text-slate-400 text-[11px] font-normal">{investigation.impacted_services.length} Downstream</span>
                </div>
                {investigation.impacted_services.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">
                      Traversing reverse <code className="font-mono font-semibold text-slate-800">DEPENDS_ON</code> relationships revealed downstream consumers:
                    </p>
                    <div className="divide-y divide-slate-100 text-xs">
                      {investigation.impacted_services.map((svc) => (
                        <div key={svc.service_id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900">{svc.service_name}</span>
                            <span className="text-slate-400 font-mono text-[11px] ml-2">({svc.service_id})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                              Hop {svc.hop_count}
                            </span>
                            <span className="text-[11px] uppercase font-bold text-slate-600">
                              {svc.criticality}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Zero downstream dependents traced. Blast radius is isolated.
                  </p>
                )}
              </div>

              {/* Discovery 04: Owner Located */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-purple-600">
                  <span>04 / Escalation Owners Located</span>
                  <span className="text-slate-400 text-[11px] font-normal">{investigation.owner_info.length} Found</span>
                </div>
                {investigation.owner_info.length > 0 ? (
                  investigation.owner_info.map((owner) => (
                    <div key={owner.id} className="flex items-center justify-between p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                          {owner.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{owner.name}</div>
                          <div className="text-[11px] text-slate-500">{owner.team}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-purple-700 font-semibold">{owner.contact}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">
                    No explicit ownership node mapped in graph. Unassigned service.
                  </p>
                )}
              </div>

              {/* Discovery 05: Remediation Proposed */}
              <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>05 / Remediation Proposal</span>
                  <span className="text-slate-400 text-[11px] font-normal">{investigation.ticket ? 'Persisted' : 'Ready'}</span>
                </div>
                {investigation.ticket ? (
                  <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span>Ticket: {investigation.ticket.id}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px]">
                        {investigation.ticket.priority}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {investigation.ticket.title}
                    </div>
                    <p className="text-xs text-slate-600">
                      {investigation.ticket.description}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                      Risk assessment completed. A remediation ticket can be dispatched directly to FalkorDB for tracking.
                    </p>
                    {onCreateTicketForVuln && investigation.vulnerabilities_found[0] && (
                      <button
                        onClick={() =>
                          onCreateTicketForVuln(
                            investigation.target_entity || '',
                            investigation.vulnerabilities_found[0].id
                          )
                        }
                        className="btn-modern-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
                      >
                        <span>Dispatch ticket to FalkorDB</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Collapsible Tool Call Trace */}
              {investigation.tool_call_history.length > 0 && (
                <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs">
                  <button
                    onClick={() => setShowToolHistory(!showToolHistory)}
                    className="w-full p-4 flex items-center justify-between text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <span>Agent MCP Tool Trace ({investigation.tool_call_history.length} Calls)</span>
                    {showToolHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showToolHistory && (
                    <div className="p-4 border-t border-slate-100 divide-y divide-slate-100 text-xs font-mono space-y-3">
                      {investigation.tool_call_history.map((tool, idx) => (
                        <div key={idx} className="pt-3 first:pt-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-600">
                              {idx + 1}. {tool.tool_name}
                            </span>
                            <span className={tool.success ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {tool.success ? 'SUCCESS' : 'FAILED'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Params: {JSON.stringify(tool.arguments)}
                          </div>
                          <div className="text-[11px] text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                            Result: {tool.result_summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Evidence & Risk Score Inspector (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="pb-1 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Calculated Risk Score
                </span>
                <span className="text-[11px] text-slate-400">
                  FalkorDB Formula
                </span>
              </div>

              {/* Risk Engine Breakdown */}
              {investigation.risk_scores.length > 0 && (
                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Priority Level
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                      {investigation.risk_scores[0].priority}
                    </span>
                  </div>

                  <div className="text-4xl sm:text-5xl font-extrabold text-slate-900">
                    {investigation.risk_scores[0].risk_score.toFixed(1)}
                    <span className="text-base font-medium text-slate-400"> / 100</span>
                  </div>

                  {/* Math Breakdown Table */}
                  <div className="pt-3 border-t border-slate-100 text-xs space-y-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Base Severity Score:</span>
                      <span className="font-bold text-slate-800">
                        +{investigation.risk_scores[0].severity_base.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Impact Bonus ({investigation.risk_scores[0].affected_service_count} svcs × 10):
                      </span>
                      <span className="font-bold text-blue-600">
                        +{investigation.risk_scores[0].impact_bonus.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Depth Bonus ({investigation.risk_scores[0].observed_depth} hops × 5):
                      </span>
                      <span className="font-bold text-rose-600">
                        +{investigation.risk_scores[0].depth_bonus.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 pt-2 leading-relaxed">
                    {investigation.risk_scores[0].explanation}
                  </p>
                </div>
              )}

              {/* Recommended Next Steps */}
              {investigation.recommended_next_steps.length > 0 && (
                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recommended Actions
                  </div>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {investigation.recommended_next_steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">→</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
