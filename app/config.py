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

    # ── LLM Providers ────────────────────────────────────────────────────────
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai").strip().lower()

    # OpenAI Settings
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()

    # Google Gemini Settings
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "").strip()
    GOOGLE_MODEL: str = os.getenv("GOOGLE_MODEL", "gemini-2.0-flash").strip()

    # ── Operating Modes ───────────────────────────────────────────────────────
    # GRAPHGUARD_DEMO_MODE=true forces deterministic mode even if a key is set.
    GRAPHGUARD_DEMO_MODE: bool = os.getenv("GRAPHGUARD_DEMO_MODE", "true").lower() == "true"
    MCP_SERVER_TIMEOUT_SECONDS: int = int(os.getenv("MCP_SERVER_TIMEOUT_SECONDS", "30"))
    AGENT_MAX_TOOL_CALLS: int = int(os.getenv("AGENT_MAX_TOOL_CALLS", "8"))
    GRAPH_MAX_HOPS: int = min(int(os.getenv("GRAPH_MAX_HOPS", "5")), 5)
    _demo_mode_override: bool | None = None

    @property
    def active_provider(self) -> str:
        prov = self.LLM_PROVIDER.strip().lower()
        if prov in ("openai", "gemini"):
            return prov
        if self.OPENAI_API_KEY and not self.GOOGLE_API_KEY:
            return "openai"
        if self.GOOGLE_API_KEY and not self.OPENAI_API_KEY:
            return "gemini"
        return "openai"

    @property
    def is_demo_mode(self) -> bool:
        """Determines if the agent runs in deterministic demo mode."""
        if self._demo_mode_override is not None:
            return self._demo_mode_override
        if self.GRAPHGUARD_DEMO_MODE:
            return True
        if self.active_provider == "openai":
            return not bool(self.OPENAI_API_KEY)
        elif self.active_provider == "gemini":
            return not bool(self.GOOGLE_API_KEY)
        return True

    @is_demo_mode.setter
    def is_demo_mode(self, value: bool | None) -> None:
        self._demo_mode_override = value

    @property
    def llm_enabled(self) -> bool:
        """True only when an API key is present for the active provider and demo mode is off."""
        return not self.is_demo_mode


# Singleton
settings = Settings()
