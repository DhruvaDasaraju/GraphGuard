#!/usr/bin/env python3
"""
scripts/check_setup.py

Verifies that the complete GraphGuard setup is working:
1. Python and dependencies
2. FalkorDB connectivity
3. Seeded data availability
4. MCP server launch and tool discovery (smoke test)

Usage (from project root):
    .venv/bin/python scripts/check_setup.py
"""

import asyncio
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "


def section(title: str) -> None:
    print(f"\n{'─'*50}")
    print(f"  {title}")
    print('─'*50)


def check(label: str, ok: bool, detail: str = "") -> None:
    icon = PASS if ok else FAIL
    line = f"  {icon}  {label}"
    if detail:
        line += f"  →  {detail}"
    print(line)


# ── 1. Python Version ─────────────────────────────────────────────────────────
section("1. Python & Dependencies")
py_ver = sys.version.split()[0]
py_ok = tuple(int(x) for x in py_ver.split(".")[:2]) >= (3, 11)
check(f"Python {py_ver}", py_ok, "" if py_ok else "Need ≥ 3.11")

deps = {
    "fastapi": "fastapi",
    "uvicorn": "uvicorn",
    "falkordb": "falkordb",
    "mcp": "mcp",
    "google.genai": "google.genai",
    "pydantic": "pydantic",
    "dotenv": "dotenv",
    "pytest": "pytest",
}
for label, module in deps.items():
    try:
        __import__(module)
        check(f"import {label}", True)
    except ImportError as e:
        check(f"import {label}", False, str(e))

# ── 2. Configuration ──────────────────────────────────────────────────────────
section("2. Configuration")
from app.config import settings
check("FALKORDB_HOST",   bool(settings.FALKORDB_HOST),    settings.FALKORDB_HOST)
check("FALKORDB_PORT",   settings.FALKORDB_PORT > 0,      str(settings.FALKORDB_PORT))
check("GRAPH_NAME",      bool(settings.FALKORDB_GRAPH_NAME), settings.FALKORDB_GRAPH_NAME)
check("GOOGLE_MODEL",    bool(settings.GOOGLE_MODEL),     settings.GOOGLE_MODEL)
api_key_set = bool(settings.GOOGLE_API_KEY)
check("GOOGLE_API_KEY",  api_key_set, "SET" if api_key_set else "NOT SET (demo mode only)")
check("DEMO_MODE",       True, "enabled" if settings.GRAPHGUARD_DEMO_MODE else "disabled (LLM mode)")

# ── 3. FalkorDB Connectivity ──────────────────────────────────────────────────
section("3. FalkorDB Connectivity")
from app.graph_db import db_health_check
health = db_health_check()
check("FalkorDB reachable", health["healthy"], health["detail"])

if health["healthy"]:
    # ── 4. Seeded Data ────────────────────────────────────────────────────────
    section("4. Seeded Data")
    from app.graph_queries import list_services, list_vulnerabilities
    try:
        svcs = list_services()
        check(f"SERVICE nodes",       len(svcs) >= 8,   f"{len(svcs)} found (need ≥ 8)")
        vulns = list_vulnerabilities()
        check(f"VULNERABILITY nodes", len(vulns) >= 4,  f"{len(vulns)} found (need ≥ 4)")
    except Exception as exc:
        check("Data query", False, str(exc))

    # ── 5. Multi-hop Query ────────────────────────────────────────────────────
    section("5. Multi-hop Graph Query")
    from app.graph_queries import find_all_dependents
    try:
        impacted = find_all_dependents("svc-1", max_hops=5)
        check(
            "Multi-hop dependents of Payment Service (svc-1)",
            len(impacted) > 0,
            f"{len(impacted)} dependent(s) found",
        )
        for imp in impacted:
            print(f"     • {imp.service_name} ({imp.connection_type}, {imp.hop_count} hop(s))")
    except Exception as exc:
        check("Multi-hop query", False, str(exc))

    # ── 6. MCP Smoke Test ──────────────────────────────────────────────────────
    section("6. MCP Server Smoke Test")
    from app.mcp_client import GraphGuardMCPClient

    async def mcp_smoke_test():
        try:
            async with GraphGuardMCPClient(timeout=15) as client:
                tools = client.get_available_tools()
                check("MCP server launched", True, f"{len(tools)} tool(s) discovered")
                for t in tools:
                    print(f"     • {t.name}")

                result = await client.call_tool("investigate_service", {"service_id": "svc-1"})
                has_data = bool(result.get("service"))
                check("investigate_service call", has_data, result.get("service", {}).get("name", "no service data"))
                return True
        except Exception as exc:
            check("MCP smoke test", False, str(exc))
            return False

    asyncio.run(mcp_smoke_test())

else:
    print(f"\n  {WARN} Skipping data and MCP tests — FalkorDB not reachable.")
    print("       Start FalkorDB: docker compose up -d")
    print("       Then seed data: .venv/bin/python scripts/seed_graph.py")

# ── Summary ────────────────────────────────────────────────────────────────────
section("Setup Check Complete")
print()
if not health["healthy"]:
    print("  Action needed: Install Docker Desktop and run:")
    print("    docker compose up -d")
    print("    .venv/bin/python scripts/seed_graph.py")
else:
    print("  Ready to start: uvicorn app.main:app --reload")
    print("  API docs:       http://127.0.0.1:8000/docs")
print()
