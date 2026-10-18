"""
tests/test_openai_agent.py

Mocked unit tests for OpenAI Responses API integration in GraphGuardAgent.
Tests:
- OpenAI provider configuration and model settings.
- Deterministic fallback when OpenAI API key is missing.
- MCP tool definition conversion to OpenAI function schemas.
- Single-turn and multi-turn function calling with OpenAI Responses API.
- Tool argument bounds validation and priority sanitization.
- Unauthorized tool call blocking (e.g. raw cypher rejection).
- OpenAI API error fallback to deterministic demo mode.
- Iteration limit enforcement (AGENT_MAX_TOOL_CALLS).
- Evidence-based report integrity adhering to the InvestigationResult schema.
- Compatibility with Gemini provider and demo mode.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch
import pytest

from app.agent import GraphGuardAgent, _build_openai_tools
from app.config import settings
from app.models import InvestigationResult


def _create_mock_response(function_calls=None, output_text=None):
    """Helper to create mocked OpenAI Responses API response objects."""
    resp = MagicMock()
    items = []
    if function_calls:
        for fc in function_calls:
            item = MagicMock()
            item.type = "function_call"
            item.id = fc.get("id", f"call_item_{fc.get('name')}")
            item.call_id = fc.get("call_id", f"call_{fc.get('name')}")
            item.name = fc.get("name")
            item.arguments = json.dumps(fc.get("args", {})) if isinstance(fc.get("args"), dict) else fc.get("args")
            item.model_dump.return_value = {
                "type": "function_call",
                "id": item.id,
                "call_id": item.call_id,
                "name": item.name,
                "arguments": item.arguments,
            }
            items.append(item)
    if output_text:
        msg_item = MagicMock()
        msg_item.type = "message"
        msg_item.content = [{"type": "output_text", "text": output_text}]
        items.append(msg_item)
        resp.output_text = output_text
    else:
        resp.output_text = None

    resp.output = items
    return resp


class FakeMCPClient:
    """Mocked in-memory MCP client providing standard security investigation tool results."""

    def __init__(self):
        self.call_log = []
        self._mock_tool_result_svc = {
            "service": {
                "id": "svc-1",
                "name": "Payment Service",
                "criticality": "critical",
                "description": "Processes payments",
                "environment": "production",
                "owner_id": "owner-2",
            },
            "vulnerabilities": [
                {
                    "id": "vuln-1",
                    "title": "SQL Injection in Payment Gateway",
                    "severity": "critical",
                    "description": "Unsanitized SQL input",
                    "affected_version": "1.0.0",
                    "status": "open",
                }
            ],
            "owner": {
                "id": "owner-2",
                "name": "Bob Patel",
                "team": "Payments",
                "contact": "bob@example.com",
            },
            "direct_dependent_count": 2,
        }
        self._mock_tool_result_deps = {
            "impacted_services": [
                {
                    "service_id": "svc-2",
                    "service_name": "Checkout Service",
                    "criticality": "critical",
                    "connection_type": "direct",
                    "hop_count": 1,
                    "owner": {"id": "owner-1", "name": "Alice Smith", "team": "Checkout", "contact": "alice@example.com"},
                },
                {
                    "service_id": "svc-3",
                    "service_name": "API Gateway",
                    "criticality": "critical",
                    "connection_type": "indirect",
                    "hop_count": 2,
                    "owner": {"id": "owner-3", "name": "Carol Wang", "team": "Platform", "contact": "carol@example.com"},
                },
            ],
            "total_impacted_count": 2,
            "max_observed_depth": 2,
            "target_service": self._mock_tool_result_svc["service"],
        }
        self._mock_tool_result_rank = {
            "service": self._mock_tool_result_svc["service"],
            "findings": [
                {
                    "vulnerability_id": "vuln-1",
                    "vulnerability_title": "SQL Injection in Payment Gateway",
                    "severity": "critical",
                    "severity_base": 40.0,
                    "impact_bonus": 30.0,
                    "depth_bonus": 20.0,
                    "risk_score": 90.0,
                    "priority": "P1",
                    "affected_service_count": 2,
                    "observed_depth": 2,
                    "explanation": "Critical vulnerability impacting 2 upstream services",
                }
            ],
        }

    def get_tool_schemas_for_llm(self):
        return [
            {
                "name": "investigate_service",
                "description": "Investigate a service",
                "input_schema": {
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                    "required": ["service_id"],
                },
            },
            {
                "name": "trace_dependencies",
                "description": "Trace dependent services",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "service_id": {"type": "string"},
                        "max_hops": {"type": "integer"},
                    },
                    "required": ["service_id"],
                },
            },
            {
                "name": "rank_findings",
                "description": "Rank vulnerability findings",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "service_id": {"type": "string"},
                        "max_hops": {"type": "integer"},
                    },
                    "required": ["service_id"],
                },
            },
            {
                "name": "get_service_owner",
                "description": "Get owner info",
                "input_schema": {
                    "type": "object",
                    "properties": {"service_id": {"type": "string"}},
                    "required": ["service_id"],
                },
            },
            {
                "name": "create_remediation_ticket_tool",
                "description": "Create remediation ticket",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "service_id": {"type": "string"},
                        "vulnerability_id": {"type": "string"},
                        "reason": {"type": "string"},
                        "priority": {"type": "string"},
                        "recommended_steps": {"type": "array"},
                    },
                    "required": ["service_id", "vulnerability_id", "reason"],
                },
            },
            {
                "name": "list_tickets",
                "description": "List tickets",
                "input_schema": {"type": "object", "properties": {}},
            },
        ]

    def get_openai_tool_schemas(self):
        schemas = self.get_tool_schemas_for_llm()
        return _build_openai_tools(schemas)

    async def call_tool(self, name: str, args: dict):
        self.call_log.append((name, args))
        if name == "investigate_service":
            return self._mock_tool_result_svc
        elif name == "trace_dependencies":
            return self._mock_tool_result_deps
        elif name == "rank_findings":
            return self._mock_tool_result_rank
        elif name == "get_service_owner":
            return {"owner": {"id": "owner-2", "name": "Bob Patel", "team": "Payments", "contact": "bob@example.com"}}
        elif name == "create_remediation_ticket_tool":
            return {
                "success": True,
                "ticket": {
                    "id": "ticket-mock-1",
                    "title": f"Remediate {args.get('vulnerability_id')} on {args.get('service_id')}",
                    "description": args.get("reason", ""),
                    "status": "PROPOSED",
                    "priority": args.get("priority", "P2"),
                    "target_service_id": args.get("service_id", ""),
                    "vulnerability_id": args.get("vulnerability_id", ""),
                    "risk_score": 90.0,
                    "evidence_json": "{}",
                    "created_at": "2026-10-18T10:00:00",
                },
            }
        return {"error": f"Unknown tool '{name}'"}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


class TestOpenAIAgent:

    def test_openai_provider_configuration(self):
        """Verify OpenAI provider settings, model configuration, and defaults."""
        agent = GraphGuardAgent(api_key="mock-key", model="gpt-4o-custom", provider="openai")
        assert agent.provider == "openai"
        assert agent.api_key == "mock-key"
        assert agent.model_name == "gpt-4o-custom"

        # Verify default model fallback from settings
        agent_default = GraphGuardAgent(api_key="mock-key", provider="openai")
        assert agent_default.model_name == settings.OPENAI_MODEL

    @pytest.mark.asyncio
    async def test_openai_missing_api_key_deterministic_fallback(self):
        """Verify missing OpenAI API key triggers explicitly labelled deterministic demo mode."""
        agent = GraphGuardAgent(api_key="", provider="openai")
        fake_client = FakeMCPClient()

        with patch("app.agent.GraphGuardMCPClient", return_value=fake_client):
            result = await agent.investigate("Investigate Payment Service")

        assert isinstance(result, InvestigationResult)
        assert result.mode == "deterministic_demo"
        assert result.is_demo_mode is True
        assert result.target_entity == "svc-1"
        assert len(result.vulnerabilities_found) >= 1
        assert len(result.impacted_services) >= 1
        assert len(result.risk_scores) >= 1

    def test_openai_mcp_tool_definitions(self):
        """Verify MCP tools are correctly adapted into OpenAI Responses API function declarations."""
        client = FakeMCPClient()
        schemas = client.get_tool_schemas_for_llm()
        openai_tools = _build_openai_tools(schemas)
        tool_names = [t["name"] for t in openai_tools]

        assert "investigate_service" in tool_names
        assert "trace_dependencies" in tool_names
        assert "rank_findings" in tool_names
        assert "get_service_owner" in tool_names
        assert "create_remediation_ticket_tool" in tool_names

        for t in openai_tools:
            assert t["type"] == "function"
            assert "parameters" in t
            assert t["parameters"]["type"] == "object"
            assert t["strict"] is False

    @pytest.mark.asyncio
    async def test_openai_single_turn_function_calling_and_mcp_execution(self):
        """Verify single-turn function calling with mocked OpenAI client and real MCP tool execution."""
        agent = GraphGuardAgent(api_key="mock-key", provider="openai")
        mock_client = MagicMock()
        agent._openai_client = mock_client
        fake_mcp = FakeMCPClient()

        turn1_resp = _create_mock_response(
            function_calls=[{"name": "investigate_service", "args": {"service_id": "svc-1"}}]
        )
        turn2_resp = _create_mock_response(
            output_text="Completed verified investigation of Payment Service."
        )
        mock_client.responses.create.side_effect = [turn1_resp, turn2_resp]

        original_override = settings._demo_mode_override
        try:
            settings.is_demo_mode = False
            with patch("app.agent.GraphGuardMCPClient", return_value=fake_mcp):
                result = await agent.investigate("Investigate svc-1")

            assert result.mode == "autonomous_llm"
            assert result.is_demo_mode is False
            assert "Completed verified investigation of Payment Service." in result.llm_summary
            assert result.target_entity == "svc-1"
            assert len(result.vulnerabilities_found) >= 1
            assert any(call[0] == "investigate_service" for call in fake_mcp.call_log)
        finally:
            settings.is_demo_mode = original_override

    @pytest.mark.asyncio
    async def test_openai_tool_argument_validation_and_bounds(self):
        """Verify tool argument validation clamps max_hops and sanitizes priority safely."""
        agent = GraphGuardAgent(api_key="mock-key", provider="openai")
        mock_client = MagicMock()
        agent._openai_client = mock_client
        fake_mcp = FakeMCPClient()

        turn1 = _create_mock_response(
            function_calls=[
                {"name": "trace_risk", "args": {"service_id": "svc-1", "max_hops": 100}},
                {"name": "create_remediation_ticket", "args": {
                    "service_id": "svc-1",
                    "vulnerability_id": "vuln-1",
                    "reason": "Test ticket reason",
                    "priority": "INVALID_PRIORITY",
                }},
            ]
        )
        turn2 = _create_mock_response(output_text="Sanitized execution completed.")
        mock_client.responses.create.side_effect = [turn1, turn2]

        original_override = settings._demo_mode_override
        try:
            settings.is_demo_mode = False
            with patch("app.agent.GraphGuardMCPClient", return_value=fake_mcp):
                result = await agent.investigate("Audit svc-1")

            assert result.mode == "autonomous_llm"
            # Verify tool calls reached FakeMCPClient with sanitized arguments
            trace_call = next(c for c in fake_mcp.call_log if c[0] == "trace_dependencies")
            assert trace_call[1]["max_hops"] == 5  # clamped from 100

            ticket_call = next(c for c in fake_mcp.call_log if c[0] == "create_remediation_ticket_tool")
            assert ticket_call[1]["priority"] == "P2"  # fallback from INVALID_PRIORITY
        finally:
            settings.is_demo_mode = original_override

    @pytest.mark.asyncio
    async def test_openai_unauthorized_tool_call_blocked(self):
        """Verify model cannot execute unrestricted Cypher or unauthorized tools."""
        agent = GraphGuardAgent(api_key="mock-key", provider="openai")
        mock_client = MagicMock()
        agent._openai_client = mock_client
        fake_mcp = FakeMCPClient()

        turn1 = _create_mock_response(
            function_calls=[{"name": "execute_raw_cypher", "args": {"query": "MATCH (n) DETACH DELETE n"}}]
        )
        turn2 = _create_mock_response(output_text="Handled rejection.")
        mock_client.responses.create.side_effect = [turn1, turn2]

        original_override = settings._demo_mode_override
        try:
            settings.is_demo_mode = False
            with patch("app.agent.GraphGuardMCPClient", return_value=fake_mcp):
                result = await agent.investigate("Exploit attempt")

            turn2_kwargs = mock_client.responses.create.call_args_list[1].kwargs
            output_item = next(i for i in turn2_kwargs["input"] if i.get("type") == "function_call_output")
            payload = json.loads(output_item["output"])
            assert "error" in payload
            assert "not allowed" in payload["error"]
        finally:
            settings.is_demo_mode = original_override

    @pytest.mark.asyncio
    async def test_openai_api_error_fallback(self):
        """Verify API errors during OpenAI execution gracefully fall back to deterministic mode."""
        agent = GraphGuardAgent(api_key="mock-key", provider="openai")
        mock_client = MagicMock()
        mock_client.responses.create.side_effect = RuntimeError("OpenAI rate limit or network unreachable")
        agent._openai_client = mock_client
        fake_mcp = FakeMCPClient()

        original_override = settings._demo_mode_override
        try:
            settings.is_demo_mode = False
            with patch("app.agent.GraphGuardMCPClient", return_value=fake_mcp):
                result = await agent.investigate("Investigate Payment Service")

            assert result.mode == "deterministic_demo"
            assert result.is_demo_mode is True
            assert any("OpenAI API execution error" in entry for entry in result.audit_trail)
            assert result.target_entity == "svc-1"
        finally:
            settings.is_demo_mode = original_override

    @pytest.mark.asyncio
    async def test_openai_iteration_limit_enforcement(self):
        """Verify loop terminates at AGENT_MAX_TOOL_CALLS if the model repeats requests."""
        agent = GraphGuardAgent(api_key="mock-key", provider="openai")
        mock_client = MagicMock()
        agent._openai_client = mock_client
        fake_mcp = FakeMCPClient()

        infinite_resp = _create_mock_response(
            function_calls=[{"name": "investigate_service", "args": {"service_id": "svc-1"}}]
        )
        mock_client.responses.create.return_value = infinite_resp

        original_max = settings.AGENT_MAX_TOOL_CALLS
        original_override = settings._demo_mode_override
        try:
            settings.AGENT_MAX_TOOL_CALLS = 3
            settings.is_demo_mode = False
            with patch("app.agent.GraphGuardMCPClient", return_value=fake_mcp):
                result = await agent.investigate("Endless query")

            assert mock_client.responses.create.call_count == 3
            assert "maximum iteration limit" in result.llm_summary.lower()
            assert result.mode == "autonomous_llm"
        finally:
            settings.AGENT_MAX_TOOL_CALLS = original_max
            settings.is_demo_mode = original_override

    @pytest.mark.asyncio
    async def test_evidence_based_report_integrity(self):
        """Verify investigation results are grounded in real tool outputs without hallucination."""
        agent = GraphGuardAgent(api_key="mock-key", provider="openai")
        mock_client = MagicMock()
        agent._openai_client = mock_client
        fake_mcp = FakeMCPClient()

        turn1 = _create_mock_response(
            function_calls=[
                {"name": "investigate_service", "args": {"service_id": "svc-1"}},
                {"name": "trace_dependencies", "args": {"service_id": "svc-1", "max_hops": 3}},
            ]
        )
        turn2 = _create_mock_response(output_text="Facts verified from graph.")
        mock_client.responses.create.side_effect = [turn1, turn2]

        original_override = settings._demo_mode_override
        try:
            settings.is_demo_mode = False
            with patch("app.agent.GraphGuardMCPClient", return_value=fake_mcp):
                result = await agent.investigate("Audit svc-1")

            assert result.target_entity == "svc-1"
            assert len(result.vulnerabilities_found) == 1
            assert len(result.impacted_services) == 2
            assert len(result.risk_scores) >= 1
            for r in result.risk_scores:
                assert r.risk_score > 0
                assert r.priority in ("P1", "P2", "P3", "P4")
        finally:
            settings.is_demo_mode = original_override

    @pytest.mark.asyncio
    async def test_gemini_and_demo_mode_compatibility(self):
        """Verify Gemini provider continues to work independently when provider='gemini'."""
        agent = GraphGuardAgent(api_key="mock-gemini-key", provider="gemini")
        assert agent.provider == "gemini"
        mock_genai = MagicMock()
        agent._genai_client = mock_genai
        fake_mcp = FakeMCPClient()

        fc = MagicMock()
        fc.name = "investigate_service"
        fc.args = {"service_id": "svc-1"}
        resp1 = MagicMock()
        resp1.function_calls = [fc]
        resp1.candidates = [MagicMock()]
        resp1.candidates[0].content = MagicMock()

        resp2 = MagicMock()
        resp2.function_calls = None
        resp2.text = "Gemini investigation completed."

        mock_genai.models.generate_content.side_effect = [resp1, resp2]

        original_override = settings._demo_mode_override
        try:
            settings.is_demo_mode = False
            with patch("app.agent.GraphGuardMCPClient", return_value=fake_mcp):
                result = await agent.investigate("Investigate svc-1")

            assert result.mode == "autonomous_llm"
            assert result.is_demo_mode is False
            assert "Gemini investigation completed." in result.llm_summary
        finally:
            settings.is_demo_mode = original_override
