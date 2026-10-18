export interface HealthResponse {
  status: string;
  falkordb_connected: boolean;
  falkordb_host: string;
  falkordb_port: number;
  graph_name: string;
  llm_enabled: boolean;
  demo_mode: boolean;
}

export interface ServiceNode {
  id: string;
  name: string;
  criticality: 'tier-1' | 'tier-2' | 'tier-3' | string;
  environment?: string;
  description?: string;
}

export interface VulnerabilityNode {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | string;
  cve?: string;
  description?: string;
  affected_service_ids?: string[];
}

export interface OwnerNode {
  id: string;
  name: string;
  team: string;
  contact: string;
}

export interface DependencyPath {
  path_length: number;
  service_sequence: string[];
}

export interface ImpactedService {
  service_id: string;
  service_name: string;
  criticality: string;
  hop_count: number;
  owner?: OwnerNode;
  dependency_paths: DependencyPath[];
}

export interface RiskScore {
  vulnerability_id: string;
  vulnerability_title: string;
  severity: string;
  severity_base: number;
  impact_bonus: number;
  depth_bonus: number;
  risk_score: number;
  priority: 'P1' | 'P2' | 'P3' | 'P4' | string;
  affected_service_count: number;
  observed_depth: number;
  explanation: string;
}

export interface ToolCallRecord {
  tool_name: string;
  arguments: Record<string, unknown>;
  result_summary: string;
  success: boolean;
  error?: string;
}

export interface RemediationTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  target_service_id: string;
  vulnerability_id: string;
  risk_score: number;
  evidence_json?: string;
  created_at: string;
}

export interface InvestigationResult {
  investigation_id: string;
  mode: 'autonomous_llm' | 'deterministic_demo' | string;
  question: string;
  target_entity?: string;
  target_entity_type?: string;
  vulnerabilities_found: VulnerabilityNode[];
  impacted_services: ImpactedService[];
  risk_scores: RiskScore[];
  owner_info: OwnerNode[];
  ticket?: RemediationTicket;
  tool_call_history: ToolCallRecord[];
  recommended_next_steps: string[];
  limitations: string[];
  error?: string;
  llm_summary?: string;
}

export interface GraphVisualizationNode {
  id: string;
  label: string;
  node_type: 'SERVICE' | 'VULNERABILITY' | 'OWNER' | 'REMEDIATION_TICKET' | string;
  properties: Record<string, unknown>;
}

export interface GraphVisualizationEdge {
  source: string;
  target: string;
  relationship: 'DEPENDS_ON' | 'AFFECTS' | 'OWNED_BY' | 'TARGETS' | string;
}

export interface GraphVisualizationData {
  nodes: GraphVisualizationNode[];
  edges: GraphVisualizationEdge[];
  node_count: number;
  edge_count: number;
}
