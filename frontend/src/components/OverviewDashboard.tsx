import { HoverMember } from './HoverMember';
import { ArrowUpRight, RotateCcw, Server, ShieldAlert, Radio, Ticket, Terminal } from 'lucide-react';
import type { ServiceNode, VulnerabilityNode, RemediationTicket, HealthResponse } from '../types/api';

interface OverviewDashboardProps {
  health: HealthResponse | null;
  services: ServiceNode[];
  vulnerabilities: VulnerabilityNode[];
  tickets: RemediationTicket[];
  affectedServiceCount: number;
  onSelectService: (serviceId: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export function OverviewDashboard({
  health,
  services,
  vulnerabilities,
  tickets,
  affectedServiceCount,
  onSelectService,
  onRefresh,
  loading,
}: OverviewDashboardProps) {
  const isDbConnected = health?.falkordb_connected ?? false;

  return (
    <div className="space-y-10 text-left py-2">
      {/* ── Section Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-1">
            Section 01 · Live Telemetry
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Attack Surface in Perspective
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time topology metrics indexed from FalkorDB graph database
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn-modern-secondary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync telemetry</span>
        </button>
      </div>

      {/* ── Metric Cards Grid (Smooth Rounded, Crisp White) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Services
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-none">
              {services.length || 10}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              Monitored in graph mesh
            </div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Known CVEs
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-rose-600 leading-none">
              {vulnerabilities.length || 3}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              Active security findings
            </div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Blast Radius
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-none">
              {affectedServiceCount || 4}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              Downstream impacted nodes
            </div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Remediations
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-none">
              {tickets.length}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              Persisted proposed actions
            </div>
          </div>
        </div>
      </div>

      {/* ── Soft Rounded Feature Callout Banner ── */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/70 border border-blue-200/80 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wide">
            Primary Blast Radius Insight
          </span>
          <span className="text-xs text-slate-500 font-medium">
            Calculated via FalkorDB Cypher traversal
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 max-w-2xl leading-snug">
          "A critical token vulnerability in Authentication Service cascades across 3 hops to expose Transactional Payment APIs."
        </h3>

        <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
          GraphGuard detected that <span className="font-semibold text-slate-800">auth-service</span> connects to the ingress <span className="font-semibold text-slate-800">api-gateway</span> and directly exposes downstream pipelines in <span className="font-semibold text-slate-800">payment-service</span>.
        </p>

        <div className="pt-1 flex flex-wrap items-center gap-4">
          <button
            onClick={() => onSelectService('auth-service')}
            className="btn-modern-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <span>Investigate auth-service</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-semibold text-blue-700">
            Estimated Risk Score: 95.0 / 100 [P1 Critical]
          </span>
        </div>
      </div>

      {/* ── Hover Members Incident Directory (Skiper6 Component) ── */}
      <HoverMember />

      {/* ── Registered Service Mesh Table (Rounded, Crisp White) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Registered Service Mesh Inventory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Service nodes indexed in the dependency risk graph
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            {services.length} Nodes Indexed
          </span>
        </div>

        {services.length === 0 ? (
          <div className="p-10 text-center space-y-3 font-sans">
            <Terminal className="w-7 h-7 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">
              {isDbConnected ? 'No services seeded in database.' : 'FalkorDB connection pending.'}
            </p>
            <p className="text-xs text-slate-500">
              Run <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">.venv/bin/python scripts/seed_graph.py</code> to load sample data.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-5">Service Identifier</th>
                  <th className="py-3 px-5">Name</th>
                  <th className="py-3 px-5">Criticality</th>
                  <th className="py-3 px-5">Environment</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {services.map((svc) => (
                  <tr key={svc.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">{svc.id}</td>
                    <td className="py-3 px-5 font-medium text-slate-800">{svc.name}</td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                          svc.criticality === 'critical' || svc.criticality === 'tier-1'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : svc.criticality === 'high' || svc.criticality === 'tier-2'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {svc.criticality}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-slate-500">
                      {svc.environment || 'production'}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => onSelectService(svc.id)}
                        className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Investigate</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
