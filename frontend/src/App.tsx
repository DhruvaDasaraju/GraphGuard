import { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, Terminal } from 'lucide-react';

import { ShowroomHeader } from './components/ShowroomHeader';
import { HeroShowroom } from './components/HeroShowroom';
import { TelemetryTraceFeed } from './components/TelemetryTraceFeed';
import { EvidenceGrid } from './components/EvidenceGrid';
import { ActionApprovalPanel } from './components/ActionApprovalPanel';
import { HalftoneFooter } from './components/HalftoneFooter';

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
  const [affectedCount, setAffectedCount] = useState<number>(6);

  // Active Investigation & Scenario State
  const [selectedScenario, setSelectedScenario] = useState<string>('payment');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('svc-1');
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
      setAffectedCount(uniqueServices.size || 6);
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

  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    if (scenarioId === 'payment') {
      setSelectedServiceId('svc-1');
      setPrefilledVulnId('vuln-1');
    } else if (scenarioId === 'auth') {
      setSelectedServiceId('svc-5');
      setPrefilledVulnId('vuln-2');
    } else if (scenarioId === 'checkout') {
      setSelectedServiceId('svc-2');
      setPrefilledVulnId('vuln-1');
    }
  };

  const handleTriggerScenarioInvestigation = (serviceId: string, vulnId?: string) => {
    setSelectedServiceId(serviceId);
    if (vulnId) setPrefilledVulnId(vulnId);
    handleRunInvestigation(
      `Investigate critical blast-radius and transitive dependency impact for ${serviceId}`,
      false
    );
    setActiveTab('investigate');
  };

  return (
    <div className="min-h-screen bg-showroom text-showroom-heading flex flex-col font-mono selection:bg-[#FFE600] selection:text-[#050505] transition-colors">

      {/* ── 1. Sticky Header Navigation ── */}
      <ShowroomHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onQuickInvestigate={() =>
          handleTriggerScenarioInvestigation(selectedServiceId, prefilledVulnId)
        }
        isBackendHealthy={Boolean(health?.falkordb_connected)}
      />

      {/* ── System Notice / Alert Banner if any ── */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full mt-4">
          <div className="p-3.5 bg-[#FF0055] text-white border-[3px] border-[#050505] shadow-[4px_4px_0px_#050505] flex items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>
                <strong className="uppercase">Notice: </strong>
                {error}
              </span>
            </div>
            <button
              onClick={() => setError(null)}
              className="px-2 py-0.5 bg-black text-white hover:bg-white hover:text-black transition-colors font-bold uppercase text-[11px] cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        </div>
      )}

      {/* ── Main Showroom Content Workspace ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-12">
        {/* Tab 1: Neo-Brutalist Technical Street Showroom (Overview) */}
        {activeTab === 'overview' && (
          <div className="space-y-12">
            {/* Hero Section with Asymmetric Headline, 3D Canvas & Scenario Switcher */}
            <HeroShowroom
              onTriggerInvestigation={handleTriggerScenarioInvestigation}
              onExploreGraph={() => setActiveTab('atlas')}
              serviceCount={services.length}
              vulnerabilityCount={vulnerabilities.length}
              affectedCount={affectedCount}
              selectedScenario={selectedScenario}
              onSelectScenario={handleSelectScenario}
            />

            {/* Split Row: Step-by-Step Telemetry Trace + Human-in-the-Loop Approval */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7">
                <TelemetryTraceFeed
                  toolCalls={investigation?.tool_call_history || []}
                  isInvestigating={investigating}
                />
              </div>

              <div className="lg:col-span-5">
                <ActionApprovalPanel
                  investigation={investigation}
                  existingTicket={investigation?.ticket}
                  onCommitTicket={async (details) => {
                    await handleCreateTicket({
                      service_id: details.serviceId,
                      vulnerability_id: details.vulnerabilityId,
                      reason: details.reason,
                      recommended_steps: details.recommendedSteps,
                    });
                  }}
                />
              </div>
            </div>

            {/* Evidence & Cascading Dependency Topology Grid */}
            <EvidenceGrid
              impactedServices={investigation?.impacted_services || []}
              onSelectService={handleSelectServiceForInvestigation}
            />

            {/* Full Telemetry Overview Stats & Metrics */}
            <div className="border-[3.5px] border-[#050505] bg-white dark:bg-[#0c1022] shadow-[8px_8px_0px_#050505] p-6">
              <div className="border-b-[2.5px] border-[#050505] pb-3 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-[#FFE600]" />
                  <span className="font-display font-black text-lg text-[#050505] dark:text-white uppercase tracking-tight">
                    FALKORDB KNOWLEDGE BASE // RAW TOPOLOGY INVENTORY
                  </span>
                </div>
                <button
                  onClick={loadSystemData}
                  className="px-3 py-1 bg-[#f0f4fc] dark:bg-[#141935] border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] hover:bg-[#FFE600] hover:text-[#050505] text-xs font-mono font-bold uppercase transition-colors"
                >
                  REFRESH METRICS
                </button>
              </div>

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
            </div>
          </div>
        )}

        {/* Tab 2: Architecture Graph Atlas */}
        {activeTab === 'atlas' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b-[3.5px] border-[#050505] pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-[#00F0FF] text-[#050505] border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] font-mono text-xs font-black uppercase -rotate-1 inline-block">
                  02 · ARCHITECTURE // MAP
                </span>
                <h2 className="font-display font-black text-3xl text-[#050505] dark:text-white uppercase tracking-tight mt-1">
                  INTERACTIVE FALKORDB TOPOLOGY ATLAS
                </h2>
              </div>
            </div>

            <div className="border-[3.5px] border-[#050505] shadow-[8px_8px_0px_#050505] bg-white dark:bg-[#0c1022]">
              <DependencyGraph
                graphData={graphData}
                investigation={investigation}
                onSelectService={handleSelectServiceForInvestigation}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Autonomous Investigation Lab */}
        {activeTab === 'investigate' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b-[3.5px] border-[#050505] pb-3">
              <div>
                <span className="px-2.5 py-0.5 bg-[#FF0055] text-white border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] font-mono text-xs font-black uppercase -rotate-1 inline-block">
                  03 · INVESTIGATION // AGENT
                </span>
                <h2 className="font-display font-black text-3xl text-[#050505] dark:text-white uppercase tracking-tight mt-1">
                  AUTONOMOUS MCP TRIAGE LAB
                </h2>
              </div>
            </div>

            <InvestigationWorkspace
              services={services}
              selectedServiceId={selectedServiceId}
              onSelectService={setSelectedServiceId}
              onRunInvestigation={handleRunInvestigation}
              investigation={investigation}
              loading={investigating}
              onCreateTicketForVuln={handlePrepareTicket}
            />

            <TelemetryTraceFeed
              toolCalls={investigation?.tool_call_history || []}
              isInvestigating={investigating}
            />
          </div>
        )}

        {/* Tab 4: Findings & Scoring Dossier */}
        {activeTab === 'findings' && (
          <div className="space-y-8">
            <FindingsStory
              riskScores={investigation?.risk_scores || []}
              vulnerabilities={vulnerabilities}
              owners={investigation?.owner_info || []}
              targetServiceId={investigation?.target_entity || selectedServiceId}
              onCreateTicket={handlePrepareTicket}
            />

            <EvidenceGrid
              impactedServices={investigation?.impacted_services || []}
              onSelectService={handleSelectServiceForInvestigation}
            />
          </div>
        )}

        {/* Tab 5: Remediation Tickets Board */}
        {activeTab === 'tickets' && (
          <div className="space-y-8">
            <ActionApprovalPanel
              investigation={investigation}
              existingTicket={investigation?.ticket}
              onCommitTicket={async (details) => {
                await handleCreateTicket({
                  service_id: details.serviceId,
                  vulnerability_id: details.vulnerabilityId,
                  reason: details.reason,
                  recommended_steps: details.recommendedSteps,
                });
              }}
            />

            <RemediationBoard
              tickets={tickets}
              services={services}
              vulnerabilities={vulnerabilities}
              initialServiceId={selectedServiceId}
              initialVulnId={prefilledVulnId}
              onCreateTicket={handleCreateTicket}
              loading={loading}
            />
          </div>
        )}
      </main>

      {/* ── 6. Interactive Halftone Canvas Footer ── */}
      <HalftoneFooter />
    </div>
  );
}

export default App;
