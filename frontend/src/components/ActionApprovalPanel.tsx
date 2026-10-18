import { useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckSquare, Square, Check, ArrowRight, Sparkles, Lock, AlertOctagon } from 'lucide-react';
import type { RemediationTicket, InvestigationResult } from '../types/api';
import { TiltCard } from './TiltCard';


interface ActionApprovalPanelProps {
  investigation: InvestigationResult | null;
  onCommitTicket: (ticketDetails: {
    serviceId: string;
    vulnerabilityId: string;
    reason: string;
    recommendedSteps: string[];
  }) => Promise<void>;
  existingTicket?: RemediationTicket | null;
}

export function ActionApprovalPanel({
  investigation,
  onCommitTicket,
}: ActionApprovalPanelProps) {

  const [selectedActions, setSelectedActions] = useState<string[]>([
    'action-1',
    'action-2',
  ]);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [committed, setCommitted] = useState<boolean>(false);

  const defaultActions = [
    {
      id: 'action-1',
      title: 'HOTPATCH SQL SANITIZER ON PAYMENT GATEWAY',
      description: 'Apply prepared statement parameterization to order payment controller v1.4.1.',
      priority: 'P1 CRITICAL',
      effort: '15m deploy',
    },
    {
      id: 'action-2',
      title: 'ISOLATE TRANSITIVE INVENTORY QUEUE CONSUMERS',
      description: 'Enable circuit breaker on Checkout & Order dispatch queues to prevent cascading poison messages.',
      priority: 'P2 HIGH',
      effort: 'immediate',
    },
    {
      id: 'action-3',
      title: 'NOTIFY TEAM LEADS & SECURITY OPERATIONS',
      description: 'Alert Bob Patel (Payments Core) and Clara Oswald (Risk & Compliance) with FalkorDB blast-radius snapshot.',
      priority: 'P2 HIGH',
      effort: 'automated',
    },
    {
      id: 'action-4',
      title: 'POST-PATCH MULTI-HOP REGRESSION AUDIT',
      description: 'Run automated MCP trace_dependencies query to confirm 0 reachable unmitigated nodes.',
      priority: 'P3 MEDIUM',
      effort: '1h post-deploy',
    },
  ];

  const toggleAction = (id: string) => {
    setSelectedActions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApproveAndCommit = async () => {
    setIsCommitting(true);
    try {
      const targetServiceId = investigation?.target_entity || 'svc-1';
      const topVuln = investigation?.vulnerabilities_found?.[0]?.id || 'vuln-1';

      await onCommitTicket({
        serviceId: targetServiceId,
        vulnerabilityId: topVuln,
        reason: `Executive triage approved via Neo-Brutalist Showroom. Action items committed: ${selectedActions.join(', ')}`,
        recommendedSteps: selectedActions.map((id) => {
          const act = defaultActions.find((a) => a.id === id);
          return act ? act.title : id;
        }),
      });

      setCommitted(true);

      // Trigger Confetti Celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00F0FF', '#FFE600', '#FF0055', '#00FF66'],
      });
    } catch (err) {
      console.error('Commit failed:', err);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Brief Card with Bold Neon Callout Banner */}
      <div className="border-[3.5px] border-[#050505] bg-white dark:bg-[#0c1022] shadow-[8px_8px_0px_#050505] overflow-hidden">
        {/* Neon Callout Banner */}
        <div className="bg-[#FFE600] text-[#050505] border-b-[3px] border-[#050505] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-[#FF0055]" />
            <span className="font-display font-black text-sm uppercase tracking-wider">
              HUMAN-IN-THE-LOOP EXECUTIVE TRIAGE & APPROVAL
            </span>
          </div>
          <span className="px-2.5 py-0.5 bg-[#050505] text-[#FFE600] font-mono text-xs font-black uppercase">
            STATUS: AWAITING COMMIT
          </span>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] font-mono font-black text-[#050505]/60 dark:text-white/60 uppercase">
                AUTOMATED LLM SYNTHESIS & IMPACT SUMMARY
              </div>
              <h2 className="font-display font-black text-2xl text-[#050505] dark:text-white uppercase tracking-tight mt-0.5">
                PAYMENT GATEWAY CASCADING EXPOSURE
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#FF0055] text-white border-[2px] border-[#050505] shadow-[2.5px_2.5px_0px_#050505] font-mono font-black text-xs uppercase -rotate-1">
                P1 CRITICAL
              </span>
              <span className="px-3 py-1 bg-[#00FF66] text-[#050505] border-[2px] border-[#050505] shadow-[2.5px_2.5px_0px_#050505] font-mono font-black text-xs uppercase rotate-0.5">
                DETERMINISTIC SCORE: 98/100
              </span>
            </div>
          </div>

          <p className="text-xs sm:text-sm font-mono text-[#050505]/80 dark:text-white/80 leading-relaxed bg-[#f0f4fc] dark:bg-[#070914] p-4 border-[2px] border-[#050505]">
            {investigation?.llm_summary ||
              "Investigated Payment Gateway (svc-1). Confirmed open critical SQL Injection (vuln-1). Verified 6 reachable dependent microservices (Checkout, Order, Fraud, API Gateway) across a maximum propagation depth of 4 hops. Human approval required before pushing FalkorDB PROPOSED ticket into production sprint queue."}
          </p>
        </div>
      </div>

      {/* Multi-Select Action Checklist */}
      <div className="border-[3.5px] border-[#050505] bg-white dark:bg-[#0c1022] shadow-[8px_8px_0px_#050505] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b-[2.5px] border-[#050505] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#00F0FF] border border-[#050505]" />
            <span className="font-display font-black text-lg text-[#050505] dark:text-white uppercase tracking-tight">
              PROPOSED MITIGATION ACTIONS ({selectedActions.length}/{defaultActions.length} SELECTED)
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#050505]/60 dark:text-white/60">
            CLICK TO SELECT OR DESELECT
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {defaultActions.map((action) => {
            const isChecked = selectedActions.includes(action.id);
            return (
              <TiltCard
                key={action.id}
                maxTilt={6}
                chamfer={true}
                onClick={() => toggleAction(action.id)}
                className={`p-4 border-[3px] border-[#050505] cursor-pointer transition-colors duration-100 select-none ${
                  isChecked
                    ? 'bg-[#00F0FF] text-[#050505] shadow-[6px_6px_0px_#050505]'
                    : 'bg-[#f1f4fb] dark:bg-[#11162e] text-[#050505] dark:text-white hover:bg-white dark:hover:bg-[#151c3a] shadow-[4px_4px_0px_#050505]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    {isChecked ? (
                      <CheckSquare className="w-5 h-5 text-[#050505] fill-[#FFE600]" />
                    ) : (
                      <Square className="w-5 h-5 text-[#050505] dark:text-white" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-black text-xs sm:text-sm uppercase leading-snug">
                        {action.title}
                      </span>
                    </div>
                    <p className={`text-xs font-mono leading-relaxed ${isChecked ? 'text-[#050505]/90' : 'text-[#050505]/70 dark:text-white/70'}`}>
                      {action.description}
                    </p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] font-mono font-bold">
                      <span
                        className="px-2 py-0.5 bg-[#050505] text-white"
                        style={{ clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)' }}
                      >
                        {action.priority}
                      </span>
                      <span>{action.effort}</span>
                    </div>
                  </div>
                </div>
              </TiltCard>
            );
          })}
        </div>

        {/* Dedicated "APPROVE & COMMIT" Button */}
        <div className="pt-4 border-t-[2.5px] border-[#050505] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-mono text-[#050505]/70 dark:text-white/70">
            {committed ? (
              <span className="flex items-center gap-1.5 text-[#008844] dark:text-[#00FF66] font-bold">
                <Check className="w-4 h-4" />
                REMEDIATION TICKET PERSISTED IN FALKORDB (STATUS: PROPOSED)
              </span>
            ) : (
              <span>Commit will persist a PROPOSED ticket and audit trail without production downtime.</span>
            )}
          </div>

          <button
            onClick={handleApproveAndCommit}
            disabled={isCommitting || selectedActions.length === 0}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 border-[3.5px] border-[#050505] font-mono font-black text-sm uppercase tracking-wider transition-all cursor-pointer ${
              committed
                ? 'bg-[#00FF66] text-[#050505] shadow-[6px_6px_0px_#050505]'
                : 'bg-[#FF0055] text-white shadow-[6px_6px_0px_#050505] hover:shadow-[8px_8px_0px_#050505] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isCommitting ? (
              <span>PERSISTING TO FALKORDB...</span>
            ) : committed ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>COMMITTED SUCCESSFULLY</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>APPROVE & COMMIT ({selectedActions.length} ACTIONS)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
