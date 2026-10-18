"""
GraphGuard Seed Data

Contains the synthetic security environment definition.
Run via: python scripts/seed_graph.py
Or call seed_all() directly from Python.

Design notes:
- All MERGE operations are idempotent — rerunning creates no duplicates.
- IDs are stable strings so MERGE matches correctly on re-runs.
- DEPENDS_ON direction: A-[:DEPENDS_ON]->B means A requires B.
  If B is vulnerable, A is a potential downstream impact candidate.
- No real production systems, credentials, or exploitable details.
"""

from __future__ import annotations

import logging

from app.graph_db import execute_query

logger = logging.getLogger(__name__)

# ── Owners ─────────────────────────────────────────────────────────────────────
OWNERS = [
    {"id": "owner-1", "name": "Alice Kim",    "team": "Platform Security",   "contact": "alice@example.com"},
    {"id": "owner-2", "name": "Bob Patel",    "team": "Payments Team",       "contact": "bob@example.com"},
    {"id": "owner-3", "name": "Carol Wang",   "team": "API Infrastructure",  "contact": "carol@example.com"},
    {"id": "owner-4", "name": "David Osei",   "team": "Identity & Auth",     "contact": "david@example.com"},
    {"id": "owner-5", "name": "Eva Rossi",    "team": "Data & Analytics",    "contact": "eva@example.com"},
]

# ── Services ───────────────────────────────────────────────────────────────────
# criticality: low | medium | high | critical
SERVICES = [
    {"id": "svc-1",  "name": "Payment Service",   "description": "Processes all payment transactions",       "environment": "production", "criticality": "critical", "owner_id": "owner-2"},
    {"id": "svc-2",  "name": "Checkout Service",  "description": "Manages shopping cart and order checkout", "environment": "production", "criticality": "high",     "owner_id": "owner-3"},
    {"id": "svc-3",  "name": "API Gateway",       "description": "Central ingress for all client traffic",   "environment": "production", "criticality": "critical", "owner_id": "owner-3"},
    {"id": "svc-4",  "name": "Auth Service",      "description": "OAuth2/JWT token issuance and validation", "environment": "production", "criticality": "critical", "owner_id": "owner-4"},
    {"id": "svc-5",  "name": "Order Service",     "description": "Creates and tracks customer orders",       "environment": "production", "criticality": "high",     "owner_id": "owner-2"},
    {"id": "svc-6",  "name": "Inventory Service", "description": "Manages product stock levels",             "environment": "production", "criticality": "medium",   "owner_id": "owner-5"},
    {"id": "svc-7",  "name": "Notification Svc",  "description": "Sends email/SMS alerts to users",          "environment": "production", "criticality": "low",      "owner_id": "owner-5"},
    {"id": "svc-8",  "name": "Analytics Service", "description": "Collects and aggregates usage metrics",    "environment": "staging",    "criticality": "low",      "owner_id": "owner-5"},
    {"id": "svc-9",  "name": "Fraud Detection",   "description": "Real-time transaction fraud scoring",      "environment": "production", "criticality": "high",     "owner_id": "owner-1"},
    {"id": "svc-10", "name": "Reporting Service", "description": "Generates financial and compliance reports","environment": "staging",    "criticality": "medium",   "owner_id": "owner-1"},
]

# ── Vulnerabilities ────────────────────────────────────────────────────────────
VULNERABILITIES = [
    {
        "id": "vuln-1",
        "title": "SQL Injection in Payment API",
        "severity": "critical",
        "description": "Unsanitized input in /payments/process allows SQL injection via the card_number field.",
        "affected_version": "2.3.x",
        "status": "open",
    },
    {
        "id": "vuln-2",
        "title": "JWT Algorithm Confusion",
        "severity": "high",
        "description": "Auth Service accepts 'none' algorithm in JWT headers, allowing signature bypass.",
        "affected_version": "1.9.x",
        "status": "open",
    },
    {
        "id": "vuln-3",
        "title": "Insecure Direct Object Reference in Order API",
        "severity": "medium",
        "description": "Order endpoint does not verify that the requesting user owns the order ID supplied.",
        "affected_version": "3.1.x",
        "status": "open",
    },
    {
        "id": "vuln-4",
        "title": "Outdated TLS Configuration on API Gateway",
        "severity": "medium",
        "description": "API Gateway supports TLS 1.0 and 1.1. POODLE and BEAST attacks are possible.",
        "affected_version": "4.0.x",
        "status": "open",
    },
    {
        "id": "vuln-5",
        "title": "Verbose Error Leakage in Checkout Service",
        "severity": "low",
        "description": "Stack traces with internal paths are returned to API clients on 500 errors.",
        "affected_version": "2.0.x",
        "status": "open",
    },
]

