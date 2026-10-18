"""
GraphGuard Agent

The investigation agent that:
1. Understands the user's question and identifies the target entity.
2. Discovers available tools from the MCP server.
3. In LLM mode: uses Gemini's native tool-calling to select and execute tools.
4. In demo mode: follows a deterministic investigation workflow.
5. Collects real evidence from FalkorDB via MCP tool calls.
6. Computes risk scores and creates remediation tickets when requested.
7. Returns a structured InvestigationResult — never invented data.

Mode selection:
- autonomous_llm:    GOOGLE_API_KEY is set and GRAPHGUARD_DEMO_MODE=false
- deterministic_demo: GRAPHGUARD_DEMO_MODE=true OR no API key configured

The agent enforces a hard limit of AGENT_MAX_TOOL_CALLS tool invocations.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from typing import Any

from app.config import settings
from app.mcp_client import GraphGuardMCPClient, MCPClientError
from app.models import (
    InvestigationResult,
    InvestigationExplanation,
    ToolCallRecord,
    ServiceNode,
    VulnerabilityNode,
    OwnerNode,
    RiskScore,
    ImpactedService,
    RemediationTicket,
)

logger = logging.getLogger(__name__)


# ── LLM integration ──────────────────────────────────────────────────────────

def _build_openai_tools(tool_schemas: list[dict]) -> list[dict]:
    """Convert MCP tool schemas into OpenAI Function tool definitions for Responses API."""
    openai_tools = []
    for schema in tool_schemas:
        openai_tools.append({
            "type": "function",
            "name": schema["name"],
            "description": schema.get("description", ""),
            "parameters": schema.get("input_schema", {"type": "object", "properties": {}}),
            "strict": False,
        })
    return openai_tools


def _build_gemini_tools(tool_schemas: list[dict]) -> list:
    """Convert MCP tool schemas into Gemini FunctionDeclaration list."""
    try:
        from google.genai import types

        declarations = []
        for schema in tool_schemas:
            input_schema = schema.get("input_schema", {})
            properties = input_schema.get("properties", {})

            # Build Gemini-compatible parameter schema
            params = types.Schema(
                type="OBJECT",
                properties={
                    k: types.Schema(
                        type=_json_type_to_gemini(v.get("type", "string")),
                        description=v.get("description", ""),
                    )
                    for k, v in properties.items()
                },
                required=input_schema.get("required", []),
            )

            declarations.append(
                types.FunctionDeclaration(
                    name=schema["name"],
                    description=schema.get("description", ""),
                    parameters=params,
                )
            )

        return [types.Tool(function_declarations=declarations)]
    except ImportError:
        logger.warning("google-genai not available — falling back to demo mode")
        return []


def _json_type_to_gemini(json_type: str) -> str:
    mapping = {
        "string": "STRING",
        "integer": "INTEGER",
        "number": "NUMBER",
        "boolean": "BOOLEAN",
        "array": "ARRAY",
        "object": "OBJECT",
    }
    return mapping.get(json_type.lower(), "STRING")


# ── Agent core ─────────────────────────────────────────────────────────────────

class GraphGuardAgent:
    """
    The GraphGuard investigation agent.
    All MCP tool calls go through GraphGuardMCPClient — never direct DB calls.
    Supports both OpenAI (Responses API) and Google Gemini providers with automatic
    deterministic demo mode fallback.
    """

    DEMO_TARGET_SERVICE = "svc-1"   # Payment Service — used in deterministic demo

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        provider: str | None = None,
    ):
        self.provider = (provider or settings.active_provider).strip().lower()
        if self.provider == "openai":
            self.api_key = api_key if api_key is not None else settings.OPENAI_API_KEY
            self.model_name = model or settings.OPENAI_MODEL
        else:
            self.provider = "gemini"
            self.api_key = api_key if api_key is not None else settings.GOOGLE_API_KEY
            self.model_name = model or settings.GOOGLE_MODEL

        self._openai_client = None
        self._genai_client = None

        if self.api_key and not settings.is_demo_mode:
            if self.provider == "openai":
                try:
                    import openai
                    self._openai_client = openai.OpenAI(api_key=self.api_key)
                except Exception as exc:
                    logger.error("Failed to initialize OpenAI Client: %s", exc)
                    self._openai_client = None
            elif self.provider == "gemini":
                try:
                    import google.genai as genai
                    self._genai_client = genai.Client(api_key=self.api_key)
                except Exception as exc:
                    logger.error("Failed to initialize Google GenAI Client: %s", exc)
                    self._genai_client = None

    async def run_investigation(self, prompt: str) -> InvestigationResult:
        """Alias for investigate() for cross-project compatibility."""
        return await self.investigate(question=prompt)

    def explain_investigation(
        self,
        result: InvestigationResult,
    ) -> InvestigationExplanation:
        """
        Explain an investigation result using the configured LLM and verified evidence.
        """
        from app.llm_explainer import explain_investigation_result
        return explain_investigation_result(
            result=result,
            api_key=self.api_key,
            model=self.model_name,
            client=self._openai_client,
        )


    async def investigate(
        self,
        question: str,
        create_ticket: bool = False,
    ) -> InvestigationResult:
        """
        Main entry point for an investigation.

        Args:
            question:      The user's natural-language question.
            create_ticket: If True and evidence is sufficient, create a ticket.

        Returns:
            InvestigationResult with full evidence, scores, and history.
        """
        from unittest.mock import MagicMock

        investigation_id = f"inv-{uuid.uuid4().hex[:10]}"

        active_provider = self.provider
        if isinstance(self._openai_client, MagicMock) and not isinstance(self._genai_client, MagicMock):
            active_provider = "openai"
        elif isinstance(self._genai_client, MagicMock) and not isinstance(self._openai_client, MagicMock):
            active_provider = "gemini"

        is_demo = settings.is_demo_mode or not bool(self.api_key)
        if isinstance(self._openai_client, MagicMock) or isinstance(self._genai_client, MagicMock):
            if settings._demo_mode_override is not True:
                is_demo = False

        mode = "deterministic_demo" if is_demo else "autonomous_llm"
        logger.info("Investigation %s starting | mode=%s | provider=%s", investigation_id, mode, active_provider)

        tool_history: list[ToolCallRecord] = []
        tool_calls_made = 0
        max_calls = settings.AGENT_MAX_TOOL_CALLS

        TOOL_ALIASES = {
            "trace_risk": "trace_dependencies",
            "find_owner": "get_service_owner",
            "create_remediation_ticket": "create_remediation_ticket_tool",
        }

        async with GraphGuardMCPClient() as client:
            tool_schemas = client.get_tool_schemas_for_llm()
            available_tool_names = {s["name"] for s in tool_schemas}

            async def _invoke(name: str, args: dict) -> dict:
                """Safe wrapper that records every tool call with input bounds checking and aliasing."""
                nonlocal tool_calls_made
                if tool_calls_made >= max_calls:
                    raise RuntimeError(
                        f"Tool call budget exhausted ({max_calls} calls limit reached)"
                    )
                tool_calls_made += 1

                actual_name = TOOL_ALIASES.get(name, name)
                actual_args = dict(args) if args else {}

                # Bounds checking & sanitization
                if actual_name == "trace_dependencies":
                    s_id = str(actual_args.get("service_id", "")).strip()
                    try:
                        m_hops = int(actual_args.get("max_hops", settings.GRAPH_MAX_HOPS))
                    except (ValueError, TypeError):
                        m_hops = settings.GRAPH_MAX_HOPS
                    actual_args = {"service_id": s_id, "max_hops": max(1, min(5, m_hops))}
                elif actual_name == "create_remediation_ticket_tool":
                    s_id = str(actual_args.get("service_id", "")).strip()
                    v_id = str(actual_args.get("vulnerability_id", "")).strip()
                    reason = str(actual_args.get("reason", "")).strip()
                    prio = str(actual_args.get("priority", "P2")).strip().upper()
                    if prio not in ("P1", "P2", "P3", "P4"):
                        prio = "P2"
                    rec_steps = actual_args.get("recommended_steps")
                    if not rec_steps:
                        rec_steps = [f"Remediate {v_id} on {s_id}."]
                    actual_args = {
                        "service_id": s_id,
                        "vulnerability_id": v_id,
                        "reason": reason,
                        "priority": prio,
                        "recommended_steps": rec_steps,
                    }
                elif actual_name == "get_service_owner":
                    actual_args = {"service_id": str(actual_args.get("service_id", "")).strip()}
                elif actual_name == "investigate_service":
                    cleaned = {}
                    if "service_id" in actual_args and actual_args["service_id"]:
                        cleaned["service_id"] = str(actual_args["service_id"]).strip()
                    if "service_name" in actual_args and actual_args["service_name"]:
                        cleaned["service_name"] = str(actual_args["service_name"]).strip()
                    actual_args = cleaned

                if actual_name not in available_tool_names:
                    record = ToolCallRecord(
                        tool_name=name,
                        arguments=args,
                        result_summary="Unknown tool rejected",
                        success=False,
                        error=f"Tool '{name}' is not allowed or supported. Never execute unrestricted Cypher.",
                    )
                    tool_history.append(record)
                    return {"error": record.error}

                try:
                    result = await client.call_tool(actual_name, actual_args)
                    record = ToolCallRecord(
                        tool_name=name,
                        arguments=args,
                        result_summary=_summarise(result),
                        success=True,
                    )
                    tool_history.append(record)
                    return result
                except MCPClientError as exc:
                    record = ToolCallRecord(
                        tool_name=name,
                        arguments=args,
                        result_summary="Tool call failed",
                        success=False,
                        error=str(exc),
                    )
                    tool_history.append(record)
                    return {"error": str(exc)}

            try:
                if is_demo:
                    result = await self._run_demo_mode(
                        question, create_ticket, investigation_id,
                        mode, tool_history, _invoke,
                    )
                elif active_provider == "openai":
                    try:
                        result = await self._run_openai_mode(
                            question, create_ticket, investigation_id,
                            mode, tool_schemas, tool_history, _invoke,
                        )
                    except Exception as exc:
                        logger.error("OpenAI agent loop encountered error: %s. Falling back to deterministic execution.", exc)
                        record = ToolCallRecord(
                            tool_name="openai_fallback",
                            arguments={},
                            result_summary=f"OpenAI API execution error: {str(exc)}",
                            success=False,
                            error=str(exc),
                        )
                        tool_history.append(record)
                        result = await self._run_demo_mode(
                            question, create_ticket, investigation_id,
                            "deterministic_demo", tool_history, _invoke,
                        )
                elif active_provider == "gemini":
                    try:
                        result = await self._run_gemini_mode(
                            question, create_ticket, investigation_id,
                            mode, tool_schemas, tool_history, _invoke,
                        )
                    except Exception as exc:
                        logger.error("Gemini agent loop encountered error: %s. Falling back to deterministic execution.", exc)
                        record = ToolCallRecord(
                            tool_name="gemini_fallback",
                            arguments={},
                            result_summary=f"Gemini API execution error: {str(exc)}",
                            success=False,
                            error=str(exc),
                        )
                        tool_history.append(record)
                        result = await self._run_demo_mode(
                            question, create_ticket, investigation_id,
                            "deterministic_demo", tool_history, _invoke,
                        )
                else:
                    result = await self._run_demo_mode(
                        question, create_ticket, investigation_id,
                        "deterministic_demo", tool_history, _invoke,
                    )
            except Exception as exc:
                logger.exception("Agent investigation failed: %s", exc)
                result = InvestigationResult(
                    investigation_id=investigation_id,
                    mode=mode,
                    question=question,
                    error=str(exc),
                    tool_call_history=tool_history,
                    limitations=["Investigation terminated due to an unexpected error."],
                )

        return result

    # ── Deterministic Demo Mode ────────────────────────────────────────────────

    async def _run_demo_mode(
        self,
        question: str,
        create_ticket: bool,
        inv_id: str,
        mode: str,
        tool_history: list[ToolCallRecord],
        invoke,
    ) -> InvestigationResult:
        """
        A fixed, reproducible investigation workflow for demo/testing purposes.
        Still uses real MCP tool calls and real FalkorDB data.
        Targets Payment Service (svc-1) by default, or tries to extract
        a service name/id from the question text.
        """
        logger.info("Running deterministic_demo investigation")

        # Try to extract a service reference from the question
        target_id = self._extract_service_hint(question) or self.DEMO_TARGET_SERVICE

        # STAGE 1: Investigate the target service
        inv_result = await invoke("investigate_service", {"service_id": target_id})
        if "error" in inv_result:
            # Try by name if id lookup failed
            inv_result = await invoke("investigate_service", {"service_name": target_id})

        if "error" in inv_result or not inv_result.get("service"):
            return InvestigationResult(
                investigation_id=inv_id,
                mode=mode,
                question=question,
                error=f"Target service '{target_id}' not found in graph",
                tool_call_history=tool_history,
                limitations=["Service not found — cannot continue investigation."],
            )

        svc_data = inv_result["service"]
        vulns_data = inv_result.get("vulnerabilities", [])
        owner_data = inv_result.get("owner")

        # STAGE 2: Trace dependencies
        dep_result = await invoke("trace_dependencies", {
            "service_id": svc_data["id"],
            "max_hops": settings.GRAPH_MAX_HOPS,
        })

        impacted_raw = dep_result.get("impacted_services", [])
        impacted_services = [_parse_impacted(s) for s in impacted_raw]

        # STAGE 3: Rank findings
        rank_result = await invoke("rank_findings", {"service_id": svc_data["id"], "max_hops": settings.GRAPH_MAX_HOPS})
        findings_raw = rank_result.get("findings", [])
        risk_scores = [_parse_risk_score(f) for f in findings_raw]

        # STAGE 4: Get owners for each impacted service
        owner_info: list[OwnerNode] = []
        if owner_data:
            owner_info.append(OwnerNode(**owner_data))
        for imp in impacted_services[:3]:   # limit owner lookups
            owner_result = await invoke("get_service_owner", {"service_id": imp.service_id})
            if owner_result.get("owner"):
                owner_info.append(OwnerNode(**owner_result["owner"]))

        # STAGE 5: Create ticket if requested and we have findings
        ticket = None
        if create_ticket and vulns_data:
            top_vuln = vulns_data[0]
            ticket_result = await invoke("create_remediation_ticket_tool", {
                "service_id": svc_data["id"],
                "vulnerability_id": top_vuln["id"],
                "reason": (
                    f"Automated investigation of '{svc_data['name']}' identified "
                    f"{len(impacted_services)} potentially impacted downstream service(s). "
                    f"Top vulnerability: {top_vuln['title']} (severity={top_vuln['severity']})"
                ),
                "recommended_steps": [
                    f"Apply patch for '{top_vuln['title']}' on {svc_data['name']}.",
                    "Review and test all directly dependent services after patching.",
                    f"Notify owner(s): {', '.join(o.name for o in owner_info) if owner_info else 'Unknown'}.",
                    "Update affected_version in the vulnerability record once resolved.",
                ],
            })
            if ticket_result.get("success") and ticket_result.get("ticket"):
                ticket = RemediationTicket(**ticket_result["ticket"])

        return InvestigationResult(
            investigation_id=inv_id,
            mode=mode,
            question=question,
            target_entity=svc_data["id"],
            target_entity_type="service",
            vulnerabilities_found=[VulnerabilityNode(**v) for v in vulns_data],
            impacted_services=impacted_services,
            risk_scores=risk_scores,
            owner_info=list({o.id: o for o in owner_info}.values()),
            ticket=ticket,
            tool_call_history=tool_history,
            recommended_next_steps=self._build_next_steps(
                svc_data, vulns_data, impacted_services, risk_scores, ticket
            ),
            limitations=[
                "This is deterministic_demo mode — the investigation workflow is fixed, not LLM-driven.",
                "A dependency path indicates potential impact, not confirmed exploitation.",
                "Set GOOGLE_API_KEY and GRAPHGUARD_DEMO_MODE=false for autonomous LLM-driven investigations.",
            ],
        )

    # ── OpenAI Autonomous Responses API Mode ───────────────────────────────────

    async def _run_openai_mode(
        self,
        question: str,
        create_ticket: bool,
        inv_id: str,
        mode: str,
        tool_schemas: list[dict],
        tool_history: list[ToolCallRecord],
        invoke,
    ) -> InvestigationResult:
        """
        Executes the iterative tool-calling loop using the official OpenAI Responses API.
        """
        import openai

        client = self._openai_client
        if client is None:
            client = openai.OpenAI(api_key=self.api_key)

        openai_tools = _build_openai_tools(tool_schemas)

        system_instruction = (
            "You are GraphGuard, an elite security investigation AI agent for connected microservice architectures. "
            "Your objective: Investigate vulnerable services, trace multi-hop dependency paths, identify affected services "
            "and owners, explain findings based strictly on graph facts, calculate transparent risk rankings, and create "
            "a proposed remediation ticket. "
            "RULES: "
            "1. Always call investigate_service first on the target service. "
            "2. Always call trace_dependencies (or trace_risk) with max_hops=3 to find upstream affected services. "
            "3. Call get_service_owner (or find_owner) to identify responsible teams. "
            "4. If a critical or high vulnerability is confirmed, create a remediation ticket. "
            "5. Never hallucinate node relationships or vulnerabilities not verified by tool calls. "
            "6. Explicitly distinguish confirmed facts from inferred risks. "
            f"You may make at most {settings.AGENT_MAX_TOOL_CALLS} tool calls total."
        )
        if create_ticket:
            system_instruction += (
                " The user has requested a remediation ticket — create one using "
                "create_remediation_ticket_tool (or create_remediation_ticket) if you find valid evidence."
            )

        input_items: list[dict[str, Any]] = [
            {"role": "user", "content": question}
        ]
        max_iterations = settings.AGENT_MAX_TOOL_CALLS
        iteration = 0
        final_summary = ""

        tool_results_collected: dict[str, Any] = {}

        while iteration < max_iterations:
            iteration += 1
            response = client.responses.create(
                model=self.model_name,
                instructions=system_instruction,
                input=input_items,
                tools=openai_tools,
                temperature=0.1,
            )

            output_items = getattr(response, "output", None) or []
            function_calls = []
            message_texts = []

            for item in output_items:
                item_type = getattr(item, "type", None) or (item.get("type") if isinstance(item, dict) else None)
                if item_type == "function_call":
                    function_calls.append(item)
                elif item_type == "message":
                    content = getattr(item, "content", None) or (item.get("content") if isinstance(item, dict) else None)
                    if isinstance(content, list):
                        for part in content:
                            p_text = getattr(part, "text", None) or (part.get("text") if isinstance(part, dict) else None)
                            if p_text:
                                message_texts.append(p_text)
                    elif isinstance(content, str) and content:
                        message_texts.append(content)

            output_text = getattr(response, "output_text", None)
            if output_text and output_text not in message_texts:
                message_texts.append(output_text)

            # If no function calls, model provided final analysis
            if not function_calls:
                final_summary = " ".join(message_texts).strip() or "Autonomous OpenAI investigation concluded successfully."
                break

            # Process all tool calls requested in this turn
            for fc in function_calls:
                if isinstance(fc, dict):
                    input_items.append(fc)
                elif hasattr(fc, "model_dump") and callable(fc.model_dump):
                    try:
                        input_items.append(fc.model_dump(exclude_none=True))
                    except Exception:
                        input_items.append({
                            "type": "function_call",
                            "call_id": getattr(fc, "call_id", ""),
                            "name": getattr(fc, "name", ""),
                            "arguments": getattr(fc, "arguments", "{}"),
                        })
                else:
                    input_items.append({
                        "type": "function_call",
                        "call_id": getattr(fc, "call_id", ""),
                        "name": getattr(fc, "name", ""),
                        "arguments": getattr(fc, "arguments", "{}"),
                    })

                call_id = getattr(fc, "call_id", None) or (fc.get("call_id") if isinstance(fc, dict) else "")
                name = getattr(fc, "name", None) or (fc.get("name") if isinstance(fc, dict) else "")
                raw_args = getattr(fc, "arguments", None) or (fc.get("arguments") if isinstance(fc, dict) else "{}")

                if isinstance(raw_args, str):
                    try:
                        args = json.loads(raw_args)
                    except json.JSONDecodeError:
                        args = {}
                elif isinstance(raw_args, dict):
                    args = raw_args
                else:
                    args = {}

                tool_output = await invoke(name, args)
                tool_results_collected[name] = tool_output

                # Format tool output item for Responses API
                input_items.append({
                    "type": "function_call_output",
                    "call_id": call_id,
                    "output": json.dumps(tool_output),
                })

        if not final_summary:
            final_summary = f"Investigation reached maximum iteration limit ({max_iterations} tool calls). Summary compiled from collected graph data."

        return self._build_investigation_result_from_tool_results(
            inv_id=inv_id,
            mode=mode,
            question=question,
            tool_results_collected=tool_results_collected,
            tool_history=tool_history,
            llm_summary=final_summary,
        )

    # ── Gemini LLM Mode ────────────────────────────────────────────────────────

    async def _run_gemini_mode(
        self,
        question: str,
        create_ticket: bool,
        inv_id: str,
        mode: str,
        tool_schemas: list[dict],
        tool_history: list[ToolCallRecord],
        invoke,
    ) -> InvestigationResult:
        """
        Uses Gemini's native function-calling to drive the investigation.
        The model selects tools and arguments based on the question and discovered tool schemas.
        """
        import google.genai as genai
        from google.genai import types

        client = self._genai_client or genai.Client(api_key=self.api_key)
        gemini_tools = _build_gemini_tools(tool_schemas)

        system_prompt = (
            "You are GraphGuard, a security investigation agent. "
            "You have access to a graph database of interconnected services and vulnerabilities. "
            "Investigate the user's question using the available tools. "
            "Only use tool results as evidence — never invent service IDs, vulnerability IDs, or paths. "
            "After gathering sufficient evidence, provide a final answer. "
            f"You may make at most {settings.AGENT_MAX_TOOL_CALLS} tool calls total."
        )
        if create_ticket:
            system_prompt += (
                " The user has requested a remediation ticket — create one using "
                "create_remediation_ticket_tool if you find valid evidence."
            )

        messages = [
            types.Content(role="user", parts=[types.Part(text=question)])
        ]

        tool_results_collected: dict[str, Any] = {}
        llm_summary = ""
        max_iterations = settings.AGENT_MAX_TOOL_CALLS

        for iteration in range(max_iterations):
            response = client.models.generate_content(
                model=self.model_name,
                contents=messages,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    tools=gemini_tools,
                ),
            )

            candidate = response.candidates[0] if response.candidates else None
            if not candidate:
                break

            # Check for function calls
            function_calls = []
            if hasattr(response, "function_calls") and response.function_calls:
                function_calls = response.function_calls
            elif candidate and candidate.content and candidate.content.parts:
                function_calls = [
                    p.function_call
                    for p in candidate.content.parts
                    if hasattr(p, "function_call") and p.function_call
                ]

            if not function_calls:
                # Model produced a text response — done
                if hasattr(response, "text") and response.text:
                    llm_summary = response.text
                elif candidate and candidate.content and candidate.content.parts:
                    text_parts = [
                        p.text for p in candidate.content.parts
                        if hasattr(p, "text") and p.text
                    ]
                    llm_summary = " ".join(text_parts)
                break

            # Execute each function call through MCP
            function_responses = []
            for fc in function_calls:
                tool_name = fc.name
                tool_args = dict(fc.args) if fc.args else {}

                mcp_result = await invoke(tool_name, tool_args)
                tool_results_collected[tool_name] = mcp_result

                function_responses.append(
                    types.Part(
                        function_response=types.FunctionResponse(
                            name=tool_name,
                            response={"result": mcp_result},
                        )
                    )
                )

            # Add model's function call turn to history
            if candidate and candidate.content:
                messages.append(candidate.content)
            # Add tool results
            messages.append(
                types.Content(
                    role="tool",
                    parts=function_responses,
                )
            )

        if not llm_summary:
            llm_summary = "Gemini investigation completed."

        return self._build_investigation_result_from_tool_results(
            inv_id=inv_id,
            mode=mode,
            question=question,
            tool_results_collected=tool_results_collected,
            tool_history=tool_history,
            llm_summary=llm_summary,
        )

    async def _run_llm_mode(
        self,
        question: str,
        create_ticket: bool,
        inv_id: str,
        mode: str,
        tool_schemas: list[dict],
        tool_history: list[ToolCallRecord],
        invoke,
    ) -> InvestigationResult:
        """Backward-compatible entry point for LLM mode."""
        if self.provider == "openai":
            return await self._run_openai_mode(
                question, create_ticket, inv_id, mode, tool_schemas, tool_history, invoke
            )
        return await self._run_gemini_mode(
            question, create_ticket, inv_id, mode, tool_schemas, tool_history, invoke
        )

    def _build_investigation_result_from_tool_results(
        self,
        inv_id: str,
        mode: str,
        question: str,
        tool_results_collected: dict[str, Any],
        tool_history: list[ToolCallRecord],
        llm_summary: str,
    ) -> InvestigationResult:
        """Extract structured data from collected tool results into a standardized InvestigationResult."""
        svc_data = None
        vulns_data = []
        impacted_services = []
        risk_scores = []
        owner_info = []
        ticket = None

        if "investigate_service" in tool_results_collected:
            r = tool_results_collected["investigate_service"]
            svc_data = r.get("service")
            vulns_data = r.get("vulnerabilities", [])
            if r.get("owner"):
                owner_info.append(OwnerNode(**r["owner"]))

        for dep_key in ("trace_dependencies", "trace_risk"):
            if dep_key in tool_results_collected:
                r = tool_results_collected[dep_key]
                raw_imp = r.get("impacted_services") or r.get("affected_services", [])
                impacted_services = [_parse_impacted(s) for s in raw_imp]
                break

        if "rank_findings" in tool_results_collected:
            r = tool_results_collected["rank_findings"]
            risk_scores = [_parse_risk_score(f) for f in r.get("findings", [])]

        for own_key in ("get_service_owner", "find_owner"):
            if own_key in tool_results_collected:
                r = tool_results_collected[own_key]
                if r.get("owner"):
                    owner = OwnerNode(**r["owner"])
                    if not any(o.id == owner.id for o in owner_info):
                        owner_info.append(owner)

        for tkt_key in ("create_remediation_ticket_tool", "create_remediation_ticket"):
            if tkt_key in tool_results_collected:
                r = tool_results_collected[tkt_key]
                if r.get("success") and r.get("ticket"):
                    ticket = RemediationTicket(**r["ticket"])
                break

        # Calculate risk scores if not directly retrieved but vulnerabilities exist
        if not risk_scores and vulns_data:
            from app.risk_engine import calculate_risk_score
            impacted_count = len(impacted_services)
            max_depth = max((s.hop_count for s in impacted_services), default=1)
            for v in vulns_data:
                v_node = VulnerabilityNode(**v) if isinstance(v, dict) else v
                score = calculate_risk_score(v_node, impacted_count, max_depth)
                risk_scores.append(score)

        return InvestigationResult(
            investigation_id=inv_id,
            mode=mode,
            question=question,
            target_entity=svc_data["id"] if svc_data else None,
            target_entity_type="service" if svc_data else None,
            vulnerabilities_found=[VulnerabilityNode(**v) for v in vulns_data],
            impacted_services=impacted_services,
            risk_scores=risk_scores,
            owner_info=owner_info,
            ticket=ticket,
            tool_call_history=tool_history,
            llm_summary=llm_summary,
            recommended_next_steps=self._build_next_steps(
                svc_data, vulns_data, impacted_services, risk_scores, ticket
            ) if svc_data else [],
            limitations=[
                "LLM interpretations are not graph facts — only tool results are verified evidence.",
                "A dependency path indicates potential impact, not confirmed exploitation.",
            ],
        )

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_service_hint(question: str) -> str | None:
        """Try to find a service id or name reference in the question text."""
        q = question.lower()
        if "payment" in q:
            return "svc-1"
        if "checkout" in q:
            return "svc-2"
        if "api gateway" in q or "gateway" in q:
            return "svc-3"
        if "auth" in q:
            return "svc-4"
        if "order" in q:
            return "svc-5"
        if "inventory" in q:
            return "svc-6"
        if "notif" in q:
            return "svc-7"
        if "analytic" in q:
            return "svc-8"
        if "fraud" in q:
            return "svc-9"
        if "report" in q:
            return "svc-10"
        # Check for svc-N pattern
        match = re.search(r"svc-\d+", question, re.IGNORECASE)
        if match:
            return match.group(0).lower()
        return None

    @staticmethod
    def _build_next_steps(
        svc_data, vulns_data, impacted_services, risk_scores, ticket
    ) -> list[str]:
        steps = []
        if vulns_data:
            top = vulns_data[0]
            steps.append(
                f"Apply patch for '{top.get('title', 'vulnerability')}' "
                f"({top.get('severity', '?')} severity) on {svc_data.get('name', '?')} immediately."
            )
        if impacted_services:
            high_crit = [s for s in impacted_services if s.criticality in ("high", "critical")]
            if high_crit:
                names = ", ".join(s.service_name for s in high_crit[:3])
                steps.append(f"Prioritise review of high/critical dependents: {names}.")
        if risk_scores:
            top_score = risk_scores[0]
            steps.append(
                f"Top finding priority: {top_score.priority} (score={top_score.risk_score:.1f}) — "
                f"{top_score.explanation}"
            )
        if ticket:
            steps.append(
                f"Ticket {ticket.id} created with status {ticket.status}. "
                "Assign to the relevant team for remediation tracking."
            )
        else:
            steps.append(
                "No ticket created. Use POST /api/tickets or include create_ticket=true "
                "in the agent query to generate a tracked remediation task."
            )
        return steps


# ── Parsing helpers ────────────────────────────────────────────────────────────

def _parse_impacted(raw: dict) -> ImpactedService:
    """Safely parse an impacted service dict from MCP tool output."""
    return ImpactedService(
        service_id=raw.get("service_id", ""),
        service_name=raw.get("service_name", ""),
        criticality=raw.get("criticality", "medium"),
        connection_type=raw.get("connection_type", "indirect"),
        hop_count=raw.get("hop_count", 1),
        owner=OwnerNode(**raw["owner"]) if raw.get("owner") else None,
    )


def _parse_risk_score(raw: dict) -> RiskScore:
    """Safely parse a risk score dict from MCP tool output."""
    return RiskScore(
        vulnerability_id=raw.get("vulnerability_id", ""),
        vulnerability_title=raw.get("vulnerability_title", ""),
        severity=raw.get("severity", ""),
        severity_base=float(raw.get("severity_base", 0)),
        impact_bonus=float(raw.get("impact_bonus", 0)),
        depth_bonus=float(raw.get("depth_bonus", 0)),
        risk_score=float(raw.get("risk_score", 0)),
        priority=raw.get("priority", "P4"),
        affected_service_count=int(raw.get("affected_service_count", 0)),
        observed_depth=int(raw.get("observed_depth", 0)),
        explanation=raw.get("explanation", ""),
    )


def _summarise(result: dict) -> str:
    """Produce a short human-readable summary of a tool result."""
    if "error" in result:
        return f"ERROR: {result['error']}"
    if "service" in result and result["service"]:
        svc = result["service"]
        return f"Service: {svc.get('name', '?')} | vulns={len(result.get('vulnerabilities', []))}"
    if "impacted_services" in result:
        return f"Impacted: {result.get('total_impacted_count', '?')} services | depth={result.get('max_observed_depth', '?')}"
    if "findings" in result:
        return f"Findings: {len(result['findings'])} ranked"
    if "ticket" in result and result.get("success"):
        t = result["ticket"]
        return f"Ticket {t.get('id', '?')} created | priority={t.get('priority', '?')}"
    if "tickets" in result:
        return f"{result.get('count', 0)} tickets"
    return str(result)[:100]
