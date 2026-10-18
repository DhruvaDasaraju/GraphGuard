"""
GraphGuard Risk Engine

Deterministic, transparent triage scoring for security vulnerabilities.
This module contains ONLY pure computation — no database calls, no I/O.
This makes it independently unit-testable.

Scoring Formula
───────────────
severity_base   = { critical: 90, high: 70, medium: 40, low: 20 }
impact_bonus    = min(10, impacted_service_count * 2)
depth_bonus     = min(10, observed_depth * 2)
risk_score      = min(100, severity_base + impact_bonus + depth_bonus)

Priority Thresholds
───────────────────
P1: risk_score ≥ 85
P2: 70 ≤ risk_score < 85
P3: 45 ≤ risk_score < 70
P4: risk_score < 45
"""

from __future__ import annotations

import logging
from app.models import VulnerabilityNode, RiskScore

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

SEVERITY_BASE: dict[str, float] = {
    "critical": 90.0,
    "high": 70.0,
    "medium": 40.0,
    "low": 20.0,
}

PRIORITY_THRESHOLDS: list[tuple[float, str]] = [
    (85.0, "P1"),
    (70.0, "P2"),
    (45.0, "P3"),
    (0.0,  "P4"),
]


def _severity_base(severity: str) -> float:
    """
    Map severity string to base score.
    Returns None sentinel if severity is unknown — callers MUST handle this.
    """
    return SEVERITY_BASE.get(severity.lower().strip() if severity else "", -1.0)


def _priority(score: float) -> str:
    for threshold, label in PRIORITY_THRESHOLDS:
        if score >= threshold:
            return label
    return "P4"


def calculate_risk_score(
    vulnerability: VulnerabilityNode,
    impacted_service_count: int,
    observed_depth: int,
) -> RiskScore:
    """
    Calculate a risk score and priority for a single vulnerability.

    Args:
        vulnerability:          The vulnerability being scored.
        impacted_service_count: Number of distinct downstream services affected.
        observed_depth:         Maximum hop count observed in the dependency graph.

    Returns:
        RiskScore with full breakdown and explanation.

    Notes:
        - If severity is unrecognised, depth and impact bonuses still apply
          but severity_base is set to 0 and the explanation flags this.
        - The function never silently treats unknown severity as 'critical'.
    """
    base = _severity_base(vulnerability.severity)
    severity_unknown = base < 0

    if severity_unknown:
        base = 0.0
        explanation_prefix = (
            f"WARNING: Unrecognised severity '{vulnerability.severity}' — "
            "severity_base set to 0 (not treated as critical). "
        )
    else:
        explanation_prefix = ""

    # Bonuses
    impact_bonus = min(10.0, impacted_service_count * 2.0)
    depth_bonus = min(10.0, observed_depth * 2.0)

    # Final score
    raw = base + impact_bonus + depth_bonus
    risk_score = min(100.0, raw)

    priority = _priority(risk_score)

    explanation = (
        f"{explanation_prefix}"
        f"severity='{vulnerability.severity}' → base={base:.0f}; "
        f"impacted_services={impacted_service_count} → impact_bonus=min(10, {impacted_service_count}×2)={impact_bonus:.0f}; "
        f"observed_depth={observed_depth} → depth_bonus=min(10, {observed_depth}×2)={depth_bonus:.0f}; "
        f"risk_score=min(100, {base:.0f}+{impact_bonus:.0f}+{depth_bonus:.0f})={risk_score:.1f}; "
        f"priority={priority}."
    )

    if severity_unknown:
        logger.warning(
            "Unknown severity '%s' for vulnerability %s — base set to 0",
            vulnerability.severity,
            vulnerability.id,
        )

    return RiskScore(
        vulnerability_id=vulnerability.id,
        vulnerability_title=vulnerability.title,
        severity=vulnerability.severity,
        severity_base=base,
        impact_bonus=impact_bonus,
        depth_bonus=depth_bonus,
        risk_score=risk_score,
        priority=priority,
        affected_service_count=impacted_service_count,
        observed_depth=observed_depth,
        explanation=explanation,
    )


def rank_findings(risk_scores: list[RiskScore]) -> list[RiskScore]:
    """
    Sort a list of RiskScore objects by descending risk_score.
    Each vulnerability retains its own identity and explanation.
    """
    return sorted(risk_scores, key=lambda r: r.risk_score, reverse=True)
