# GraphGuard — Cyber Security Intelligence Lab
> **Track 1: Agents That Act on Connected Data**  
> Graph-driven security investigation, dependency blast-radius tracing, transparent risk scoring, and remediation ticket generation powered by **FalkorDB**, **FastAPI**, **MCP**, and **React**.

---

## 🎨 Creative Direction & Architecture

GraphGuard departs from generic AI dashboards and dark terminal templates. Built with a bespoke **Electric Playground** aesthetic (warm paper `#FFFDF5`, electric cobalt `#3949FF`, acid lime `#D7FF43`, vivid coral `#FF6B61`, tactile neo-brutalist borders, Space Grotesk / Syne display typography, and IBM Plex Mono code elements).

```
graph/
├── app/
│   ├── main.py               # FastAPI REST API with CORS & documentation
│   ├── graph_db.py           # FalkorDB connection manager & query helpers
│   ├── graph_queries.py      # Cypher queries (services, vulns, dependencies, tickets)
│   ├── risk_engine.py        # Graph-aware risk scoring & prioritization engine
│   ├── ticket_service.py     # Deterministic ticket creation & graph persistence
│   ├── mcp_server.py         # FastMCP server exposing 6 security tools
│   ├── agent.py              # Investigation agent (Gemini 2.0 Flash + demo fallback)
│   ├── seed_data.py          # Synthetic dataset definition & idempotent loader
│   └── models.py             # Pydantic schemas
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HeroSection.tsx           # Expressive typography & live graph preview
│   │   │   ├── OverviewDashboard.tsx     # Live status, KPIs, and service mesh table
│   │   │   ├── DependencyGraph.tsx       # Interactive React Flow canvas with custom nodes
│   │   │   ├── InvestigationWorkspace.tsx# Natural-language query lab & tool execution trace
│   │   │   ├── FindingsStory.tsx         # Transparent risk formula & priority matrix
│   │   │   └── RemediationBoard.tsx      # Proposed remediation tickets & celebratory feedback
│   │   ├── api/client.ts                 # Type-safe API client with abort timeouts & proxy
│   │   ├── types/api.ts                  # TypeScript definitions for backend schemas
│   │   ├── App.tsx                       # Application shell & state coordination
│   │   └── index.css                     # Custom design tokens, typography, and tactile styles
│   ├── vite.config.ts                    # Vite config with Tailwind CSS & API proxy
│   └── package.json                      # React 19, @xyflow/react, Framer Motion, Tailwind
├── scripts/
│   ├── seed_graph.py                     # Idempotent graph seeder script
│   └── check_setup.py                    # Environment diagnostics & smoke test
├── tests/                                # 51 Unit & API tests (pytest)
├── docker-compose.yml                    # FalkorDB local container configuration
└── requirements.txt                      # Python dependencies
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Python**: 3.11+
- **Node.js**: v18+ (tested on v26)
- **Docker Desktop**: (for running local FalkorDB instance)

### 2. Start FalkorDB (Graph Database)
```bash
docker compose up -d
```

### 3. Seed the Graph with Synthetic Security Topology
```bash
.venv/bin/python scripts/seed_graph.py
```
*Note: The seeder uses `MERGE` queries and is completely idempotent.*

### 4. Start the FastAPI Backend (Port 8000)
```bash
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- **Interactive Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Application Health**: [http://localhost:8000/health](http://localhost:8000/health)
- **FalkorDB Diagnostics**: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### 5. Start the React Frontend (Port 5173)
```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
- **Open in Browser / Safari**: [http://127.0.0.1:5173](http://127.0.0.1:5173) or [http://localhost:5173](http://localhost:5173)

---

## 🔬 Core Features & Workflows

1. **Overview Dashboard**:
   - Live health status distinguishing FastAPI application availability from FalkorDB connection state.
   - Service count, vulnerability count, blast radius metrics, and persisted proposed ticket counters.
   - Complete service inventory with criticality tiers.

2. **Security Investigation Lab**:
   - Select target service or enter natural language question.
   - Calls `POST /api/agent/query`.
   - Distinct, honest labelling of investigation mode (`deterministic_demo` vs `autonomous_llm`).
   - Detailed breakdown of target entity, direct vulnerabilities, downstream blast radius, and full tool-call execution trace.

3. **Interactive Dependency Atlas (React Flow)**:
   - Built with `@xyflow/react`.
   - Real nodes and edges loaded from `GET /api/graph`.
   - Custom tactile nodes for Services, Vulnerabilities, Owners, and Tickets.
   - Highlighted blast radius path animation for investigated targets.
   - High-contrast accessible Tabular Fallback view.

4. **Transparent Risk Engine**:
   - Inspectable mathematical scoring formula:
     $$\text{Risk Score} = \text{Severity Base} + \text{Impact Bonus} + \text{Depth Bonus}$$
   - Priority assignments: P1 (&ge;85), P2 (&ge;70), P3 (&ge;45), P4 (&lt;45).
   - Clear distinction between observed graph facts and calculated heuristics.

5. **Remediation Action Board**:
   - Editorial project board displaying persisted `PROPOSED` tickets from `GET /api/tickets`.
   - Create proposed tickets via `POST /api/tickets` with validated service-to-vulnerability linking.
   - Celebratory confetti feedback and explicit disclosure that no production changes are made without human review.

---

## 🧪 Testing & Verification

Run the complete test suite:
```bash
.venv/bin/python -m pytest tests/ -v
```
- **51 Passed, 0 Failed**:
  - `test_risk_engine.py`: 33/33 passed (scoring formula edge cases, bonus caps, priority thresholds)
  - `test_api.py`: 15/15 passed (health checks, mock traversals, validation, 404/422/503 errors)
  - `test_agent.py`: 3/3 passed (demo mode labeling, tool call limit enforcement, error handling)

Frontend production build check:
```bash
cd frontend && npm run build
```
*(Verified: Compiles cleanly with TypeScript and Vite in 255ms)*
