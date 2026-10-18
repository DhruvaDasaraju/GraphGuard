import { Zap, Network, ArrowRight, Activity, Terminal } from 'lucide-react';
import { Showroom3DCanvas } from './Showroom3DCanvas';


interface HeroShowroomProps {
  onTriggerInvestigation: (serviceId: string, vulnId?: string) => void;
  onExploreGraph: () => void;
  serviceCount: number;
  vulnerabilityCount: number;
  affectedCount: number;
  selectedScenario: string;
  onSelectScenario: (scenario: string) => void;
}

export function HeroShowroom({
  onTriggerInvestigation,
  onExploreGraph,
  serviceCount,
  vulnerabilityCount,
  affectedCount,
  selectedScenario,
  onSelectScenario,
}: HeroShowroomProps) {
  const scenarios = [
    {
      id: 'payment',
      title: '01 // PAYMENT GATEWAY (SQLi)',
      serviceId: 'svc-1',
      vulnId: 'vuln-1',
      severity: 'CRITICAL P1',
      tag: 'DIRECT FINANCIAL IMPACT',
      color: 'bg-[#FF0055] text-white',
    },
    {
      id: 'auth',
      title: '02 // USER AUTH (JWT BYPASS)',
      serviceId: 'svc-5',
      vulnId: 'vuln-2',
      severity: 'HIGH P2',
      tag: 'LATERAL PRIVILEGE ESCALATION',
      color: 'bg-[#FFE600] text-[#050505]',
    },
    {
      id: 'checkout',
      title: '03 // CHECKOUT (TRANSITIVE CHAIN)',
      serviceId: 'svc-2',
      vulnId: 'vuln-1',
      severity: 'HIGH P2',
      tag: 'MULTI-HOP BLAST-RADIUS',
      color: 'bg-[#00F0FF] text-[#050505]',
    },
  ];

  const currentScenario = scenarios.find((s) => s.id === selectedScenario) || scenarios[0];

  return (
    <section className="relative pt-6 pb-12 overflow-hidden">
      {/* Top Street-Art Banner Tag */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="px-3 py-1 bg-[#FFE600] text-[#050505] border-[2px] border-[#050505] shadow-[2.5px_2.5px_0px_#050505] font-mono font-black text-xs uppercase tracking-widest -rotate-1">
          // CYBER-NEO SHOWROOM · v2.4
        </span>
        <span className="px-3 py-1 bg-white dark:bg-[#0c1022] text-[#050505] dark:text-white border-[2px] border-[#050505] shadow-[2.5px_2.5px_0px_#050505] font-mono text-xs font-bold uppercase tracking-wider">
          AUTONOMOUS GRAPH-NATIVE TRIAGE
        </span>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-[#00FF66] text-[#050505] border-[2px] border-[#050505] shadow-[2.5px_2.5px_0px_#050505] font-mono text-xs font-black uppercase rotate-0.5">
          <Activity className="w-3.5 h-3.5" />
          ZERO HALLUCINATION VERIFIED
        </span>
      </div>

      {/* Asymmetric Hero Headline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-5">
          <h1 className="text-[clamp(2.4rem,5.5vw,4.8rem)] font-black tracking-tighter uppercase leading-[0.92] text-showroom-heading">
            MICROSERVICE{' '}
            <span className="inline-block bg-[#00F0FF] text-[#050505] px-3 py-0.5 border-[3px] border-[#050505] shadow-[5px_5px_0px_#050505] -rotate-1">
              BLAST-RADIUS
            </span>{' '}
            INTELLIGENCE{' '}
            <span className="text-[#FF0055] drop-shadow-[4px_4px_0px_#050505] dark:drop-shadow-[4px_4px_0px_#000000]">
              SHOWROOM.
            </span>
          </h1>

          <p className="text-sm sm:text-base font-mono text-showroom-body leading-relaxed max-w-2xl">
            Detect hidden attack paths and cascading multi-hop vulnerabilities across connected topologies.
            Combines deterministic graph analysis in FalkorDB with autonomous OpenAI Responses verification.
          </p>

          {/* Quick Telemetry Callout Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 bg-white dark:bg-[#0c1022] border-[2.5px] border-[#050505] shadow-[3.5px_3.5px_0px_#050505]">
              <div className="text-[10px] font-mono font-bold uppercase text-[#050505]/60 dark:text-white/60">
                ACTIVE SERVICES
              </div>
              <div className="font-display font-black text-2xl sm:text-3xl text-[#050505] dark:text-white mt-0.5">
                {serviceCount || 10}
              </div>
              <div className="text-[10px] font-mono text-[#008844] dark:text-[#00FF66] font-bold">
                ✓ ALL MONITORED
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-[#0c1022] border-[2.5px] border-[#050505] shadow-[3.5px_3.5px_0px_#050505]">
              <div className="text-[10px] font-mono font-bold uppercase text-[#050505]/60 dark:text-white/60">
                DETECTED VULNS
              </div>
              <div className="font-display font-black text-2xl sm:text-3xl text-[#FF0055] mt-0.5">
                {vulnerabilityCount || 5}
              </div>
              <div className="text-[10px] font-mono text-[#FF0055] font-bold">
                ⚠ 2 CRITICAL P1
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-[#0c1022] border-[2.5px] border-[#050505] shadow-[3.5px_3.5px_0px_#050505]">
              <div className="text-[10px] font-mono font-bold uppercase text-[#050505]/60 dark:text-white/60">
                MAX BLAST DEPTH
              </div>
              <div className="font-display font-black text-2xl sm:text-3xl text-[#00F0FF] dark:text-[#00F0FF] mt-0.5">
                4 HOPS
              </div>
              <div className="text-[10px] font-mono text-[#050505]/70 dark:text-white/70 font-bold">
                TRANSITIVE PATHS
              </div>
            </div>

            <div className="p-3 bg-[#FFE600] text-[#050505] border-[2.5px] border-[#050505] shadow-[3.5px_3.5px_0px_#050505]">
              <div className="text-[10px] font-mono font-bold uppercase text-[#050505]/80">
                REACHABLE SVCS
              </div>
              <div className="font-display font-black text-2xl sm:text-3xl mt-0.5">
                {affectedCount || 6}
              </div>
              <div className="text-[10px] font-mono font-bold">
                60% SYSTEM AT RISK
              </div>
            </div>
          </div>

          {/* Action CTA Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onTriggerInvestigation(currentScenario.serviceId, currentScenario.vulnId)}
              className="flex items-center gap-2 px-6 py-3.5 bg-[#FF0055] text-white border-[3px] border-[#050505] shadow-[6px_6px_0px_#050505] hover:shadow-[8px_8px_0px_#050505] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-mono font-black text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>LAUNCH AGENT TRIAGE</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreGraph}
              className="flex items-center gap-2 px-5 py-3.5 bg-white dark:bg-[#10152d] text-[#050505] dark:text-white border-[3px] border-[#050505] shadow-[6px_6px_0px_#050505] hover:bg-[#FFE600] hover:text-[#050505] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-mono font-black text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer"
            >
              <Network className="w-4 h-4" />
              <span>EXPLORE FULL GRAPH</span>
            </button>
          </div>
        </div>

        {/* Right: Interactive 3D Showroom Viewport */}
        <div className="lg:col-span-5 w-full">
          <Showroom3DCanvas onSelectNode={(id) => onTriggerInvestigation(id)} />
        </div>
      </div>

      {/* Interactive Scenario Switcher Bar */}
      <div className="mt-8 border-[3px] border-[#050505] bg-white dark:bg-[#0c1022] shadow-[6px_6px_0px_#050505] p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2 px-1">
          <div className="flex items-center gap-2 text-xs font-mono font-black uppercase text-[#050505] dark:text-white">
            <Terminal className="w-4 h-4 text-[#FF0055]" />
            <span>INTERACTIVE ATTACK SIMULATION SCENARIOS:</span>
          </div>
          <span className="text-[11px] font-mono text-[#050505]/60 dark:text-white/60">
            CLICK TO PRIME TARGET FOR AUTONOMOUS INVESTIGATION
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {scenarios.map((sc) => {
            const isSelected = selectedScenario === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => onSelectScenario(sc.id)}
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                }}
                className={`text-left p-3.5 border-[2.5px] border-[#050505] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#FFE600] text-[#050505] shadow-[5px_5px_0px_#050505] -translate-y-0.5'
                    : 'bg-[#f1f4fb] dark:bg-[#121730] text-[#050505] dark:text-white hover:bg-white dark:hover:bg-[#171e3d] shadow-[3px_3px_0px_#050505]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className={`text-[10px] font-mono font-black px-1.5 py-0.5 border border-[#050505] ${sc.color}`}
                    style={{ clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)' }}
                  >
                    {sc.severity}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#050505]/70 dark:text-white/70">
                    {sc.tag}
                  </span>
                </div>
                <div className="font-display font-black text-sm uppercase leading-tight">
                  {sc.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
