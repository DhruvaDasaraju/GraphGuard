"""
tests/test_mcp_tools.py

MCP integration tests.
Requires a running FalkorDB instance with seeded data.
Skipped when FalkorDB is unavailable.
"""

import asyncio
import pytest
from app.graph_db import db_health_check, reset_connection


def db_available() -> bool:
    try:
        reset_connection()
        return db_health_check()["healthy"]
    except Exception:
        return False


DB_AVAILABLE = db_available()
pytestmark = pytest.mark.skipif(
    not DB_AVAILABLE,
    reason="FalkorDB not reachable — skipping MCP integration tests",
)


@pytest.fixture(autouse=True)
def seed():
    from app.seed_data import seed_all
    seed_all()


class TestMCPServer:
    """Test MCP server launch, tool discovery, and actual tool invocations."""

    def test_server_launches_and_discovers_tools(self):
        from app.mcp_client import GraphGuardMCPClient

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                tools = client.get_available_tools()
                tool_names = {t.name for t in tools}
                assert len(tools) >= 5, f"Expected ≥5 tools, got {len(tools)}"
                assert "investigate_service" in tool_names
                assert "trace_dependencies" in tool_names
                assert "rank_findings" in tool_names
                assert "get_service_owner" in tool_names
                assert "create_remediation_ticket_tool" in tool_names

        asyncio.run(run())

    def test_investigate_service_returns_real_data(self):
        from app.mcp_client import GraphGuardMCPClient

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                result = await client.call_tool("investigate_service", {"service_id": "svc-1"})
                assert "error" not in result, f"Got error: {result.get('error')}"
                assert result["service"]["name"] == "Payment Service"
                assert len(result["vulnerabilities"]) >= 1
                assert result["vulnerabilities"][0]["severity"] == "critical"

        asyncio.run(run())

    def test_trace_dependencies_returns_paths(self):
        from app.mcp_client import GraphGuardMCPClient

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                result = await client.call_tool("trace_dependencies", {
                    "service_id": "svc-1",
                    "max_hops": 5,
                })
                assert "error" not in result
                assert result["total_impacted_count"] >= 1
                # Each impacted service must have a path
                for svc in result["impacted_services"]:
                    assert svc["hop_count"] >= 1

        asyncio.run(run())

    def test_rank_findings_returns_scores(self):
        from app.mcp_client import GraphGuardMCPClient

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                result = await client.call_tool("rank_findings", {"service_id": "svc-1"})
                assert "error" not in result
                assert len(result["findings"]) >= 1
                top = result["findings"][0]
                assert "risk_score" in top
                assert "priority" in top
                assert "explanation" in top
                assert top["priority"] in {"P1", "P2", "P3", "P4"}

        asyncio.run(run())

    def test_get_service_owner_returns_owner(self):
        from app.mcp_client import GraphGuardMCPClient

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                result = await client.call_tool("get_service_owner", {"service_id": "svc-1"})
                assert "error" not in result
                assert result["owner"]["team"] == "Payments Team"

        asyncio.run(run())

    def test_create_ticket_persists_and_is_retrievable(self):
        from app.mcp_client import GraphGuardMCPClient

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                result = await client.call_tool("create_remediation_ticket_tool", {
                    "service_id": "svc-1",
                    "vulnerability_id": "vuln-1",
                    "reason": "MCP integration test: verifying ticket persistence",
                    "recommended_steps": ["Apply patch", "Notify team"],
                })
                assert result.get("success") is True, f"Ticket creation failed: {result}"
                ticket = result["ticket"]
                assert ticket["status"] == "PROPOSED"
                assert ticket["priority"] in {"P1", "P2", "P3", "P4"}

                # Verify ticket is retrievable via list_tickets
                list_result = await client.call_tool("list_tickets", {})
                ticket_ids = [t["id"] for t in list_result["tickets"]]
                assert ticket["id"] in ticket_ids

        asyncio.run(run())

    def test_unknown_tool_raises_error(self):
        from app.mcp_client import GraphGuardMCPClient, MCPClientError

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                with pytest.raises(MCPClientError, match="not in the discovered tool list"):
                    await client.call_tool("invented_tool_name", {})

        asyncio.run(run())

    def test_invalid_service_id_returns_error(self):
        from app.mcp_client import GraphGuardMCPClient

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                result = await client.call_tool("investigate_service", {"service_id": "svc-FAKE-9999"})
                assert "error" in result

        asyncio.run(run())

    def test_ticket_creation_fails_for_unlinked_vulnerability(self):
        """vuln-1 is on svc-1 but not on svc-7 — ticket creation should fail."""
        from app.mcp_client import GraphGuardMCPClient

        async def run():
            async with GraphGuardMCPClient(timeout=15) as client:
                result = await client.call_tool("create_remediation_ticket_tool", {
                    "service_id": "svc-7",
                    "vulnerability_id": "vuln-1",
                    "reason": "Should fail — unlinked vuln",
                    "recommended_steps": [],
                })
                assert result.get("success") is False
                assert "error" in result

        asyncio.run(run())
