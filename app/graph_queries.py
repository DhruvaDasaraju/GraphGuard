"""
GraphGuard Graph Queries

All typed functions that query or write to FalkorDB.
Each function returns structured Python objects — never raw prose.

Design notes:
- All Cypher uses $param placeholders — user input is NEVER concatenated.
- Hop depth is bounded by settings.GRAPH_MAX_HOPS (≤ 5).
- DEPENDS_ON direction: (A)-[:DEPENDS_ON]->(B)
  means A depends on B.  Traversing *incoming* DEPENDS_ON edges
  to a target reveals which services depend on (and are affected by) the target.
"""

from __future__ import annotations

import logging
from typing import Optional

from app.graph_db import execute_query
from app.config import settings
from app.models import (
    ServiceNode,
    VulnerabilityNode,
    OwnerNode,
    RemediationTicket,
    DependencyPath,
    PathHop,
    ImpactedService,
)

logger = logging.getLogger(__name__)

MAX_HOPS = settings.GRAPH_MAX_HOPS


# ── Helper: raw row → typed model ─────────────────────────────────────────────

def _row_to_service(props: dict) -> ServiceNode:
    return ServiceNode(
        id=props.get("id", ""),
        name=props.get("name", ""),
        description=props.get("description", ""),
        environment=props.get("environment", "production"),
        criticality=props.get("criticality", "medium"),
        owner_id=props.get("owner_id"),
    )


def _row_to_vuln(props: dict) -> VulnerabilityNode:
    return VulnerabilityNode(
        id=props.get("id", ""),
        title=props.get("title", ""),
        severity=props.get("severity", "medium"),
        description=props.get("description", ""),
        affected_version=props.get("affected_version", ""),
        status=props.get("status", "open"),
    )


def _row_to_owner(props: dict) -> OwnerNode:
    return OwnerNode(
        id=props.get("id", ""),
        name=props.get("name", ""),
        team=props.get("team", ""),
        contact=props.get("contact", ""),
    )


# ── Service Queries ─────────────────────────────────────────────────────────────

def get_service_by_id(service_id: str) -> Optional[ServiceNode]:
    """Return a SERVICE node by its stable id, or None if not found."""
    rows = execute_query(
        "MATCH (s:SERVICE {id: $sid}) RETURN properties(s) AS props",
        {"sid": service_id},
    )
    if not rows:
        return None
    return _row_to_service(rows[0]["props"])


def get_service_by_name(name: str) -> Optional[ServiceNode]:
    """Return a SERVICE node by exact name (case-sensitive), or None."""
    rows = execute_query(
        "MATCH (s:SERVICE) WHERE s.name = $name RETURN properties(s) AS props",
        {"name": name},
    )
    if not rows:
        return None
    return _row_to_service(rows[0]["props"])


def list_services() -> list[ServiceNode]:
    """Return all SERVICE nodes."""
    rows = execute_query("MATCH (s:SERVICE) RETURN properties(s) AS props ORDER BY s.name")
    return [_row_to_service(r["props"]) for r in rows]


# ── Vulnerability Queries ───────────────────────────────────────────────────────

def get_vulnerabilities_for_service(service_id: str) -> list[VulnerabilityNode]:
    """Return all VULNERABILITY nodes linked to a service via HAS_VULNERABILITY."""
    rows = execute_query(
        "MATCH (s:SERVICE {id: $sid})-[:HAS_VULNERABILITY]->(v:VULNERABILITY) "
        "RETURN properties(v) AS props",
        {"sid": service_id},
    )
    return [_row_to_vuln(r["props"]) for r in rows]


def list_vulnerabilities() -> list[VulnerabilityNode]:
    """Return all VULNERABILITY nodes."""
    rows = execute_query(
        "MATCH (v:VULNERABILITY) RETURN properties(v) AS props ORDER BY v.severity"
    )
    return [_row_to_vuln(r["props"]) for r in rows]


