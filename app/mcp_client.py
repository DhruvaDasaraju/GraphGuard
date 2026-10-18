"""
GraphGuard MCP Client

Launches the MCP server as a subprocess via stdio transport and
provides a clean async interface to discover and invoke tools.

The agent uses this client — it NEVER calls graph functions directly.
All investigation actions go through the MCP protocol.
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from typing import Any

from mcp import stdio_client, StdioServerParameters, ClientSession
from mcp.types import ListToolsResult, Tool

from app.config import settings

logger = logging.getLogger(__name__)

# Path to the MCP server entry point
MCP_SERVER_CMD = [sys.executable, "-m", "app.mcp_server"]


class MCPClientError(Exception):
    """Raised when the MCP client encounters a protocol or transport error."""


class GraphGuardMCPClient:
    """
    Async context manager for communicating with the GraphGuard MCP server.

    Usage:
        async with GraphGuardMCPClient() as client:
            tools = await client.list_tools()
            result = await client.call_tool("investigate_service", {"service_id": "svc-1"})
    """

    def __init__(self, timeout: float | None = None):
        self._timeout = timeout or float(settings.MCP_SERVER_TIMEOUT_SECONDS)
        self._read_stream = None
        self._write_stream = None
        self._session: ClientSession | None = None
        self._cm = None          # context manager from stdio_client
        self._available_tools: list[Tool] = []

    async def __aenter__(self) -> "GraphGuardMCPClient":
        server_params = StdioServerParameters(
            command=sys.executable,
            args=["-m", "app.mcp_server"],
        )
        self._cm = stdio_client(server_params, errlog=sys.stderr)
        self._read_stream, self._write_stream = await self._cm.__aenter__()
        self._session = ClientSession(
            read_stream=self._read_stream,
            write_stream=self._write_stream,
            read_timeout_seconds=self._timeout,
        )
        await self._session.__aenter__()
        await self._session.initialize()
        logger.info("MCP session initialised")
        # Discover tools immediately on connection
        self._available_tools = await self._discover_tools()
        return self

    async def __aexit__(self, *exc_info) -> None:
        if self._session:
            try:
                await self._session.__aexit__(*exc_info)
            except Exception:
                pass
        if self._cm:
            try:
                await self._cm.__aexit__(*exc_info)
            except Exception:
                pass

    async def _discover_tools(self) -> list[Tool]:
        """Call list_tools via MCP and cache the results."""
        if self._session is None:
            raise MCPClientError("Session not initialised")
        result: ListToolsResult = await self._session.list_tools()
        tools = result.tools if result and result.tools else []
        logger.info("MCP tool discovery: found %d tools", len(tools))
        for t in tools:
            logger.debug("  Tool: %s", t.name)
        return tools

    def get_available_tools(self) -> list[Tool]:
        """Return the list of tools discovered from the MCP server."""
        return list(self._available_tools)

    def get_tool_schemas_for_llm(self) -> list[dict[str, Any]]:
        """
        Return tool definitions in a format suitable for passing to an LLM.
        Each entry has 'name', 'description', and 'input_schema'.
        """
        return [
            {
                "name": t.name,
                "description": t.description or "",
                "input_schema": t.input_schema or {},
            }
            for t in self._available_tools
        ]

    def get_openai_tool_schemas(self) -> list[dict[str, Any]]:
        """
        Return tool definitions adapted for OpenAI Responses API / Function Calling format.
        """
        return [
            {
                "type": "function",
                "name": t.name,
                "description": t.description or "",
                "parameters": t.input_schema or {"type": "object", "properties": {}},
                "strict": False,
            }
            for t in self._available_tools
        ]

    async def call_tool(
        self,
        tool_name: str,
        arguments: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Invoke an MCP tool by name with the given arguments.

        Validates:
        - tool_name must exist in the discovered tool list.
        - Returns the structured tool result.

        Args:
            tool_name:  Must match a discovered tool name exactly.
            arguments:  Dict of arguments (validated by the MCP server).

        Returns:
            Dict parsed from the tool's JSON response content.

        Raises:
            MCPClientError: On unknown tool name, transport failure, or tool error.
        """
        if self._session is None:
            raise MCPClientError("MCP session is not initialised")

        known_names = {t.name for t in self._available_tools}
        if tool_name not in known_names:
            raise MCPClientError(
                f"Tool '{tool_name}' is not in the discovered tool list: {sorted(known_names)}"
            )

        args = arguments or {}
        logger.info("Calling MCP tool: %s | args=%s", tool_name, list(args.keys()))

        try:
            result = await self._session.call_tool(tool_name, args)
        except Exception as exc:
            logger.error("MCP tool call failed: %s | error=%s", tool_name, exc)
            raise MCPClientError(f"Tool call '{tool_name}' failed: {exc}") from exc

        if result.is_error:
            error_text = (
                result.content[0].text
                if result.content
                else "unknown tool error"
            )
            raise MCPClientError(f"Tool '{tool_name}' returned an error: {error_text}")

        # Parse the text content as JSON
        if result.content:
            raw = result.content[0].text
            try:
                parsed = json.loads(raw)
                return parsed
            except (json.JSONDecodeError, TypeError):
                return {"raw_response": raw}

        return {}


async def run_mcp_call(
    tool_name: str,
    arguments: dict[str, Any],
    timeout: float | None = None,
) -> dict[str, Any]:
    """
    Convenience function: create a client, run one tool call, and return the result.
    Useful for one-shot calls from tests and scripts.
    """
    async with GraphGuardMCPClient(timeout=timeout) as client:
        return await client.call_tool(tool_name, arguments)
