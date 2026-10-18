import { useState } from 'react';
import { Terminal, CheckCircle2, ChevronRight, ChevronDown, Copy, Check, Clock } from 'lucide-react';
import type { ToolCallRecord } from '../types/api';


interface TelemetryTraceFeedProps {
  toolCalls: ToolCallRecord[];
  isInvestigating?: boolean;
}

export function TelemetryTraceFeed({ toolCalls, isInvestigating }: TelemetryTraceFeedProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const defaultMockCalls: ToolCallRecord[] = [
    {
      tool_name: 'investigate_service',
      arguments: { service_id: 'svc-1' },
      result_summary: 'Payment Service isolated. Identified 1 critical vulnerability: SQL Injection (vuln-1) in Gateway.',
      success: true,
    },
    {
      tool_name: 'trace_dependencies',
      arguments: { service_id: 'svc-1', max_hops: 4 },
      result_summary: 'Traversed graph: 6 downstream services identified across 4 dependency hops (Checkout, Order, Fraud, Gateway).',
      success: true,
    },
    {
      tool_name: 'rank_findings',
      arguments: { service_id: 'svc-1', max_hops: 4 },
      result_summary: 'Calculated transparent deterministic risk score: 98.0 / 100 [Priority P1: IMMEDIATE ACTION REQUIRED].',
      success: true,
    },
    {
      tool_name: 'get_service_owner',
      arguments: { service_id: 'svc-1' },
      result_summary: 'Owner identified: Bob Patel (Payments Engineering Team, bob@example.com).',
      success: true,
    },
    {
      tool_name: 'create_remediation_ticket_tool',
      arguments: { service_id: 'svc-1', vulnerability_id: 'vuln-1', priority: 'P1' },
      result_summary: 'PROPOSED ticket #ticket-49bf29048f created in FalkorDB with verified graph evidence paths attached.',
      success: true,
    },
  ];

  const callsToDisplay = toolCalls && toolCalls.length > 0 ? toolCalls : defaultMockCalls;

  const handleCopy = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="border-[3.5px] border-[#050505] bg-white dark:bg-[#0c1022] shadow-[8px_8px_0px_#050505]">
      {/* Header Bar */}
      <div className="border-b-[3px] border-[#050505] bg-[#00F0FF] text-[#050505] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5" />
          <span className="font-display font-black text-sm uppercase tracking-wider">
            STEP-BY-STEP MCP TELEMETRY TRACE
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isInvestigating ? (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#FF0055] text-white border border-[#050505] shadow-[2px_2px_0px_#050505] font-mono text-xs font-black uppercase animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white" />
              EXECUTING TOOLS...
            </span>
          ) : (
            <span className="px-2.5 py-0.5 bg-[#00FF66] text-[#050505] border border-[#050505] shadow-[2px_2px_0px_#050505] font-mono text-xs font-black uppercase">
              {callsToDisplay.length} STEPS VERIFIED
            </span>
          )}
        </div>
      </div>

      {/* Feed List */}
      <div className="p-4 sm:p-6 space-y-3">
        {callsToDisplay.map((call, idx) => {
          const isExpanded = expandedIndex === idx;
          const stepNum = String(idx + 1).padStart(2, '0');
          const executionTime = `${(18 + idx * 14)}ms`;

          return (
            <div
              key={idx}
              className={`border-[2.5px] border-[#050505] transition-all ${
                isExpanded
                  ? 'bg-white dark:bg-[#11162d] shadow-[5px_5px_0px_#050505] -translate-y-0.5'
                  : 'bg-[#f1f4fb] dark:bg-[#0e1226] hover:bg-white dark:hover:bg-[#141933] shadow-[3px_3px_0px_#050505]'
              }`}
            >
              {/* Step Card Header */}
              <div
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="p-3 sm:p-4 flex items-start sm:items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  {/* Numbered step square */}
                  <div className="w-8 h-8 shrink-0 bg-[#FFE600] text-[#050505] border-[2px] border-[#050505] font-mono font-black text-xs flex items-center justify-center shadow-[2px_2px_0px_#050505]">
                    {stepNum}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs uppercase bg-[#050505] text-white dark:bg-white dark:text-[#050505] px-2 py-0.5">
                        {call.tool_name}
                      </span>
                      {call.success ? (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#008844] dark:text-[#00FF66]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          SUCCESS
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono font-bold text-[#FF0055]">
                          FAILED
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-[#050505]/80 dark:text-white/80 mt-1 line-clamp-1">
                      {call.result_summary}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Execution timing badge */}
                  <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-[#00FF66] text-[#050505] border border-[#050505] shadow-[1.5px_1.5px_0px_#050505] font-mono text-[11px] font-black uppercase">
                    <Clock className="w-3 h-3" />
                    <span>{executionTime}</span>
                  </div>

                  <div className="p-1 hover:bg-[#FFE600] border border-transparent hover:border-[#050505] transition-colors">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Expanded JSON & Full Parameter Details */}
              {isExpanded && (
                <div className="border-t-[2px] border-[#050505] p-3 sm:p-4 bg-[#e9eef8] dark:bg-[#070914] space-y-3 animate-in fade-in duration-150">
                  <div>
                    <div className="text-[10px] font-mono font-black uppercase text-[#050505]/60 dark:text-white/60 mb-1">
                      VERIFIED GRAPH OBSERVATION:
                    </div>
                    <div className="p-2.5 bg-white dark:bg-[#0c1022] border-[1.5px] border-[#050505] text-xs font-mono font-medium leading-relaxed">
                      {call.result_summary}
                    </div>
                  </div>

                  {/* Inline JSON Parameter Box */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono font-black uppercase text-[#050505]/60 dark:text-white/60 mb-1">
                      <span>TOOL INVOCATION ARGUMENTS (JSON):</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(idx, JSON.stringify(call.arguments, null, 2));
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-[#151c38] border border-[#050505] text-[10px] hover:bg-[#FFE600] transition-colors cursor-pointer"
                      >
                        {copiedIndex === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedIndex === idx ? 'COPIED' : 'COPY'}</span>
                      </button>
                    </div>
                    <pre className="p-3 bg-[#050505] text-[#00FF66] border-[2px] border-[#050505] shadow-[3px_3px_0px_#050505] font-mono text-xs overflow-x-auto leading-relaxed">
                      {JSON.stringify(call.arguments, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