def get_services_for_vulnerability(vuln_id: str) -> list[ServiceNode]:
    """Return all services that directly carry a specific vulnerability."""
    rows = execute_query(
        "MATCH (s:SERVICE)-[:HAS_VULNERABILITY]->(v:VULNERABILITY {id: $vid}) "
        "RETURN properties(s) AS props",
        {"vid": vuln_id},
    )
    return [_row_to_service(r["props"]) for r in rows]


# ── Owner Queries ───────────────────────────────────────────────────────────────

def get_owner_for_service(service_id: str) -> Optional[OwnerNode]:
    """Return the OWNER of a service (via OWNS edge), or None."""
    rows = execute_query(
        "MATCH (o:OWNER)-[:OWNS]->(s:SERVICE {id: $sid}) RETURN properties(o) AS props",
        {"sid": service_id},
    )
    if not rows:
        return None
    return _row_to_owner(rows[0]["props"])


# ── Dependency Traversal ────────────────────────────────────────────────────────

def get_direct_dependents(service_id: str) -> list[ServiceNode]:
    """
    Return services that directly DEPENDS_ON the target service (1 hop in).
    i.e. find X where (X)-[:DEPENDS_ON]->(target).
    """
    rows = execute_query(
        "MATCH (x:SERVICE)-[:DEPENDS_ON]->(t:SERVICE {id: $sid}) "
        "RETURN properties(x) AS props",
        {"sid": service_id},
    )
    return [_row_to_service(r["props"]) for r in rows]


def find_all_dependents(service_id: str, max_hops: Optional[int] = None) -> list[ImpactedService]:
    """
    Multi-hop traversal: find ALL services that depend on the target service
    (directly or transitively), up to max_hops hops.

    Returns ImpactedService objects with full dependency paths.
    Unrelated services (no path to target) are NOT included.
    """
    hops = min(max_hops or MAX_HOPS, MAX_HOPS)
    if hops < 1:
        hops = 1

    # Variable-length relationship pattern: (x)-[:DEPENDS_ON*1..hops]->(target)
    # We collect all nodes on the path.
    # FalkorDB supports variable-length paths with nodes(p) and relationships(r).
    rows = execute_query(
        f"MATCH p = (x:SERVICE)-[:DEPENDS_ON*1..{hops}]->(t:SERVICE {{id: $sid}}) "
        "WHERE x.id <> $sid "
        "RETURN "
        "  [n IN nodes(p) | properties(n)] AS path_nodes, "
        "  length(p) AS hop_count",
        {"sid": service_id},
    )

    # Group paths by the starting service id (the dependent)
    # Multiple paths to the same dependent are possible (via different routes).
    # We collect the shortest observed path per dependent.
    best: dict[str, ImpactedService] = {}

    for row in rows:
        path_nodes: list[dict] = row["path_nodes"]
        hop_count: int = row["hop_count"]

        if not path_nodes:
            continue

        # path_nodes[0] is the dependent (x), path_nodes[-1] is the target (t)
        dependent_props = path_nodes[0]
        dep_id = dependent_props.get("id", "")
        dep_name = dependent_props.get("name", "")

        # Build PathHop list (exclude the target node itself from the path display)
        hops_in_path: list[PathHop] = []
        for node_props in path_nodes:
            hops_in_path.append(
                PathHop(
                    service_id=node_props.get("id", ""),
                    service_name=node_props.get("name", ""),
                    criticality=node_props.get("criticality", "medium"),
                )
            )

        connection_type = "direct" if hop_count == 1 else "indirect"

        dep_path = DependencyPath(
            path=hops_in_path,
            hop_count=hop_count,
            connection_type=connection_type,
            dependent_service_id=dep_id,
            dependent_service_name=dep_name,
        )

        if dep_id not in best:
            best[dep_id] = ImpactedService(
                service_id=dep_id,
                service_name=dep_name,
                criticality=dependent_props.get("criticality", "medium"),
                connection_type=connection_type,
                hop_count=hop_count,
                dependency_paths=[dep_path],
            )
        else:
            existing = best[dep_id]
            existing.dependency_paths.append(dep_path)
            # Promote connection_type to direct if any direct path exists
            if connection_type == "direct":
                existing.connection_type = "direct"
                existing.hop_count = min(existing.hop_count, hop_count)

    return list(best.values())


