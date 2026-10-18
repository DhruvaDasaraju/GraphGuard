import { useState } from 'react';
import { ArrowUpRight, Network } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  onStartInvestigation: () => void;
  onExploreAtlas: () => void;
  serviceCount: number;
  vulnCount: number;
}

export function HeroSection({
  onStartInvestigation,
  onExploreAtlas,
  serviceCount,
  vulnCount,
}: HeroSectionProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/50 to-slate-50 border-b border-slate-200/80 pt-10 pb-16 lg:pt-14 lg:pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Subtle pill badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-semibold text-blue-700 mb-6 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span>FalkorDB Graph Reasoning · Autonomous Security Agent</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Bold, clear, modern typography */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Every security threat <br />
              <span className="text-blue-600 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                leaves a connected trail.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 max-w-xl font-normal leading-relaxed">
              Trace multi-hop blast radii, discover unmapped service dependencies, and generate graph-grounded remediation tickets in seconds.
            </p>

            {/* Rounded Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onStartInvestigation}
                className="btn-modern-primary px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md"
              >
                <span>Start an investigation</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                onClick={onExploreAtlas}
                className="btn-modern-secondary px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Network className="w-4 h-4 text-blue-600" />
                <span>Explore graph atlas</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-8 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-800 font-bold text-sm">{serviceCount || 10}</span>
                <span>Active Services</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-slate-800 font-bold text-sm">{vulnCount || 3}</span>
                <span>Known CVE Vectors</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-800 font-bold text-sm">100%</span>
                <span>Deterministic Evidence</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean, modern rounded topology card */}
          <div className="lg:col-span-5 relative">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md shadow-slate-100 relative">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="font-semibold text-xs text-slate-800">Blast Radius Topology</span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  LIVE GRAPH TRACE
                </span>
              </div>

              {/* SVG Topology with smooth rounded cards */}
              <div className="relative h-64 w-full bg-slate-50/70 border border-slate-200/60 rounded-xl overflow-hidden flex items-center justify-center">
                <svg className="w-full h-full" viewBox="0 0 340 240">
                  <defs>
                    <linearGradient id="curveGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#F43F5E" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                    <linearGradient id="curveGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#3B82F6" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>

                  {/* Connection curves */}
                  <motion.path
                    d="M 65 65 C 115 65, 135 120, 180 120"
                    stroke="url(#curveGrad1)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeDasharray="4 3"
                    animate={{ strokeDashoffset: [0, -14] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  />
                  <motion.path
                    d="M 180 120 C 220 120, 235 75, 275 75"
                    stroke="#94A3B8"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <motion.path
                    d="M 180 120 C 210 120, 230 175, 270 175"
                    stroke="url(#curveGrad2)"
                    strokeWidth="2.5"
                    fill="none"
                    strokeDasharray="4 3"
                    animate={{ strokeDashoffset: [0, -14] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  />

                  {/* Node 1: Vulnerability */}
                  <g
                    transform="translate(65, 65)"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNode('cve')}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <circle r="18" fill="#FFF1F2" stroke="#F43F5E" strokeWidth="2" />
                    <text y="4" textAnchor="middle" fill="#E11D48" fontSize="10" fontWeight="bold">CVE</text>
                  </g>

                  {/* Node 2: Core Target Service */}
                  <g
                    transform="translate(180, 120)"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNode('target')}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <rect x="-26" y="-18" width="52" height="36" rx="8" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="2" />
                    <text y="4" textAnchor="middle" fill="#1D4ED8" fontSize="10" fontWeight="bold">CORE</text>
                  </g>

                  {/* Node 3: Dependent Service 1 */}
                  <g
                    transform="translate(275, 75)"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNode('dep1')}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <rect x="-24" y="-16" width="48" height="32" rx="8" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="1.5" />
                    <text y="4" textAnchor="middle" fill="#334155" fontSize="9" fontWeight="600">ORDER</text>
                  </g>

                  {/* Node 4: Dependent Service 2 */}
                  <g
                    transform="translate(270, 175)"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNode('dep2')}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <rect x="-24" y="-16" width="48" height="32" rx="8" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.5" />
                    <text y="4" textAnchor="middle" fill="#047857" fontSize="9" fontWeight="600">NOTIF</text>
                  </g>
                </svg>

                {/* Interactive Tooltip Card at Bottom */}
                <div className="absolute bottom-2.5 left-2.5 right-2.5 p-2 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg text-xs font-medium text-slate-700 flex justify-between items-center shadow-xs">
                  <span>
                    {hoveredNode === 'cve' && '⚠️ Target CVE: SQL Injection [Critical 95.0]'}
                    {hoveredNode === 'target' && '🎯 payment-service (Core Transaction Pipeline)'}
                    {hoveredNode === 'dep1' && '📦 order-service (Direct Downstream Dependent)'}
                    {hoveredNode === 'dep2' && '🔔 notification-svc (Indirect Downstream)'}
                    {!hoveredNode && 'Hover over nodes to inspect relationship details'}
                  </span>
                  <span className="font-mono text-[10px] text-blue-600 font-bold">CYPHER</span>
                </div>
              </div>

              {/* Bottom detail pill */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Multi-hop Traversal Depth: <strong>3 hops</strong></span>
                <span className="text-blue-600 font-semibold">Graph Evidence Grounded</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
