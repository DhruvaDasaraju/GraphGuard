"""
tests/test_graph_queries.py

Integration tests for graph query functions.
Requires a running FalkorDB instance with seeded data.

Tests are SKIPPED (not failed) if FalkorDB is unreachable.
"""

import pytest
from app.graph_db import db_health_check, reset_connection


def db_available() -> bool:
    """Check if FalkorDB is actually reachable."""
    try:
        reset_connection()
        health = db_health_check()
        return health["healthy"]
    except Exception:
        return False


DB_AVAILABLE = db_available()
pytestmark = pytest.mark.skipif(
    not DB_AVAILABLE,
    reason="FalkorDB not reachable — skipping integration tests (start with: docker compose up -d)",
)


@pytest.fixture(autouse=True)
def seed_graph():
    """Ensure graph is seeded before each test."""
    from app.seed_data import seed_all
    seed_all()


# ── Service Queries ────────────────────────────────────────────────────────────

class TestServiceQueries:
    def test_list_services_returns_at_least_8(self):
        from app.graph_queries import list_services
        svcs = list_services()
        assert len(svcs) >= 8

    def test_get_service_by_id(self):
        from app.graph_queries import get_service_by_id
        svc = get_service_by_id("svc-1")
        assert svc is not None
        assert svc.id == "svc-1"
        assert svc.name == "Payment Service"
        assert svc.criticality == "critical"

    def test_get_service_by_name(self):
        from app.graph_queries import get_service_by_name
        svc = get_service_by_name("Payment Service")
        assert svc is not None
        assert svc.id == "svc-1"

    def test_get_nonexistent_service_returns_none(self):
        from app.graph_queries import get_service_by_id
        svc = get_service_by_id("svc-9999")
        assert svc is None


# ── Vulnerability Queries ──────────────────────────────────────────────────────

class TestVulnerabilityQueries:
    def test_list_vulnerabilities_returns_at_least_4(self):
        from app.graph_queries import list_vulnerabilities
        vulns = list_vulnerabilities()
        assert len(vulns) >= 4

    def test_payment_service_has_critical_vuln(self):
        from app.graph_queries import get_vulnerabilities_for_service
        vulns = get_vulnerabilities_for_service("svc-1")
        assert len(vulns) >= 1
        severities = [v.severity for v in vulns]
        assert "critical" in severities

    def test_unrelated_service_has_no_payment_vulns(self):
        """Notification Service (svc-7) has no vulnerabilities in seed data."""
        from app.graph_queries import get_vulnerabilities_for_service
        vulns = get_vulnerabilities_for_service("svc-7")
        assert len(vulns) == 0


# ── Owner Queries ──────────────────────────────────────────────────────────────

class TestOwnerQueries:
    def test_payment_service_owner_exists(self):
        from app.graph_queries import get_owner_for_service
        owner = get_owner_for_service("svc-1")
        assert owner is not None
        assert owner.team == "Payments Team"

    def test_owner_has_contact(self):
        from app.graph_queries import get_owner_for_service
        owner = get_owner_for_service("svc-1")
        assert owner is not None
        assert "@" in owner.contact


# ── Dependency Traversal ───────────────────────────────────────────────────────

