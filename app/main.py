"""
GraphGuard FastAPI Application

All REST endpoints. Import from project root as:
    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from app.config import settings
from app.graph_db import db_health_check, reset_connection
from app.graph_queries import (
    list_services,
    get_service_by_id,
    get_vulnerabilities_for_service,
    get_owner_for_service,
    list_vulnerabilities,
    get_tickets,
    get_ticket_by_id,
    find_all_dependents,
    count_reachable_dependents,
    max_observed_depth,
    get_graph_visualization_data,
)
from app.models import (
    AgentQueryRequest,
    TicketCreateRequest,
    HealthResponse,
    GraphVisualizationData,
    GraphVisualizationNode,
    GraphVisualizationEdge,
    RemediationTicket,
    ServiceNode,
    VulnerabilityNode,
)
from app.agent import GraphGuardAgent
from app.ticket_service import create_remediation_ticket, TicketCreationError
from app.risk_engine import calculate_risk_score

logger = logging.getLogger(__name__)

app = FastAPI(
    title="GraphGuard Security Intelligence API",
    description=(
        "Agent-driven security investigation using FalkorDB graph analysis. "
        "Investigates vulnerable services, traces dependency paths, ranks findings, "
        "and creates remediation tickets — all backed by real graph data."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
async def root():
    """Redirect root path directly to interactive API documentation."""
    return RedirectResponse(url="/docs")


# ── Exception Handlers ────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ── Health Endpoints ───────────────────────────────────────────────────────────

@app.get("/health", summary="Basic application health")
async def health_simple() -> dict:
    """Returns application status without checking the database."""
    return {
        "status": "ok",
        "version": "0.1.0",
        "demo_mode": settings.GRAPHGUARD_DEMO_MODE,
        "llm_enabled": settings.llm_enabled,
    }


@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Full health check including FalkorDB connectivity",
)
async def health_full() -> HealthResponse:
    """
    Checks whether FalkorDB is actually reachable.
    Returns distinct status for application vs. database availability.
    """
    db_status = db_health_check()
    return HealthResponse(
        status="ok" if db_status["healthy"] else "degraded",
        falkordb_connected=db_status["healthy"],
        falkordb_host=settings.FALKORDB_HOST,
        falkordb_port=settings.FALKORDB_PORT,
        graph_name=settings.FALKORDB_GRAPH_NAME,
        llm_enabled=settings.llm_enabled,
        demo_mode=settings.GRAPHGUARD_DEMO_MODE,
    )


# ── Service Endpoints ──────────────────────────────────────────────────────────

@app.get("/api/services", summary="List all services in the graph")
async def list_all_services() -> dict:
    """Returns all SERVICE nodes with essential metadata."""
    try:
        services = list_services()
        return {
            "services": [s.model_dump() for s in services],
            "count": len(services),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")


@app.get("/api/services/{service_id}", summary="Get a service with its vulnerabilities and owner")
async def get_service_detail(service_id: str) -> dict:
    """Returns a service node with associated vulnerabilities and owner information."""
    try:
        svc = get_service_by_id(service_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    if svc is None:
        raise HTTPException(
            status_code=404,
            detail=f"Service '{service_id}' not found",
        )

    try:
        vulns = get_vulnerabilities_for_service(service_id)
        owner = get_owner_for_service(service_id)
        dep_count = count_reachable_dependents(service_id)
        depth = max_observed_depth(service_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    return {
        "service": svc.model_dump(),
        "vulnerabilities": [v.model_dump() for v in vulns],
        "owner": owner.model_dump() if owner else None,
        "dependent_service_count": dep_count,
        "max_dependency_depth": depth,
    }


# ── Vulnerability Endpoints ────────────────────────────────────────────────────

@app.get("/api/vulnerabilities", summary="List all known vulnerabilities")
async def list_all_vulnerabilities() -> dict:
    """Returns all VULNERABILITY nodes with linked service IDs."""
    try:
        vulns = list_vulnerabilities()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    result = []
    for v in vulns:
        from app.graph_queries import get_services_for_vulnerability
        svcs = get_services_for_vulnerability(v.id)
        result.append({
            **v.model_dump(),
            "affected_service_ids": [s.id for s in svcs],
        })

    return {"vulnerabilities": result, "count": len(result)}


# ── Graph Visualization Endpoint ───────────────────────────────────────────────

@app.get(
    "/api/graph",
    response_model=GraphVisualizationData,
    summary="Bounded graph data for visualization",
)
async def get_graph_data() -> GraphVisualizationData:
    """
    Returns a bounded set of nodes and edges for frontend graph rendering.
    Includes SERVICE, VULNERABILITY, OWNER nodes and their relationships.
    """
    try:
        data = get_graph_visualization_data()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    nodes = [
        GraphVisualizationNode(
            id=n["id"],
            label=n["label"],
            node_type=n["node_type"],
            properties=n["properties"],
        )
        for n in data["nodes"]
    ]
    edges = [
        GraphVisualizationEdge(
            source=e["source"],
            target=e["target"],
            relationship=e["relationship"],
        )
        for e in data["edges"]
    ]

    return GraphVisualizationData(
        nodes=nodes,
        edges=edges,
        node_count=len(nodes),
        edge_count=len(edges),
    )


# ── Agent Query Endpoint ───────────────────────────────────────────────────────

@app.post("/api/agent/query", summary="Run an AI-driven security investigation")
async def agent_query(request: AgentQueryRequest) -> dict:
    """
    Accepts a natural-language security question, runs the GraphGuard agent,
    and returns a structured investigation result.

    The agent uses real MCP tool calls and FalkorDB graph data.
    In demo mode (no API key configured) it follows a deterministic workflow.
    """
    agent = GraphGuardAgent()
    try:
        result = await agent.investigate(
            question=request.question,
            create_ticket=request.create_ticket,
        )
    except Exception as exc:
        logger.exception("Agent investigation failed")
        raise HTTPException(status_code=500, detail=f"Investigation failed: {exc}")

    return result.model_dump()


# ── Ticket Endpoints ───────────────────────────────────────────────────────────

@app.post(
    "/api/tickets",
    status_code=status.HTTP_201_CREATED,
    summary="Create a proposed remediation ticket",
)
async def create_ticket(request: TicketCreateRequest) -> dict:
    """
    Creates a PROPOSED remediation ticket backed by verified graph evidence.
    The service_id and vulnerability_id must exist and be linked in the graph.
    Does not trust unsupported impact claims from the client.
    """
    try:
        impacted = find_all_dependents(request.service_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    try:
        ticket = create_remediation_ticket(
            service_id=request.service_id,
            vulnerability_id=request.vulnerability_id,
            reason=request.reason,
            recommended_steps=request.recommended_steps,
            impacted_services=impacted,
        )
    except TicketCreationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return {
        "ticket": ticket.model_dump(),
        "note": "Ticket persisted with status PROPOSED. No production changes were made.",
    }


@app.get("/api/tickets", summary="List all persisted remediation tickets")
async def list_all_tickets() -> dict:
    """Returns all REMEDIATION_TICKET nodes persisted in FalkorDB."""
    try:
        tickets = get_tickets()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    return {"tickets": [t.model_dump() for t in tickets], "count": len(tickets)}


@app.get("/api/tickets/{ticket_id}", summary="Get a remediation ticket by ID")
async def get_ticket(ticket_id: str) -> dict:
    """Returns a persisted REMEDIATION_TICKET or 404 if not found."""
    try:
        ticket = get_ticket_by_id(ticket_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}")

    if ticket is None:
        raise HTTPException(
            status_code=404,
            detail=f"Ticket '{ticket_id}' not found",
        )

    return {"ticket": ticket.model_dump()}
