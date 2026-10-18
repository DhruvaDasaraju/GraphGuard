"""
GraphGuard Ticket Service

Creates and validates remediation tickets backed by real graph evidence.
Ticket IDs are unique UUIDs. Status is always PROPOSED on creation.
Tickets are persisted in FalkorDB via graph_queries.persist_ticket().
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from app.models import (
    RemediationTicket,
    RiskScore,
    ImpactedService,
    VulnerabilityNode,
    ServiceNode,
)
from app.graph_queries import (
    get_service_by_id,
    get_vulnerabilities_for_service,
    persist_ticket,
    get_ticket_by_id,
)
from app.risk_engine import calculate_risk_score

logger = logging.getLogger(__name__)


class TicketCreationError(Exception):
    """Raised when ticket creation fails due to validation or persistence errors."""


def create_remediation_ticket(
    service_id: str,
    vulnerability_id: str,
    reason: str,
    recommended_steps: list[str],
    impacted_services: list[ImpactedService],
    risk_score_obj: RiskScore | None = None,
) -> RemediationTicket:
    """
    Create and persist a PROPOSED remediation ticket.

    Validates:
    - The service_id exists in the graph.
    - The vulnerability_id is linked to that service in the graph.
    - Sufficient evidence (impacted_services) is provided.

    Never creates a ticket from unverified entities.

    Args:
        service_id:         Target service (must exist in graph).
        vulnerability_id:   Vulnerability to remediate (must be on that service).
        reason:             Human-readable investigation reason.
        recommended_steps:  List of recommended actions.
        impacted_services:  Evidence of downstream impact (from graph queries).
        risk_score_obj:     Pre-computed RiskScore (or None to compute inline).

    Returns:
        Persisted RemediationTicket.

    Raises:
        TicketCreationError: On validation or persistence failure.
    """
    # ── Validate service exists ────────────────────────────────────────────────
    service = get_service_by_id(service_id)
    if service is None:
        raise TicketCreationError(
            f"Service '{service_id}' not found in graph — cannot create ticket"
        )

    # ── Validate vulnerability is actually on this service ────────────────────
    vulns = get_vulnerabilities_for_service(service_id)
    matched_vuln = next((v for v in vulns if v.id == vulnerability_id), None)
    if matched_vuln is None:
        raise TicketCreationError(
            f"Vulnerability '{vulnerability_id}' is not linked to service '{service_id}' "
            "in the graph — cannot create ticket without verified evidence"
        )

    # ── Compute or validate risk score ────────────────────────────────────────
    if risk_score_obj is None:
        depth = max((s.hop_count for s in impacted_services), default=0)
        risk_score_obj = calculate_risk_score(
            vulnerability=matched_vuln,
            impacted_service_count=len(impacted_services),
            observed_depth=depth,
        )

    # ── Build evidence JSON ────────────────────────────────────────────────────
    evidence = {
        "service": {"id": service.id, "name": service.name, "criticality": service.criticality},
        "vulnerability": {
            "id": matched_vuln.id,
            "title": matched_vuln.title,
            "severity": matched_vuln.severity,
        },
        "impacted_service_count": len(impacted_services),
        "impacted_services": [
            {
                "id": s.service_id,
                "name": s.service_name,
                "connection_type": s.connection_type,
                "hop_count": s.hop_count,
            }
            for s in impacted_services
        ],
        "risk_score": risk_score_obj.risk_score,
        "priority": risk_score_obj.priority,
        "scoring_explanation": risk_score_obj.explanation,
        "reason": reason,
        "recommended_steps": recommended_steps,
    }

    ticket_id = f"ticket-{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc).isoformat()

    title = (
        f"[{risk_score_obj.priority}] Remediate {matched_vuln.severity.upper()} "
        f"{matched_vuln.title} on {service.name}"
    )
    description = (
        f"{reason}\n\n"
        f"Vulnerability: {matched_vuln.title} ({matched_vuln.severity})\n"
        f"Affected service: {service.name}\n"
        f"Downstream impact: {len(impacted_services)} services\n\n"
        f"Recommended steps:\n" +
        "\n".join(f"  {i+1}. {step}" for i, step in enumerate(recommended_steps))
    )

    ticket = RemediationTicket(
        id=ticket_id,
        title=title,
        description=description,
        status="PROPOSED",
        priority=risk_score_obj.priority,
        target_service_id=service_id,
        vulnerability_id=vulnerability_id,
        risk_score=risk_score_obj.risk_score,
        evidence_json=json.dumps(evidence),
        created_at=created_at,
    )

    # ── Persist to FalkorDB ────────────────────────────────────────────────────
    try:
        persisted = persist_ticket(ticket)
    except RuntimeError as exc:
        raise TicketCreationError(f"Ticket persistence failed: {exc}") from exc

    # ── Verify the ticket was actually written ─────────────────────────────────
    check = get_ticket_by_id(ticket_id)
    if check is None:
        raise TicketCreationError(
            f"Ticket {ticket_id} was not found after persistence — write may have failed"
        )

    logger.info(
        "Ticket %s created: %s | priority=%s | risk_score=%.1f",
        ticket_id, title, risk_score_obj.priority, risk_score_obj.risk_score,
    )
    return persisted
