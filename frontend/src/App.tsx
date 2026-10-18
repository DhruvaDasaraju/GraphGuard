import { useState, useEffect, useCallback } from 'react';
import {
  ExternalLink,
  AlertCircle,
  Shield,
} from 'lucide-react';

import { HeroSection } from './components/HeroSection';
import { OverviewDashboard } from './components/OverviewDashboard';
import { InvestigationWorkspace } from './components/InvestigationWorkspace';
import { DependencyGraph } from './components/DependencyGraph';
import { FindingsStory } from './components/FindingsStory';
import { RemediationBoard } from './components/RemediationBoard';

import {
  fetchHealth,
  fetchServices,
  fetchVulnerabilities,
  fetchTickets,
  fetchGraphData,
  investigateAlert,
  createTicket,
} from './api/client';

import type {
  GraphVisualizationEdge,
  HealthResponse,
  ServiceNode,
  VulnerabilityNode,
  RemediationTicket,
  GraphVisualizationData,
  InvestigationResult,
} from './types/api';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'investigate' | 'atlas' | 'findings' | 'tickets'>('overview');

  // Application Data States
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [services, setServices] = useState<ServiceNode[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityNode[]>([]);
  const [tickets, setTickets] = useState<RemediationTicket[]>([]);
  const [graphData, setGraphData] = useState<GraphVisualizationData | null>(null);
  const [affectedCount, setAffectedCount] = useState<number>(0);

  // Active Investigation State
  const [selectedServiceId, setSelectedServiceId] = useState<string>('payment-service');
  const [prefilledVulnId, setPrefilledVulnId] = useState<string>('vuln-1');
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [investigating, setInvestigating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load all telemetry from backend
  const loadSystemData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [healthRes, svcsRes, vulnsRes, ticketsRes, graphRes] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchServices().catch(() => []),
        fetchVulnerabilities().catch(() => []),
        fetchTickets().catch(() => []),
        fetchGraphData().catch(() => null),
      ]);

      setHealth(healthRes);
      setServices(svcsRes);
      setVulnerabilities(vulnsRes);
      setTickets(ticketsRes);
      setGraphData(graphRes);

      const uniqueServices = new Set<string>();
      if (graphRes && graphRes.edges) {
        graphRes.edges.forEach((edge: GraphVisualizationEdge) => {
          if (edge.relationship === 'DEPENDS_ON') {
            uniqueServices.add(edge.source);
          }
        });
      }
      setAffectedCount(uniqueServices.size || 4);
    } catch (err: any) {
      setError(err.message || 'Error communicating with GraphGuard backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSystemData();
  }, [loadSystemData]);

  // Run security agent investigation
  const handleRunInvestigation = async (question: string, autoCreateTicket: boolean) => {
    try {
      setInvestigating(true);
      setError(null);
      const res = await investigateAlert(question, autoCreateTicket);
      setInvestigation(res);

      if (autoCreateTicket && res.ticket) {
        const refreshedTickets = await fetchTickets();
        setTickets(refreshedTickets);
      }
    } catch (err: any) {
      setError(`Investigation failed: ${err.message}`);
    } finally {
      setInvestigating(false);
    }
  };

  const handleSelectServiceForInvestigation = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setActiveTab('investigate');
  };

  const handlePrepareTicket = (serviceId: string, vulnId: string) => {
    setSelectedServiceId(serviceId);
    setPrefilledVulnId(vulnId);
    setActiveTab('tickets');
  };

  const handleCreateTicket = async (payload: {
    service_id: string;
    vulnerability_id: string;
    reason: string;
    recommended_steps: string[];
  }) => {
    await createTicket(payload);
    const refreshed = await fetchTickets();
    setTickets(refreshed);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* ── Top Modern Navigation Bar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            onClick={() => setActiveTab('overview')}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-700 transition-colors">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight text-slate-900 leading-none">
                GraphGuard
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">
                Connected Security Intelligence
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Clean Rounded Pills) */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 text-xs font-semibold">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'investigate', label: 'Investigate' },
              { id: 'atlas', label: 'Graph Atlas' },
              { id: 'findings', label: 'Findings' },
              { id: 'tickets', label: 'Remediation' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Backend Connection Status & Docs Link */}
          <div className="flex items-center gap-2.5 text-xs">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700">
              <span
                className={`w-2 h-2 rounded-full ${
                  health?.falkordb_connected ? 'bg-emerald-500 animate-pulse' : 'bg-blue-600'
                }`}
              />
              <span className="font-semibold text-[11px]">
                {health?.falkordb_connected ? 'FalkorDB Live' : 'Demo Mode Active'}
              </span>
            </div>

            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="btn-modern-secondary hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-slate-700"
            >
              <span>API Docs</span>
              <ExternalLink className="w-3 h-3 text-blue-600" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Hero Section (Visible in Overview) ── */}
      {activeTab === 'overview' && (
        <HeroSection
          onStartInvestigation={() => setActiveTab('investigate')}
          onExploreAtlas={() => setActiveTab('atlas')}
          serviceCount={services.length}
          vulnCount={vulnerabilities.length}
        />
      )}

      {/* ── System Notice / Error Banner if any ── */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-left text-xs">
            <div className="flex items-start gap-2 text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">System Notice: </span>
                <span>{error}</span>
              </div>
            </div>
            <button
              onClick={() => setError(null)}
              className="font-bold text-rose-700 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Main Application Workspace ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Mobile Navigation Strip */}
        <div className="flex md:hidden overflow-x-auto gap-1.5 pb-4 mb-6 text-xs font-semibold">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'investigate', label: 'Investigate' },
            { id: 'atlas', label: 'Graph' },
            { id: 'findings', label: 'Findings' },
            { id: 'tickets', label: 'Tickets' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg border whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview Dashboard */}
        {activeTab === 'overview' && (
          <OverviewDashboard
            health={health}
            services={services}
            vulnerabilities={vulnerabilities}
            tickets={tickets}
            affectedServiceCount={affectedCount}
            onSelectService={handleSelectServiceForInvestigation}
            onRefresh={loadSystemData}
            loading={loading}
          />
        )}

        {/* Tab 2: Investigation Lab */}
        {activeTab === 'investigate' && (
          <InvestigationWorkspace
            services={services}
            selectedServiceId={selectedServiceId}
            onSelectService={setSelectedServiceId}
            onRunInvestigation={handleRunInvestigation}
            investigation={investigation}
            loading={investigating}
            onCreateTicketForVuln={handlePrepareTicket}
          />
        )}

        {/* Tab 3: Interactive Dependency Atlas */}
        {activeTab === 'atlas' && (
          <DependencyGraph
            graphData={graphData}
            investigation={investigation}
            onSelectService={handleSelectServiceForInvestigation}
          />
        )}

        {/* Tab 4: Findings & Scoring Dossier */}
        {activeTab === 'findings' && (
          <FindingsStory
            riskScores={investigation?.risk_scores || []}
            vulnerabilities={vulnerabilities}
            owners={investigation?.owner_info || []}
            targetServiceId={investigation?.target_entity || selectedServiceId}
            onCreateTicket={handlePrepareTicket}
          />
        )}

        {/* Tab 5: Remediation Tickets Board */}
        {activeTab === 'tickets' && (
          <RemediationBoard
            tickets={tickets}
            services={services}
            vulnerabilities={vulnerabilities}
            initialServiceId={selectedServiceId}
            initialVulnId={prefilledVulnId}
            onCreateTicket={handleCreateTicket}
            loading={loading}
          />
        )}
      </main>

      {/* ── Modern Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-16 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">GraphGuard</span>
            <span>·</span>
            <span>Connected AI Security Intelligence</span>
            <span>·</span>
            <span className="text-slate-400">Track 1 Hackathon Project</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
            <span>FalkorDB Graph</span>
            <span>•</span>
            <span>FastAPI Backend</span>
            <span>•</span>
            <span>MCP Protocol</span>
            <span>•</span>
            <span>React Flow</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
