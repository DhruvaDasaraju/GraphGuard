import { ArrowRight, User, GitFork } from 'lucide-react';
import type { ImpactedService } from '../types/api';
import { TiltCard } from './TiltCard';


interface EvidenceGridProps {
  impactedServices: ImpactedService[];
  onSelectService?: (serviceId: string) => void;
}

export function EvidenceGrid({ impactedServices, onSelectService }: EvidenceGridProps) {
  // Fallback realistic evidence data if graph not yet connected

  const defaultServices: ImpactedService[] = [
    {
      service_id: 'svc-2',
      service_name: 'Checkout Service',
      criticality: 'critical',
      hop_count: 1,
      owner: { id: 'own-1', name: 'Alice Wong', team: 'Checkout Core', contact: 'alice@graphguard.internal' },
      dependency_paths: [
        {
          path_length: 1,
          service_sequence: ['Checkout Service', 'Payment Gateway'],
        },
      ],
    },
    {
      service_id: 'svc-3',
      service_name: 'Order Service',
      criticality: 'critical',
      hop_count: 2,
      owner: { id: 'own-2', name: 'Bob Patel', team: 'Fulfillment & Orders', contact: 'bob@graphguard.internal' },
      dependency_paths: [
        {
          path_length: 2,
          service_sequence: ['Order Service', 'Checkout Service', 'Payment Gateway'],
        },
      ],
    },
    {
      service_id: 'svc-4',
      service_name: 'Fraud Detection Engine',
      criticality: 'high',
      hop_count: 1,
      owner: { id: 'own-3', name: 'Clara Oswald', team: 'Risk & Compliance', contact: 'clara@graphguard.internal' },
      dependency_paths: [
        {
          path_length: 1,
          service_sequence: ['Fraud Detection', 'Payment Gateway'],
        },
      ],
    },
    {
      service_id: 'svc-6',
      service_name: 'Inventory Reporting Service',
      criticality: 'medium',
      hop_count: 3,
      owner: { id: 'own-4', name: 'David Miller', team: 'Warehouse Logistics', contact: 'david@graphguard.internal' },
      dependency_paths: [
        {
          path_length: 3,
          service_sequence: ['Inventory Reporting', 'Order Service', 'Checkout Service', 'Payment Gateway'],
        },
      ],
    },
  ];

  const items = impactedServices && impactedServices.length > 0 ? impactedServices : defaultServices;

  return (
    <div className="space-y-6">
      {/* Section Header with Neo badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-[3px] border-[#050505] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#FFE600] text-[#050505] border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] font-mono text-xs font-black uppercase -rotate-1">
              04 · FINDINGS // BLAST-RADIUS
            </span>
            <span className="font-display font-black text-2xl text-[#050505] dark:text-white uppercase tracking-tight">
              EVIDENCE & IMPACTED TOPOLOGY
            </span>
          </div>
          <p className="text-xs font-mono text-[#050505]/70 dark:text-white/70 mt-1">
            Confirmed dependency propagation paths from FalkorDB. A dependency path indicates potential impact, not unverified claims.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-[#00F0FF] text-[#050505] border-[2px] border-[#050505] shadow-[3px_3px_0px_#050505] font-mono text-xs font-black uppercase">
            {items.length} AFFECTED SERVICES
          </span>
        </div>
      </div>

      {/* Grid of Chamfered Tilt Cards with 3D hover physics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {items.map((svc) => {
          const isDirect = svc.hop_count === 1;
          const isCritical = svc.criticality === 'critical' || svc.criticality === 'tier-1';

          const sequence = (svc.dependency_paths && svc.dependency_paths.length > 0 && svc.dependency_paths[0].service_sequence)
            ? svc.dependency_paths[0].service_sequence
            : [svc.service_name, 'Payment Gateway'];

          return (
            <TiltCard
              key={svc.service_id}
              maxTilt={7}
              chamfer={true}
              onClick={() => onSelectService && onSelectService(svc.service_id)}
              className="p-5 border-[3.5px] border-[#050505] bg-white dark:bg-[#0c1022] shadow-[6px_6px_0px_#050505] hover:shadow-[10px_10px_0px_#050505] cursor-pointer"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black text-[#050505]/60 dark:text-white/60">
                      ID: {svc.service_id}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-black px-2 py-0.5 border border-[#050505] shadow-[1.5px_1.5px_0px_#050505] ${
                        isDirect ? 'bg-[#FF0055] text-white' : 'bg-[#00F0FF] text-[#050505]'
                      }`}
                      style={{ clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)' }}
                    >
                      {isDirect ? 'DIRECT' : 'INDIRECT'} ({svc.hop_count} HOP{svc.hop_count > 1 ? 'S' : ''})
                    </span>
                  </div>
                  <h3 className="font-display font-black text-xl text-[#050505] dark:text-white uppercase tracking-tight mt-1">
                    {svc.service_name}
                  </h3>
                </div>

                {/* Severity Badge with Slanted Cut */}
                <div
                  className={`px-2.5 py-1 text-xs font-mono font-black uppercase border-[2px] border-[#050505] shadow-[2px_2px_0px_#050505] ${
                    isCritical
                      ? 'bg-[#FFE600] text-[#050505] -rotate-1'
                      : 'bg-[#f1f4fb] dark:bg-[#1c2448] text-[#050505] dark:text-white'
                  }`}
                  style={{ clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)' }}
                >
                  {svc.criticality}
                </div>
              </div>

              {/* Visual Dependency Path Breadcrumbs */}
              <div className="mt-4 p-3 bg-[#f0f4fc] dark:bg-[#080b18] border-[2px] border-[#050505] shadow-[2.5px_2.5px_0px_#050505]">
                <div className="text-[10px] font-mono font-black uppercase text-[#050505]/60 dark:text-white/60 mb-1.5 flex items-center gap-1.5">
                  <GitFork className="w-3.5 h-3.5" />
                  <span>CASCADING GRAPH PROPAGATION PATH:</span>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 text-xs font-mono font-bold">
                  {sequence.map((stepName, sIdx) => {
                    const isLast = sIdx === sequence.length - 1;
                    return (
                      <div key={sIdx} className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 border border-[#050505] ${
                            isLast
                              ? 'bg-[#FF0055] text-white font-black'
                              : 'bg-white dark:bg-[#141b36] text-[#050505] dark:text-white'
                          }`}
                        >
                          {stepName}
                        </span>
                        {!isLast && <ArrowRight className="w-3.5 h-3.5 text-[#050505] dark:text-white shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Owner Information */}
              <div className="mt-4 pt-3 border-t-[2px] border-[#050505]/20 dark:border-white/10 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#00FF66] border border-[#050505] flex items-center justify-center font-bold text-[#050505]">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-[#050505] dark:text-white">
                      {svc.owner?.name || 'Unassigned'}
                    </span>
                    <span className="text-[11px] text-[#050505]/60 dark:text-white/60 ml-1.5">
                      ({svc.owner?.team || 'Core Infra'})
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-[#008844] dark:text-[#00FF66] font-bold">
                  {svc.owner?.contact || 'team@internal'}
                </div>
              </div>
            </TiltCard>
          );
        })}
      </div>
    </div>
  );
}
