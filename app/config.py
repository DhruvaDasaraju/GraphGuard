"""
GraphGuard Configuration Module

Loads all settings from environment variables (via .env file).
Provides typed defaults and clear documentation for each setting.
"""

import os
from dotenv import load_dotenv

# Load .env from the project root (works whether run from root or from app/)
load_dotenv()


class Settings:
    """Application-wide configuration from environment variables."""

    # ── FalkorDB ──────────────────────────────────────────────────────────────
    FALKORDB_HOST: str = os.getenv("FALKORDB_HOST", "localhost")
    FALKORDB_PORT: int = int(os.getenv("FALKORDB_PORT", "6379"))
    FALKORDB_GRAPH_NAME: str = os.getenv("FALKORDB_GRAPH_NAME", "graphguard")

    # ── LLM Provider (Google Gemini) ──────────────────────────────────────────
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GOOGLE_MODEL: str = os.getenv("GOOGLE_MODEL", "gemini-2.0-flash")

    # ── Operating Modes ───────────────────────────────────────────────────────
    # GRAPHGUARD_DEMO_MODE=true forces deterministic mode even if a key is set.
    GRAPHGUARD_DEMO_MODE: bool = os.getenv("GRAPHGUARD_DEMO_MODE", "true").lower() == "true"
    MCP_SERVER_TIMEOUT_SECONDS: int = int(os.getenv("MCP_SERVER_TIMEOUT_SECONDS", "30"))
    AGENT_MAX_TOOL_CALLS: int = int(os.getenv("AGENT_MAX_TOOL_CALLS", "8"))
    GRAPH_MAX_HOPS: int = min(int(os.getenv("GRAPH_MAX_HOPS", "5")), 5)

    @property
    def llm_enabled(self) -> bool:
        """True only when an API key is present and demo mode is off."""
        return bool(self.GOOGLE_API_KEY) and not self.GRAPHGUARD_DEMO_MODE


# Singleton
settings = Settings()