def count_reachable_dependents(service_id: str, max_hops: Optional[int] = None) -> int:
    """Count distinct services that can reach target via DEPENDS_ON within max_hops."""
    hops = min(max_hops or MAX_HOPS, MAX_HOPS)
    rows = execute_query(
        f"MATCH (x:SERVICE)-[:DEPENDS_ON*1..{hops}]->(t:SERVICE {{id: $sid}}) "
        "WHERE x.id <> $sid "
        "RETURN count(DISTINCT x) AS cnt",
        {"sid": service_id},
    )
    if rows:
        return int(rows[0].get("cnt", 0))
    return 0


def max_observed_depth(service_id: str, max_hops: Optional[int] = None) -> int:
    """Return the maximum dependency depth observed for the target service."""
    hops = min(max_hops or MAX_HOPS, MAX_HOPS)
    rows = execute_query(
        f"MATCH p = (x:SERVICE)-[:DEPENDS_ON*1..{hops}]->(t:SERVICE {{id: $sid}}) "
        "WHERE x.id <> $sid "
        "RETURN max(length(p)) AS max_depth",
        {"sid": service_id},
    )
    if rows and rows[0].get("max_depth") is not None:
        return int(rows[0]["max_depth"])
    return 0


# ── Ticket Queries ─────────────────────────────────────────────────────────────

def get_tickets() -> list[RemediationTicket]:
    """Return all persisted REMEDIATION_TICKET nodes."""
    rows = execute_query(
        "MATCH (t:REMEDIATION_TICKET) RETURN properties(t) AS props ORDER BY t.created_at DESC"
    )
    return [_row_to_ticket(r["props"]) for r in rows]


def get_ticket_by_id(ticket_id: str) -> Optional[RemediationTicket]:
    """Return a REMEDIATION_TICKET by its id, or None."""
    rows = execute_query(
        "MATCH (t:REMEDIATION_TICKET {id: $tid}) RETURN properties(t) AS props",
        {"tid": ticket_id},
    )
    if not rows:
        return None
    return _row_to_ticket(rows[0]["props"])


def _row_to_ticket(props: dict) -> RemediationTicket:
    return RemediationTicket(
        id=props.get("id", ""),
        title=props.get("title", ""),
        description=props.get("description", ""),
        status=props.get("status", "PROPOSED"),
        priority=props.get("priority", "P3"),
        target_service_id=props.get("target_service_id", ""),
        vulnerability_id=props.get("vulnerability_id", ""),
        risk_score=float(props.get("risk_score", 0.0)),
        evidence_json=props.get("evidence_json", ""),
        created_at=props.get("created_at", ""),
    )