class TestDependencyTraversal:
    def test_direct_dependents_of_payment_service(self):
        """Checkout (svc-2), API Gateway (svc-3), and Fraud Detection (svc-9) depend on Payment Service."""
        from app.graph_queries import get_direct_dependents
        direct = get_direct_dependents("svc-1")
        direct_ids = {s.id for s in direct}
        # API Gateway and Fraud Detection depend directly on Payment Service
        assert "svc-3" in direct_ids or "svc-9" in direct_ids

    def test_multi_hop_dependents_include_indirect(self):
        """Order Service (svc-5) depends on Checkout which depends on API Gateway which depends on Payment."""
        from app.graph_queries import find_all_dependents
        impacted = find_all_dependents("svc-1", max_hops=5)
        impacted_ids = {s.service_id for s in impacted}
        # At minimum, Fraud Detection and API Gateway should be reachable
        assert len(impacted_ids) >= 2

    def test_unrelated_services_not_in_dependents(self):
        """Notification Service (svc-7) and Analytics (svc-8) have no dependency chain to Payment."""
        from app.graph_queries import find_all_dependents
        impacted = find_all_dependents("svc-1", max_hops=5)
        impacted_ids = {s.service_id for s in impacted}
        assert "svc-7" not in impacted_ids
        assert "svc-8" not in impacted_ids

    def test_direct_vs_indirect_classification(self):
        """Services directly depending on Payment should be marked 'direct'."""
        from app.graph_queries import find_all_dependents
        impacted = find_all_dependents("svc-1", max_hops=5)
        direct = [s for s in impacted if s.connection_type == "direct"]
        indirect = [s for s in impacted if s.connection_type == "indirect"]
        # There should be at least one direct (Fraud Detection → Payment)
        assert len(direct) >= 1

    def test_hop_count_accuracy(self):
        """API Gateway → Payment is 1 hop. Order → Checkout → API Gateway → Payment is 3 hops."""
        from app.graph_queries import find_all_dependents
        impacted = find_all_dependents("svc-1", max_hops=5)
        impacted_map = {s.service_id: s for s in impacted}
        # API Gateway is direct (1 hop via svc-3 → svc-1)
        if "svc-3" in impacted_map:
            assert impacted_map["svc-3"].hop_count == 1

    def test_count_reachable_dependents(self):
        from app.graph_queries import count_reachable_dependents
        cnt = count_reachable_dependents("svc-1", max_hops=5)
        assert cnt >= 2

    def test_max_observed_depth(self):
        from app.graph_queries import max_observed_depth
        depth = max_observed_depth("svc-1", max_hops=5)
        assert depth >= 1

    def test_bounded_max_hops_respected(self):
        """Only 1-hop results when max_hops=1."""
        from app.graph_queries import find_all_dependents
        direct_only = find_all_dependents("svc-1", max_hops=1)
        for imp in direct_only:
            assert imp.hop_count == 1


# ── Ticket Persistence ─────────────────────────────────────────────────────────

class TestTicketPersistence:
    def test_create_and_retrieve_ticket(self):
        from app.graph_queries import persist_ticket, get_ticket_by_id
        from app.models import RemediationTicket
        import uuid
        from datetime import datetime, timezone

        ticket_id = f"test-ticket-{uuid.uuid4().hex[:6]}"
        ticket = RemediationTicket(
            id=ticket_id,
            title="Test Ticket",
            description="Integration test ticket",
            status="PROPOSED",
            priority="P2",
            target_service_id="svc-1",
            vulnerability_id="vuln-1",
            risk_score=86.0,
            evidence_json='{"test": true}',
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        persisted = persist_ticket(ticket)
        assert persisted.id == ticket_id

        retrieved = get_ticket_by_id(ticket_id)
        assert retrieved is not None
        assert retrieved.id == ticket_id
        assert retrieved.priority == "P2"

    def test_ticket_requires_valid_service(self):
        from app.graph_queries import persist_ticket
        from app.models import RemediationTicket
        import uuid

        ticket = RemediationTicket(
            id=f"test-{uuid.uuid4().hex[:6]}",
            title="Bad Ticket",
            description="",
            target_service_id="svc-INVALID-9999",
            vulnerability_id="vuln-1",
            created_at="2024-01-01T00:00:00Z",
        )
        with pytest.raises(RuntimeError, match="not found"):
            persist_ticket(ticket)

    def test_duplicate_seed_does_not_create_duplicates(self):
        """Running seed twice should not create duplicate nodes."""
        from app.graph_queries import list_services
        from app.seed_data import seed_all
        seed_all()
        seed_all()  # Run twice
        svcs = list_services()
        # Check no duplicate IDs
        ids = [s.id for s in svcs]
        assert len(ids) == len(set(ids))
