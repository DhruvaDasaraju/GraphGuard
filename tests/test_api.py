"""
tests/test_api.py

API endpoint tests using FastAPI's test client.
Tests that don't require FalkorDB use mocking.
Integration tests that need FalkorDB are skipped when unavailable.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.models import ServiceNode, VulnerabilityNode, OwnerNode

client = TestClient(app)


# ── Health Endpoints ───────────────────────────────────────────────────────────

class TestHealthEndpoints:
    def test_simple_health_ok(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data

    def test_api_health_structure(self):
        """Test /api/health returns correct schema (mock DB check)."""
        with patch("app.main.db_health_check") as mock_health:
            mock_health.return_value = {"healthy": True, "detail": "ok"}
            resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "falkordb_connected" in data
        assert "llm_enabled" in data
        assert "demo_mode" in data

    def test_api_health_db_unreachable(self):
        """When DB is down, status should be 'degraded', not 500."""
        with patch("app.main.db_health_check") as mock_health:
            mock_health.return_value = {"healthy": False, "detail": "Connection refused"}
            resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "degraded"
        assert data["falkordb_connected"] is False


# ── Service Endpoints ──────────────────────────────────────────────────────────

class TestServiceEndpoints:
    def test_list_services_ok(self):
        mock_svc = ServiceNode(id="svc-1", name="Payment Service", criticality="critical")
        with patch("app.main.list_services", return_value=[mock_svc]):
            resp = client.get("/api/services")
        assert resp.status_code == 200
        data = resp.json()
        assert "services" in data
        assert data["count"] == 1
        assert data["services"][0]["id"] == "svc-1"

    def test_get_service_detail_ok(self):
        mock_svc = ServiceNode(id="svc-1", name="Payment Service", criticality="critical")
        mock_vuln = VulnerabilityNode(id="vuln-1", title="SQL Injection", severity="critical")
        mock_owner = OwnerNode(id="owner-2", name="Bob Patel", team="Payments Team")
        with (
            patch("app.main.get_service_by_id", return_value=mock_svc),
            patch("app.main.get_vulnerabilities_for_service", return_value=[mock_vuln]),
            patch("app.main.get_owner_for_service", return_value=mock_owner),
            patch("app.main.count_reachable_dependents", return_value=3),
            patch("app.main.max_observed_depth", return_value=2),
        ):
            resp = client.get("/api/services/svc-1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["service"]["id"] == "svc-1"
        assert len(data["vulnerabilities"]) == 1
        assert data["owner"]["name"] == "Bob Patel"

    def test_get_service_not_found(self):
        with patch("app.main.get_service_by_id", return_value=None):
            resp = client.get("/api/services/svc-9999")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_list_services_db_error(self):
        with patch("app.main.list_services", side_effect=RuntimeError("Connection lost")):
            resp = client.get("/api/services")
        assert resp.status_code == 503


# ── Vulnerability Endpoints ────────────────────────────────────────────────────

class TestVulnerabilityEndpoints:
    def test_list_vulnerabilities_ok(self):
        mock_vuln = VulnerabilityNode(id="vuln-1", title="SQL Injection", severity="critical")
        with (
            patch("app.main.list_vulnerabilities", return_value=[mock_vuln]),
            patch("app.graph_queries.get_services_for_vulnerability", return_value=[]),
        ):
            resp = client.get("/api/vulnerabilities")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["vulnerabilities"][0]["severity"] == "critical"


# ── Graph Endpoint ─────────────────────────────────────────────────────────────

class TestGraphEndpoint:
    def test_graph_endpoint_structure(self):
        mock_data = {
            "nodes": [{"id": "svc-1", "label": "Payment Service", "node_type": "SERVICE", "properties": {}}],
            "edges": [{"source": "svc-2", "target": "svc-1", "relationship": "DEPENDS_ON"}],
            "node_count": 1,
            "edge_count": 1,
        }
        with patch("app.main.get_graph_visualization_data", return_value=mock_data):
            resp = client.get("/api/graph")
        assert resp.status_code == 200
        data = resp.json()
        assert "nodes" in data
        assert "edges" in data
        assert "node_count" in data


# ── Ticket Endpoints ───────────────────────────────────────────────────────────

class TestTicketEndpoints:
    def test_list_tickets_ok(self):
        with patch("app.main.get_tickets", return_value=[]):
            resp = client.get("/api/tickets")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["tickets"] == []

    def test_get_ticket_not_found(self):
        with patch("app.main.get_ticket_by_id", return_value=None):
            resp = client.get("/api/tickets/ticket-NOTEXIST")
        assert resp.status_code == 404

    def test_create_ticket_invalid_entity(self):
        """Ticket creation with missing entity should return 422."""
        from app.ticket_service import TicketCreationError
        with (
            patch("app.main.find_all_dependents", return_value=[]),
            patch("app.main.create_remediation_ticket",
                  side_effect=TicketCreationError("Service not found")),
        ):
            resp = client.post("/api/tickets", json={
                "service_id": "svc-INVALID",
                "vulnerability_id": "vuln-1",
                "reason": "test",
            })
        assert resp.status_code == 422


# ── Agent Query Endpoint ───────────────────────────────────────────────────────

class TestAgentQueryEndpoint:
    def test_agent_query_requires_question(self):
        resp = client.post("/api/agent/query", json={})
        assert resp.status_code == 422

    def test_agent_query_question_too_short(self):
        resp = client.post("/api/agent/query", json={"question": "hi"})
        assert resp.status_code == 422

    def test_agent_query_structure(self):
        """Agent returns a structured investigation result."""
        from app.models import InvestigationResult
        mock_result = InvestigationResult(
            investigation_id="inv-test123",
            mode="deterministic_demo",
            question="Investigate Payment Service",
            limitations=["Test mode"],
        )
        with patch("app.main.GraphGuardAgent") as MockAgent:
            instance = MockAgent.return_value
            instance.investigate = MagicMock(return_value=mock_result)
            # Need async mock
            import asyncio
            async def fake_investigate(*args, **kwargs):
                return mock_result
            instance.investigate = fake_investigate
            resp = client.post("/api/agent/query", json={
                "question": "Investigate Payment Service vulnerabilities"
            })
        assert resp.status_code == 200
        data = resp.json()
        assert "investigation_id" in data
        assert "mode" in data