def persist_ticket(ticket: RemediationTicket) -> RemediationTicket:
    """
    Write a RemediationTicket node to FalkorDB and create relationships
    to the target SERVICE and VULNERABILITY.

    Raises RuntimeError if the service or vulnerability does not exist.
    """
    # Validate referenced entities exist before writing
    svc = get_service_by_id(ticket.target_service_id)
    if svc is None:
        raise RuntimeError(
            f"Cannot persist ticket: service '{ticket.target_service_id}' not found in graph"
        )

    vuln_rows = execute_query(
        "MATCH (v:VULNERABILITY {id: $vid}) RETURN properties(v) AS props",
        {"vid": ticket.vulnerability_id},
    )
    if not vuln_rows:
        raise RuntimeError(
            f"Cannot persist ticket: vulnerability '{ticket.vulnerability_id}' not found in graph"
        )

    # MERGE ticket node (idempotent on id)
    execute_query(
        "MERGE (t:REMEDIATION_TICKET {id: $id}) "
        "SET t.title = $title, "
        "    t.description = $description, "
        "    t.status = $status, "
        "    t.priority = $priority, "
        "    t.target_service_id = $svc_id, "
        "    t.vulnerability_id = $vuln_id, "
        "    t.risk_score = $risk_score, "
        "    t.evidence_json = $evidence_json, "
        "    t.created_at = $created_at",
        {
            "id": ticket.id,
            "title": ticket.title,
            "description": ticket.description,
            "status": ticket.status,
            "priority": ticket.priority,
            "svc_id": ticket.target_service_id,
            "vuln_id": ticket.vulnerability_id,
            "risk_score": ticket.risk_score,
            "evidence_json": ticket.evidence_json,
            "created_at": ticket.created_at,
        },
    )

    # Create relationship edges
    execute_query(
        "MATCH (t:REMEDIATION_TICKET {id: $tid}), (s:SERVICE {id: $sid}) "
        "MERGE (t)-[:TARGETS]->(s)",
        {"tid": ticket.id, "sid": ticket.target_service_id},
    )
    execute_query(
        "MATCH (t:REMEDIATION_TICKET {id: $tid}), (v:VULNERABILITY {id: $vid}) "
        "MERGE (t)-[:ADDRESSES]->(v)",
        {"tid": ticket.id, "vid": ticket.vulnerability_id},
    )

    logger.info("Persisted ticket %s with priority %s", ticket.id, ticket.priority)
    return ticket


def get_graph_visualization_data() -> dict:
    """
    Return bounded graph data for visualization.
    Includes SERVICE, VULNERABILITY, OWNER nodes and their relationships.
    Limited to avoid overwhelming a frontend.
    """
    # Nodes
    svc_rows = execute_query(
        "MATCH (s:SERVICE) RETURN properties(s) AS props, 'SERVICE' AS node_type LIMIT 50"
    )
    vuln_rows = execute_query(
        "MATCH (v:VULNERABILITY) RETURN properties(v) AS props, 'VULNERABILITY' AS node_type LIMIT 20"
    )
    owner_rows = execute_query(
        "MATCH (o:OWNER) RETURN properties(o) AS props, 'OWNER' AS node_type LIMIT 20"
    )
    ticket_rows = execute_query(
        "MATCH (t:REMEDIATION_TICKET) RETURN properties(t) AS props, 'REMEDIATION_TICKET' AS node_type LIMIT 20"
    )

    nodes = []
    for row in svc_rows + vuln_rows + owner_rows + ticket_rows:
        p = row["props"]
        nodes.append({
            "id": p.get("id", ""),
            "label": p.get("name", p.get("title", p.get("id", ""))),
            "node_type": row["node_type"],
            "properties": p,
        })

    # Edges
    dep_rows = execute_query(
        "MATCH (a:SERVICE)-[:DEPENDS_ON]->(b:SERVICE) "
        "RETURN a.id AS src, b.id AS tgt, 'DEPENDS_ON' AS rel LIMIT 100"
    )
    vuln_edges = execute_query(
        "MATCH (s:SERVICE)-[:HAS_VULNERABILITY]->(v:VULNERABILITY) "
        "RETURN s.id AS src, v.id AS tgt, 'HAS_VULNERABILITY' AS rel LIMIT 50"
    )
    owner_edges = execute_query(
        "MATCH (o:OWNER)-[:OWNS]->(s:SERVICE) "
        "RETURN o.id AS src, s.id AS tgt, 'OWNS' AS rel LIMIT 50"
    )
    ticket_edges = execute_query(
        "MATCH (t:REMEDIATION_TICKET)-[:TARGETS]->(s:SERVICE) "
        "RETURN t.id AS src, s.id AS tgt, 'TARGETS' AS rel LIMIT 20"
    )

    edges = []
    for row in dep_rows + vuln_edges + owner_edges + ticket_edges:
        edges.append({
            "source": row["src"],
            "target": row["tgt"],
            "relationship": row["rel"],
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "node_count": len(nodes),
        "edge_count": len(edges),
    }
