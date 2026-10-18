import { useMemo, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Server,
  ShieldAlert,
  User,
  Ticket,
  Info,
  ArrowUpRight,
} from 'lucide-react';
import type {
  GraphVisualizationData,
  InvestigationResult,
} from '../types/api';

// ── Custom Node Components (Rounded, Light Aesthetic) ─────────────────────────

function ServiceCustomNode({ data, selected }: NodeProps) {
  const isVulnerable = Boolean(data.hasVulnerability);
  const isImpacted = Boolean(data.isImpacted);
  const isTarget = Boolean(data.isTarget);
  const isDimmed = Boolean(data.isDimmed);

  let borderClass = 'border-slate-200';
  let badgeClass = 'bg-slate-100 text-slate-700';

  if (isTarget) {
    borderClass = 'border-rose-400 ring-2 ring-rose-200';
    badgeClass = 'bg-rose-50 text-rose-700 border border-rose-200';
  } else if (isImpacted) {
    borderClass = 'border-blue-400 ring-2 ring-blue-100';
    badgeClass = 'bg-blue-50 text-blue-700 border border-blue-200';
  } else if (isVulnerable) {
    borderClass = 'border-rose-400';
    badgeClass = 'bg-rose-50 text-rose-700';
  }

  const label = typeof data.label === 'string' ? data.label : String(data.label ?? '');
  const criticality = typeof data.criticality === 'string' ? data.criticality : 'std';
  const environment = typeof data.environment === 'string' ? data.environment : 'prod';

  return (
    <div
      style={{
        opacity: isDimmed ? 0.3 : 1,
        transition: 'all 0.2s ease-in-out',
      }}
      className={`relative min-w-[200px] px-4 py-3 bg-white border ${borderClass} rounded-xl text-left shadow-xs ${
        selected ? 'ring-2 ring-blue-500 shadow-sm' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-slate-400 !border-white" />
      
      <div className="flex items-center justify-between gap-2 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span className="flex items-center gap-1.5 text-slate-700">
          <Server className="w-3.5 h-3.5 text-blue-600" />
          SERVICE
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
          {criticality}
        </span>
      </div>

      <div className="text-xs font-bold text-slate-900 truncate">
        {label}
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
        <span>{environment}</span>
        {isTarget && <span className="text-rose-600 font-bold">● TARGET</span>}
        {isImpacted && !isTarget && <span className="text-blue-600 font-bold">● IMPACTED</span>}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-slate-400 !border-white" />
    </div>
  );
}

function VulnCustomNode({ data, selected }: NodeProps) {
  const isDimmed = Boolean(data.isDimmed);
  const label = typeof data.label === 'string' ? data.label : String(data.label ?? '');
  const severity = typeof data.severity === 'string' ? data.severity : 'CRITICAL';
  const status = typeof data.status === 'string' ? data.status : 'open';

  return (
    <div
      style={{
        opacity: isDimmed ? 0.3 : 1,
        transition: 'all 0.2s ease-in-out',
      }}
      className={`relative min-w-[190px] px-3.5 py-3 bg-rose-50/80 border border-rose-200 rounded-xl text-left shadow-xs ${
        selected ? 'ring-2 ring-rose-500 shadow-sm' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-rose-500 !border-white" />
      
      <div className="flex items-center justify-between text-[10px] uppercase text-rose-700 font-bold mb-1">
        <span className="flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          CVE VECTOR
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-bold">
          {severity}
        </span>
      </div>

      <div className="text-xs font-bold text-slate-900 truncate">
        {label}
      </div>
      
      <div className="mt-1 text-[10px] text-slate-500 truncate">
        Status: {status}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-rose-500 !border-white" />
    </div>
  );
}

function OwnerCustomNode({ data, selected }: NodeProps) {
  const isDimmed = Boolean(data.isDimmed);
  const label = typeof data.label === 'string' ? data.label : String(data.label ?? '');
  const team = typeof data.team === 'string' ? data.team : 'Security Team';

  return (
    <div
      style={{
        opacity: isDimmed ? 0.3 : 1,
        transition: 'all 0.2s ease-in-out',
      }}
      className={`relative min-w-[170px] px-3.5 py-3 bg-purple-50/70 border border-purple-200 rounded-xl text-left shadow-xs ${
        selected ? 'ring-2 ring-purple-500' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-purple-500 !border-white" />
      
      <div className="flex items-center gap-1 text-[10px] uppercase text-purple-700 font-bold mb-1">
        <User className="w-3.5 h-3.5" />
        OWNER / ESCALATION
      </div>

      <div className="text-xs font-bold text-slate-900">
        {label}
      </div>

      <div className="text-[10px] text-slate-500 truncate">
        {team}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-purple-500 !border-white" />
    </div>
  );
}

function TicketCustomNode({ data, selected }: NodeProps) {
  const isDimmed = Boolean(data.isDimmed);
  const label = typeof data.label === 'string' ? data.label : String(data.label ?? '');
  const priority = typeof data.priority === 'string' ? data.priority : 'P1';

  return (
    <div
      style={{
        opacity: isDimmed ? 0.3 : 1,
        transition: 'all 0.2s ease-in-out',
      }}
      className={`relative min-w-[180px] px-3.5 py-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-left shadow-xs ${
        selected ? 'ring-2 ring-emerald-500' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-emerald-500 !border-white" />
      
      <div className="flex items-center justify-between text-[10px] uppercase text-emerald-800 font-bold mb-1">
        <span className="flex items-center gap-1">
          <Ticket className="w-3.5 h-3.5 text-emerald-600" />
          REMEDIATION
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
          {priority}
        </span>
      </div>

      <div className="text-xs font-bold text-slate-900 truncate">
        {label}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-emerald-500 !border-white" />
    </div>
  );
}

const nodeTypes = {
  SERVICE: ServiceCustomNode,
  VULNERABILITY: VulnCustomNode,
  OWNER: OwnerCustomNode,
  REMEDIATION_TICKET: TicketCustomNode,
};

// ── Main Graph Component ──────────────────────────────────────────────────────

interface DependencyGraphProps {
  graphData: GraphVisualizationData | null;
  investigation: InvestigationResult | null;
  onSelectService?: (serviceId: string) => void;
}

export function DependencyGraph({
  graphData,
  investigation,
  onSelectService,
}: DependencyGraphProps) {
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const targetId = investigation?.target_entity || '';
  const impactedIds = useMemo(() => {
    const set = new Set<string>();
    investigation?.impacted_services?.forEach((s) => set.add(s.service_id));
    return set;
  }, [investigation]);

  const connectedNodeIds = useMemo(() => {
    if (!selectedNode || !graphData) return null;
    const connected = new Set<string>([selectedNode.id]);
    graphData.edges.forEach((e) => {
      if (e.source === selectedNode.id) connected.add(e.target);
      if (e.target === selectedNode.id) connected.add(e.source);
    });
    return connected;
  }, [selectedNode, graphData]);

  const nodes: Node[] = useMemo(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return [
        {
          id: 'svc-1',
          type: 'SERVICE',
          position: { x: 260, y: 140 },
          data: { label: 'Payment Service', hasVulnerability: true, isTarget: true, criticality: 'critical', environment: 'production' },
        },
        {
          id: 'vuln-1',
          type: 'VULNERABILITY',
          position: { x: 40, y: 140 },
          data: { label: 'CVE-2024-3094 (SQLi)', severity: 'critical', status: 'open' },
        },
        {
          id: 'svc-2',
          type: 'SERVICE',
          position: { x: 500, y: 60 },
          data: { label: 'Checkout Service', isImpacted: true, criticality: 'high', environment: 'production' },
        },
        {
          id: 'svc-5',
          type: 'SERVICE',
          position: { x: 500, y: 220 },
          data: { label: 'Order Service', isImpacted: true, criticality: 'high', environment: 'production' },
        },
        {
          id: 'owner-1',
          type: 'OWNER',
          position: { x: 260, y: 10 },
          data: { label: 'Alice Kim', team: 'Platform Security' },
        },
      ];
    }

    const typeOffsets: Record<string, { col: number; row: number }> = {
      VULNERABILITY: { col: 0, row: 0 },
      SERVICE: { col: 1, row: 0 },
      OWNER: { col: 2, row: 0 },
      REMEDIATION_TICKET: { col: 3, row: 0 },
    };

    return graphData.nodes
      .filter((n) => filterType === 'all' || n.node_type === filterType)
      .map((n) => {
        const type = n.node_type;
        const offset = typeOffsets[type] || { col: 1, row: 0 };
        const x = 50 + offset.col * 240;
        const y = 50 + offset.row * 100;
        offset.row += 1;

        const isDimmed = connectedNodeIds !== null && !connectedNodeIds.has(n.id);

        return {
          id: n.id,
          type: n.node_type,
          position: { x, y },
          data: {
            ...n.properties,
            label: n.label,
            isTarget: n.id === targetId,
            isImpacted: impactedIds.has(n.id),
            isDimmed,
          },
        };
      });
  }, [graphData, filterType, connectedNodeIds, targetId, impactedIds]);

  const edges: Edge[] = useMemo(() => {
    if (!graphData || !graphData.edges || graphData.edges.length === 0) {
      return [
        {
          id: 'e1',
          source: 'vuln-1',
          target: 'svc-1',
          animated: true,
          style: { stroke: '#F43F5E', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#F43F5E' },
          label: 'HAS_VULNERABILITY',
          labelStyle: { fill: '#E11D48', fontSize: 10, fontWeight: 'bold' },
        },
        {
          id: 'e2',
          source: 'svc-2',
          target: 'svc-1',
          animated: true,
          style: { stroke: '#3B82F6', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' },
          label: 'DEPENDS_ON',
          labelStyle: { fill: '#2563EB', fontSize: 10 },
        },
        {
          id: 'e3',
          source: 'svc-5',
          target: 'svc-1',
          style: { stroke: '#3B82F6', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3B82F6' },
          label: 'DEPENDS_ON',
          labelStyle: { fill: '#2563EB', fontSize: 10 },
        },
        {
          id: 'e4',
          source: 'owner-1',
          target: 'svc-1',
          style: { stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94A3B8' },
          label: 'OWNS',
          labelStyle: { fill: '#64748B', fontSize: 9 },
        },
      ];
    }

    return graphData.edges.map((e, idx) => {
      const isEvidencePath =
        (e.target === targetId || e.source === targetId) ||
        (impactedIds.has(e.source) || impactedIds.has(e.target));

      const isDimmed =
        connectedNodeIds !== null &&
        (!connectedNodeIds.has(e.source) || !connectedNodeIds.has(e.target));

      let strokeColor = '#94A3B8';
      if (e.relationship === 'HAS_VULNERABILITY') strokeColor = '#F43F5E';
      if (e.relationship === 'DEPENDS_ON') strokeColor = '#3B82F6';

      return {
        id: `e-${idx}`,
        source: e.source,
        target: e.target,
        animated: isEvidencePath,
        style: {
          stroke: strokeColor,
          strokeWidth: isEvidencePath ? 2.5 : 1.2,
          opacity: isDimmed ? 0.2 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
        },
        label: e.relationship,
        labelStyle: {
          fill: strokeColor,
          fontSize: 9,
          fontWeight: isEvidencePath ? 600 : 400,
        },
      };
    });
  }, [graphData, targetId, impactedIds, connectedNodeIds]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="space-y-6 text-left py-2">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 block mb-1">
            Section 03 · Graph Explorer
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Connected Infrastructure Canvas
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            FalkorDB nodes and multi-hop relationships. Click any node to isolate its blast radius.
          </p>
        </div>

        {/* Filter Toolbar (Rounded Pills) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          {['all', 'SERVICE', 'VULNERABILITY', 'OWNER', 'REMEDIATION_TICKET'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-lg uppercase text-[11px] font-bold cursor-pointer transition-all ${
                filterType === type
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {type === 'all' ? 'All Nodes' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Canvas & Inspector Split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* React Flow Canvas */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200 rounded-2xl shadow-xs h-[600px] relative overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background color="#94A3B8" gap={20} size={1} className="opacity-15" />
            <Controls className="!bg-white !border !border-slate-200 !shadow-xs !rounded-xl" />
            <MiniMap
              className="!bg-slate-50 !border !border-slate-200 !rounded-xl !shadow-xs"
              nodeColor={(n) => {
                if (n.type === 'VULNERABILITY') return '#F43F5E';
                if (n.type === 'SERVICE') return '#3B82F6';
                if (n.type === 'OWNER') return '#A855F7';
                return '#10B981';
              }}
            />
          </ReactFlow>

          {/* Canvas Bottom Legend */}
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl p-2.5 text-[11px] text-slate-700 font-medium flex flex-wrap items-center gap-4 shadow-xs pointer-events-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              CVE Vulnerability
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Impacted Service
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              Owner Node
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Remediation
            </span>
          </div>
        </div>

        {/* Node Detail Inspector */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-xs p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
            <span className="uppercase font-bold text-slate-500">Node Inspector</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
              {selectedNode ? selectedNode.type : 'SELECT NODE'}
            </span>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Identifier
                </span>
                <h4 className="text-xl font-bold text-slate-900 mt-0.5">
                  {selectedNode.data.label}
                </h4>
                <div className="font-mono text-xs text-slate-500 mt-0.5">
                  ID: {selectedNode.id}
                </div>
              </div>

              {/* Properties list */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                {Object.entries(selectedNode.data)
                  .filter(([k]) => !['label', 'isTarget', 'isImpacted', 'isDimmed'].includes(k))
                  .map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1 border-b border-slate-50">
                      <span className="text-slate-400 uppercase text-[10px]">{key}</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[140px]">
                        {String(value)}
                      </span>
                    </div>
                  ))}
              </div>

              {selectedNode.type === 'SERVICE' && onSelectService && (
                <button
                  onClick={() => onSelectService(selectedNode.id)}
                  className="btn-modern-primary w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer mt-4"
                >
                  <span>Investigate this node</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2 text-slate-400">
              <Info className="w-7 h-7 mx-auto text-slate-300" />
              <p className="text-xs">
                Click any node on the graph canvas to isolate its blast radius and inspect properties.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
