import type {
  HealthResponse,
  ServiceNode,
  VulnerabilityNode,
  GraphVisualizationData,
  InvestigationResult,
  RemediationTicket,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  status: number;
  detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000); // 35s timeout for agent workflows

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = 'Request failed';
      try {
        const errorJson = await response.json();
        detail = errorJson.detail || errorJson.error || JSON.stringify(errorJson);
      } catch {
        detail = await response.text();
      }
      throw new ApiError(response.status, `API ${response.status}: ${detail}`, detail);
    }

    return await response.json();
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(408, 'Request timed out after 35 seconds. The database or agent took too long to respond.');
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, `Network error: ${message}`);
  }
}

export const api = {
  // Health
  getHealth: (): Promise<HealthResponse> => request<HealthResponse>('/api/health'),

  // Services
  getServices: (): Promise<{ services: ServiceNode[]; count: number }> =>
    request<{ services: ServiceNode[]; count: number }>('/api/services'),

  getServiceDetail: (serviceId: string) =>
    request<{
      service: ServiceNode;
      vulnerabilities: VulnerabilityNode[];
      owner: unknown;
      dependent_service_count: number;
      max_dependency_depth: number;
    }>(`/api/services/${encodeURIComponent(serviceId)}`),

  // Vulnerabilities
  getVulnerabilities: (): Promise<{ vulnerabilities: VulnerabilityNode[]; count: number }> =>
    request<{ vulnerabilities: VulnerabilityNode[]; count: number }>('/api/vulnerabilities'),

  // Graph Data
  getGraph: (): Promise<GraphVisualizationData> =>
    request<GraphVisualizationData>('/api/graph'),

  // Agent Investigation
  investigate: (question: string, createTicket = false): Promise<InvestigationResult> =>
    request<InvestigationResult>('/api/agent/query', {
      method: 'POST',
      body: JSON.stringify({ question, create_ticket: createTicket }),
    }),

  // Tickets
  getTickets: (): Promise<{ tickets: RemediationTicket[]; count: number }> =>
    request<{ tickets: RemediationTicket[]; count: number }>('/api/tickets'),

  createTicket: (payload: {
    service_id: string;
    vulnerability_id: string;
    reason: string;
    recommended_steps?: string[];
  }): Promise<{ ticket: RemediationTicket; note: string }> =>
    request<{ ticket: RemediationTicket; note: string }>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const fetchHealth = (): Promise<HealthResponse> => api.getHealth();
export const fetchServices = async (): Promise<ServiceNode[]> => (await api.getServices()).services;
export const fetchVulnerabilities = async (): Promise<VulnerabilityNode[]> => (await api.getVulnerabilities()).vulnerabilities;
export const fetchTickets = async (): Promise<RemediationTicket[]> => (await api.getTickets()).tickets;
export const fetchGraphData = (): Promise<GraphVisualizationData> => api.getGraph();
export const investigateAlert = (q: string, createTicket = false): Promise<InvestigationResult> => api.investigate(q, createTicket);
export const createTicket = async (payload: {
  service_id: string;
  vulnerability_id: string;
  reason: string;
  recommended_steps?: string[];
}): Promise<RemediationTicket> => (await api.createTicket(payload)).ticket;
