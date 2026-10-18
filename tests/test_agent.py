"""
tests/test_agent.py

Agent tests covering:
- demo mode labelling
- tool call limit enforcement
- unknown service handling
- structure of the returned investigation result
- ticket creation failure handling

Unit tests use mocks; integration tests require FalkorDB.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.agent import GraphGuardAgent
from app.models import InvestigationResult


# ── Unit Tests (no DB required) ────────────────────────────────────────────────

class TestAgentDemoMode:
    def test_demo_mode_is_labelled_correctly(self):
        """With no API key and demo mode on, mode must be 'deterministic_demo'."""
        from app.config import settings
        agent = GraphGuardAgent()
        assert not settings.llm_enabled  # default .env has no key

        # Patch MCP client so we don't need a live server
        mock_tool_result_svc = {
            "service": {"id": "svc-1", "name": "Payment Service",
                        "criticality": "critical", "description": "",
                        "environment": "production", "owner_id": "owner-2"},
            "vulnerabilities": [{"id": "vuln-1", "title": "SQL Injection",
                                  "severity": "critical", "description": "",
                                  "affected_version": "", "status": "open"}],
            "owner": {"id": "owner-2", "name": "Bob Patel", "team": "Payments", "contact": "b@x.com"},
            "direct_dependent_count": 2,
        }
        mock_tool_result_deps = {
            "impacted_services": [],
            "total_impacted_count": 0,
            "max_observed_depth": 0,
            "target_service": mock_tool_result_svc["service"],
        }
        mock_tool_result_rank = {"findings": [], "service": mock_tool_result_svc["service"]}

        call_map = {
            "investigate_service": mock_tool_result_svc,
            "trace_dependencies": mock_tool_result_deps,
            "rank_findings": mock_tool_result_rank,
            "get_service_owner": {"owner": {"id": "owner-2", "name": "Bob",
                                             "team": "Payments", "contact": "b@x.com"}},
        }

        class FakeClient:
            def get_tool_schemas_for_llm(self):
                return [{"name": k, "description": "", "input_schema": {}} for k in call_map]

            def get_available_tools(self):
                return [MagicMock(name=k) for k in call_map]

            async def call_tool(self, name, args):
                return call_map.get(name, {"error": f"Unknown: {name}"})

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

        async def run():
            with patch("app.agent.GraphGuardMCPClient", return_value=FakeClient()):
                result = await agent.investigate(
                    "Investigate Payment Service",
                    create_ticket=False,
                )
            assert result.mode == "deterministic_demo"
            return result

        result = asyncio.run(run())
        assert result.mode == "deterministic_demo"

    def test_unknown_service_returns_error_not_invented(self):
        """Agent must not invent data for a service that doesn't exist."""
        agent = GraphGuardAgent()

        class FakeClientUnknown:
            def get_tool_schemas_for_llm(self):
                return [{"name": "investigate_service", "description": "", "input_schema": {}}]

            def get_available_tools(self):
                return [MagicMock()]

            async def call_tool(self, name, args):
                return {"error": "Service 'svc-FAKE' not found in graph", "service": None}

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

        async def run():
            with patch("app.agent.GraphGuardMCPClient", return_value=FakeClientUnknown()):
                result = await agent.investigate("Investigate svc-FAKE")
            return result

        result = asyncio.run(run())
        assert result.error is not None
        # Must not have invented service data
        assert not result.vulnerabilities_found
        assert not result.impacted_services


class TestAgentToolLimitEnforcement:
    def test_max_tool_calls_enforced(self):
        """Agent must stop at AGENT_MAX_TOOL_CALLS and not loop forever."""
        from app.config import settings
        max_calls = settings.AGENT_MAX_TOOL_CALLS

        call_count = 0

        class FakeClientLooping:
            def get_tool_schemas_for_llm(self):
                # Return one tool that keeps being called
                return [{"name": "investigate_service", "description": "", "input_schema": {}}]

            def get_available_tools(self):
                return [MagicMock()]

            async def call_tool(self, name, args):
                nonlocal call_count
                call_count += 1
                return {"error": "no data"}

            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

        agent = GraphGuardAgent()

        async def run():
            with patch("app.agent.GraphGuardMCPClient", return_value=FakeClientLooping()):
                result = await agent.investigate("keep calling tools forever")
            return result

        asyncio.run(run())
        # Total tool invocations must not exceed max_calls
        assert call_count <= max_calls, f"Made {call_count} calls, limit is {max_calls}"


# ── Integration Tests (need FalkorDB) ─────────────────────────────────────────

from app.graph_db import db_health_check, reset_connection


def db_available():
    try:
        reset_connection()
        return db_health_check()["healthy"]
    except Exception:
        return False


DB_AVAILABLE = db_available()


@pytest.mark.skipif(
    not DB_AVAILABLE,
    reason="FalkorDB not reachable — skipping agent integration tests",
)
class TestAgentIntegration:
    @pytest.fixture(autouse=True)
    def seed(self):
        from app.seed_data import seed_all
        seed_all()

    def test_demo_investigation_returns_real_graph_data(self):
        """Full end-to-end: agent calls MCP → MCP queries FalkorDB → returns real data."""
        agent = GraphGuardAgent()

        result = asyncio.run(agent.investigate(
            "Investigate the critical vulnerability in Payment Service. "
            "Which services are affected?",
            create_ticket=False,
        ))

        assert result.mode == "deterministic_demo"
        assert result.target_entity == "svc-1"
        assert len(result.vulnerabilities_found) >= 1
        assert result.vulnerabilities_found[0].severity == "critical"
        assert result.tool_call_history  # Must have actually called tools
        assert all(r.success or r.error for r in result.tool_call_history)

    def test_demo_investigation_with_ticket_creation(self):
        """Agent creates a real ticket in FalkorDB when create_ticket=True."""
        agent = GraphGuardAgent()

        result = asyncio.run(agent.investigate(
            "Investigate Payment Service and create a remediation ticket.",
            create_ticket=True,
        ))

        assert result.ticket is not None
        assert result.ticket.status == "PROPOSED"
        assert result.ticket.priority in {"P1", "P2", "P3", "P4"}

        # Verify the ticket is actually in the DB
        from app.graph_queries import get_ticket_by_id
        persisted = get_ticket_by_id(result.ticket.id)
        assert persisted is not None

    def test_tool_call_history_is_accurate(self):
        """Tool call history must reflect actual MCP invocations."""
        agent = GraphGuardAgent()

        result = asyncio.run(agent.investigate(
            "Investigate Checkout Service",
            create_ticket=False,
        ))

        tool_names_called = [r.tool_name for r in result.tool_call_history]
        # At minimum, investigate_service should have been called
        assert "investigate_service" in tool_names_called
