"""
GraphGuard MCP Server

Exposes five investigation tools via the MCP protocol using mcp 2.x (MCPServer).
This file is the server entry point — it is launched as a subprocess by mcp_client.py.

IMPORTANT: This server uses stdio transport. Do NOT print arbitrary text to stdout
because it corrupts the MCP message stream. Use stderr for logging only.

Tools exposed:
  1. investigate_service     — lookup service + vulns + owner + initial deps
  2. trace_dependencies      — multi-hop dependent discovery
  3. rank_findings           — calculate and rank risk scores
  4. get_service_owner       — owner/team info
  5. create_remediation_ticket — validate evidence and persist a ticket
  6. list_tickets            — read-only ticket list
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Optional

# Route all logging to stderr so stdout stays clean for MCP protocol messages
logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="[MCP-SERVER] %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from mcp.server.mcpserver import MCPServer
from app.graph_queries import (
    get_service_by_id,
    get_service_by_name,
    get_vulnerabilities_for_service,
    get_owner_for_service,
    find_all_dependents,
    count_reachable_dependents,
    max_observed_depth,
    list_vulnerabilities,
    get_tickets,
    get_ticket_by_id,
)
from app.risk_engine import calculate_risk_score, rank_findings
from app.ticket_service import create_remediation_ticket, TicketCreationError
from app.config import settings

mcp = MCPServer("graphguard-security")


# ── Tool 1: investigate_service ────────────────────────────────────────────────

@mcp.tool()
def investigate_service(
    service_id: Optional[str] = None,
    service_name: Optional[str] = None,
) -> dict:
    """
    Investigate a service: return its metadata, vulnerabilities, owner,
    and direct dependents. Provide either service_id or service_name.
    """
    if not service_id and not service_name:
        return {"error": "Provide either service_id or service_name"}

    # Resolve service
    svc = None
    if service_id:
        svc = get_service_by_id(service_id)
    if svc is None and service_name:
        svc = get_service_by_name(service_name)

    if svc is None:
        identifier = service_id or service_name
        return {
            "error": f"Service '{identifier}' not found in graph",
            "service": None,
        }

    vulns = get_vulnerabilities_for_service(svc.id)
    owner = get_owner_for_service(svc.id)
    direct_dep_count = count_reachable_dependents(svc.id, max_hops=1)

    return {
        "service": svc.model_dump(),
        "vulnerabilities": [v.model_dump() for v in vulns],
        "owner": owner.model_dump() if owner else None,
        "direct_dependent_count": direct_dep_count,
        "investigation_note": (
            "This is the initial service profile. "
            "Use trace_dependencies for full multi-hop impact analysis."
        ),
    }


# ── Tool 2: trace_dependencies ─────────────────────────────────────────────────

@mcp.tool()
def trace_dependencies(
    service_id: str,
    max_hops: int = 3,
) -> dict:
    """
    Find all services that depend (directly or indirectly) on the target service.
    Returns exact dependency paths with hop counts.
    max_hops must be between 1 and 5.
    """
    if not service_id:
        return {"error": "service_id is required"}

    max_hops = max(1, min(max_hops, settings.GRAPH_MAX_HOPS))

    svc = get_service_by_id(service_id)
    if svc is None:
        return {"error": f"Service '{service_id}' not found in graph"}

    impacted = find_all_dependents(svc.id, max_hops=max_hops)
    total_count = len(impacted)
    max_depth = max((s.hop_count for s in impacted), default=0)

    # Enrich impacted services with owner info
    enriched = []
    for imp in impacted:
        owner = get_owner_for_service(imp.service_id)
        enriched.append({
            **imp.model_dump(),
            "owner": owner.model_dump() if owner else None,
        })

    return {
        "target_service": svc.model_dump(),
        "impacted_services": enriched,
        "total_impacted_count": total_count,
        "max_observed_depth": max_depth,
        "max_hops_searched": max_hops,
        "note": (
            "Services listed are POTENTIALLY AFFECTED because they depend on the target. "
            "A dependency path does not confirm exploitation — it identifies review candidates."
        ),
    }


# ── Tool 3: rank_findings ──────────────────────────────────────────────────────

@mcp.tool()
def rank_findings(
    service_id: str,
    max_hops: int = 3,
) -> dict:
    """
    Calculate and rank risk scores for all vulnerabilities on a service.
    Uses graph-backed impact counts and dependency depth.
    Returns scoring breakdown for each vulnerability.
    """
    if not service_id:
        return {"error": "service_id is required"}

    svc = get_service_by_id(service_id)
    if svc is None:
        return {"error": f"Service '{service_id}' not found in graph"}

    max_hops = max(1, min(max_hops, settings.GRAPH_MAX_HOPS))
    vulns = get_vulnerabilities_for_service(svc.id)

    if not vulns:
        return {
            "service": svc.model_dump(),
            "findings": [],
            "note": "No vulnerabilities found for this service",
        }

    impacted_count = count_reachable_dependents(svc.id, max_hops=max_hops)
    depth = max_observed_depth(svc.id, max_hops=max_hops)

    scores = [
        calculate_risk_score(v, impacted_count, depth)
        for v in vulns
    ]
    ranked = rank_findings(scores)

    return {
        "service": svc.model_dump(),
        "findings": [r.model_dump() for r in ranked],
        "total_vulnerabilities": len(vulns),
        "impacted_service_count": impacted_count,
        "max_observed_depth": depth,
    }


# ── Tool 4: get_service_owner ──────────────────────────────────────────────────

@mcp.tool()
def get_service_owner(service_id: str) -> dict:
    """
    Return the owner and team information for a service.
    """
    if not service_id:
        return {"error": "service_id is required"}

    svc = get_service_by_id(service_id)
    if svc is None:
        return {"error": f"Service '{service_id}' not found"}

    owner = get_owner_for_service(service_id)
    if owner is None:
        return {
            "service": svc.model_dump(),
            "owner": None,
            "note": "No owner record found for this service",
        }

    return {
        "service": svc.model_dump(),
        "owner": owner.model_dump(),
    }


# ── Tool 5: create_remediation_ticket ─────────────────────────────────────────

@mcp.tool()
def create_remediation_ticket_tool(
    service_id: str,
    vulnerability_id: str,
    reason: str,
    recommended_steps: list[str],
) -> dict:
    """
    Create a PROPOSED remediation ticket backed by verified graph evidence.
    The service_id and vulnerability_id must exist and be linked in the graph.
    The ticket is persisted in FalkorDB and retrievable via list_tickets.
    """
    if not service_id or not vulnerability_id or not reason:
        return {"error": "service_id, vulnerability_id, and reason are all required"}

    if not recommended_steps:
        recommended_steps = ["Review the vulnerability details and apply vendor patches."]

    # Gather evidence from the graph
    impacted = find_all_dependents(service_id, max_hops=settings.GRAPH_MAX_HOPS)

    try:
        ticket = create_remediation_ticket(
            service_id=service_id,
            vulnerability_id=vulnerability_id,
            reason=reason,
            recommended_steps=recommended_steps,
            impacted_services=impacted,
        )
        return {
            "success": True,
            "ticket": ticket.model_dump(),
            "note": (
                f"Ticket {ticket.id} created with status PROPOSED. "
                "This is a proposed review task — no changes to production systems were made."
            ),
        }
    except TicketCreationError as exc:
        return {"success": False, "error": str(exc)}


# ── Tool 6: list_tickets ───────────────────────────────────────────────────────

@mcp.tool()
def list_tickets() -> dict:
    """Return all persisted remediation tickets (read-only)."""
    tickets = get_tickets()
    return {
        "tickets": [t.model_dump() for t in tickets],
        "count": len(tickets),
    }


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import asyncio
    asyncio.run(mcp.run_stdio_async())
