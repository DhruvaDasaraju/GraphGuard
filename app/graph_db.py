"""
GraphGuard Database Layer

Manages the FalkorDB connection, graph selection, health-checking,
and provides a single reusable query-execution function.

Design notes:
- Connection is established lazily on first use and cached.
- The health check performs an actual RETURN 1 query — it does NOT
  claim the DB is healthy based on socket connectivity alone.
- Never logs credentials.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from falkordb import FalkorDB
from falkordb.graph import Graph

from app.config import settings

logger = logging.getLogger(__name__)

# Module-level cached state
_client: Optional[FalkorDB] = None
_graph: Optional[Graph] = None


def _get_client() -> FalkorDB:
    """Return (and cache) a FalkorDB client connection."""
    global _client
    if _client is None:
        logger.debug(
            "Connecting to FalkorDB at %s:%s",
            settings.FALKORDB_HOST,
            settings.FALKORDB_PORT,
        )
        _client = FalkorDB(
            host=settings.FALKORDB_HOST,
            port=settings.FALKORDB_PORT,
        )
    return _client


def get_graph() -> Graph:
    """Return (and cache) the selected FalkorDB graph."""
    global _graph
    if _graph is None:
        client = _get_client()
        _graph = client.select_graph(settings.FALKORDB_GRAPH_NAME)
        logger.debug("Selected graph: %s", settings.FALKORDB_GRAPH_NAME)
    return _graph


def reset_connection() -> None:
    """Tear down cached connection (used in tests or after connection errors)."""
    global _client, _graph
    _client = None
    _graph = None


def execute_query(
    query: str,
    params: Optional[dict[str, Any]] = None,
) -> list[dict[str, Any]]:
    """
    Execute a parameterised Cypher query and return results as a list of dicts.

    Args:
        query:  Cypher query string. Use $param_name placeholders.
        params: Dict of parameter values (never embed user input directly).

    Returns:
        List of row dicts keyed by the query's RETURN aliases.

    Raises:
        RuntimeError: If the query fails.
    """
    graph = get_graph()
    try:
        result = graph.query(query, params or {})
        rows: list[dict[str, Any]] = []
        if result and result.result_set:
            headers: list[str] = []
            for h in (result.header or []):
                if isinstance(h, (list, tuple)) and len(h) > 1:
                    val = h[1]
                else:
                    val = h
                if isinstance(val, bytes):
                    headers.append(val.decode("utf-8", errors="replace"))
                elif isinstance(val, (list, tuple)):
                    headers.append(str(val[0]) if val else "col")
                else:
                    headers.append(str(val))

            for row in result.result_set:
                if headers:
                    rows.append(dict(zip(headers, row)))
                else:
                    rows.append({"_row": row})
        return rows
    except Exception as exc:
        logger.error("Query failed: %s | params=%s | error=%s", query[:120], params, exc)
        raise RuntimeError(f"Graph query failed: {exc}") from exc


def db_health_check() -> dict[str, Any]:
    """
    Verify that FalkorDB is reachable and the graph is accessible.

    Returns a dict with 'healthy' (bool) and 'detail' (str).
    Does NOT claim healthy unless a real query succeeded.
    """
    try:
        rows = execute_query("RETURN 1 AS ping")
        if rows and rows[0].get("ping") == 1:
            return {"healthy": True, "detail": "FalkorDB reachable and graph accessible"}
        return {"healthy": False, "detail": "Unexpected response from health-check query"}
    except Exception as exc:
        return {"healthy": False, "detail": str(exc)}