# ── Service → Vulnerability Relationships ───────────────────────────────────────
# (service_id, vuln_id)
SERVICE_VULNS = [
    ("svc-1",  "vuln-1"),   # Payment Service has critical SQL Injection
    ("svc-4",  "vuln-2"),   # Auth Service has JWT confusion
    ("svc-5",  "vuln-3"),   # Order Service has IDOR
    ("svc-3",  "vuln-4"),   # API Gateway has weak TLS
    ("svc-2",  "vuln-5"),   # Checkout Service has error leakage
]

# ── DEPENDS_ON Relationships ────────────────────────────────────────────────────
# (from_service_id, to_service_id)
# Meaning: from_service DEPENDS_ON to_service
# If to_service is vulnerable, from_service is potentially impacted.
#
# Dependency chains (multi-hop):
# Checkout → API Gateway → Payment Service   (2 hops to Payment)
# Order → Checkout → API Gateway → Payment   (3 hops to Payment)
# Fraud Detection → Payment Service          (1 hop, direct)
# Reporting → Order → ... → Payment          (indirect via Order chain)
# Notification Svc: standalone (no dep on payment chain) — unrelated
# Analytics: standalone staging service — unrelated
DEPENDS_ON = [
    ("svc-2",  "svc-3"),    # Checkout → API Gateway
    ("svc-2",  "svc-4"),    # Checkout → Auth Service
    ("svc-3",  "svc-1"),    # API Gateway → Payment Service
    ("svc-5",  "svc-2"),    # Order → Checkout
    ("svc-5",  "svc-4"),    # Order → Auth Service
    ("svc-9",  "svc-1"),    # Fraud Detection → Payment Service (direct)
    ("svc-9",  "svc-4"),    # Fraud Detection → Auth Service
    ("svc-6",  "svc-5"),    # Inventory → Order
    ("svc-10", "svc-5"),    # Reporting → Order
    # Notification and Analytics have no dependency on the payment chain
]


def _merge_owners() -> None:
    query = (
        "UNWIND $owners AS o "
        "MERGE (n:OWNER {id: o.id}) "
        "SET n.name = o.name, n.team = o.team, n.contact = o.contact"
    )
    execute_query(query, {"owners": OWNERS})
    logger.info("Seeded %d OWNER nodes", len(OWNERS))


def _merge_services() -> None:
    query = (
        "UNWIND $svcs AS s "
        "MERGE (n:SERVICE {id: s.id}) "
        "SET n.name = s.name, n.description = s.description, "
        "    n.environment = s.environment, n.criticality = s.criticality, "
        "    n.owner_id = s.owner_id"
    )
    execute_query(query, {"svcs": SERVICES})
    logger.info("Seeded %d SERVICE nodes", len(SERVICES))


def _merge_vulnerabilities() -> None:
    query = (
        "UNWIND $vulns AS v "
        "MERGE (n:VULNERABILITY {id: v.id}) "
        "SET n.title = v.title, n.severity = v.severity, "
        "    n.description = v.description, "
        "    n.affected_version = v.affected_version, n.status = v.status"
    )
    execute_query(query, {"vulns": VULNERABILITIES})
    logger.info("Seeded %d VULNERABILITY nodes", len(VULNERABILITIES))


def _merge_service_vuln_edges() -> None:
    query = (
        "UNWIND $edges AS e "
        "MATCH (s:SERVICE {id: e.svc_id}), (v:VULNERABILITY {id: e.vuln_id}) "
        "MERGE (s)-[:HAS_VULNERABILITY]->(v)"
    )
    edges = [{"svc_id": s, "vuln_id": v} for s, v in SERVICE_VULNS]
    execute_query(query, {"edges": edges})
    logger.info("Seeded %d HAS_VULNERABILITY edges", len(edges))


def _merge_owner_service_edges() -> None:
    """Create OWNS edges between OWNER and SERVICE nodes."""
    query = (
        "UNWIND $svcs AS s "
        "MATCH (o:OWNER {id: s.owner_id}), (svc:SERVICE {id: s.id}) "
        "MERGE (o)-[:OWNS]->(svc)"
    )
    svc_data = [s for s in SERVICES if s.get("owner_id")]
    execute_query(query, {"svcs": svc_data})
    logger.info("Seeded %d OWNS edges", len(svc_data))


def _merge_depends_on_edges() -> None:
    query = (
        "UNWIND $edges AS e "
        "MATCH (a:SERVICE {id: e.from_id}), (b:SERVICE {id: e.to_id}) "
        "MERGE (a)-[:DEPENDS_ON]->(b)"
    )
    edges = [{"from_id": f, "to_id": t} for f, t in DEPENDS_ON]
    execute_query(query, {"edges": edges})
    logger.info("Seeded %d DEPENDS_ON edges", len(edges))


def seed_all() -> None:
    """Seed all nodes and relationships. Safe to call multiple times (idempotent)."""
    logger.info("=== Starting GraphGuard graph seed ===")
    _merge_owners()
    _merge_services()
    _merge_vulnerabilities()
    _merge_service_vuln_edges()
    _merge_owner_service_edges()
    _merge_depends_on_edges()
    logger.info("=== Seed complete ===")
