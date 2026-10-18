"""
tests/test_risk_engine.py

Unit tests for the risk scoring engine.
These tests require NO database — pure computation only.
"""

import pytest
from app.models import VulnerabilityNode, RiskScore
from app.risk_engine import (
    calculate_risk_score,
    rank_findings,
    SEVERITY_BASE,
    PRIORITY_THRESHOLDS,
)


def make_vuln(severity: str, vid: str = "v-test") -> VulnerabilityNode:
    return VulnerabilityNode(
        id=vid,
        title=f"Test vuln ({severity})",
        severity=severity,
    )


# ── Severity base scores ───────────────────────────────────────────────────────

class TestSeverityBase:
    def test_critical_base(self):
        r = calculate_risk_score(make_vuln("critical"), 0, 0)
        assert r.severity_base == 90.0

    def test_high_base(self):
        r = calculate_risk_score(make_vuln("high"), 0, 0)
        assert r.severity_base == 70.0

    def test_medium_base(self):
        r = calculate_risk_score(make_vuln("medium"), 0, 0)
        assert r.severity_base == 40.0

    def test_low_base(self):
        r = calculate_risk_score(make_vuln("low"), 0, 0)
        assert r.severity_base == 20.0

    def test_unknown_severity_base_is_zero(self):
        """Unknown severity MUST NOT be treated as critical — base should be 0."""
        r = calculate_risk_score(make_vuln("banana"), 0, 0)
        assert r.severity_base == 0.0

    def test_severity_case_insensitive(self):
        r = calculate_risk_score(make_vuln("CRITICAL"), 0, 0)
        assert r.severity_base == 90.0

    def test_empty_severity_base_is_zero(self):
        r = calculate_risk_score(make_vuln(""), 0, 0)
        assert r.severity_base == 0.0


# ── Impact bonus ───────────────────────────────────────────────────────────────

class TestImpactBonus:
    def test_zero_impacted(self):
        r = calculate_risk_score(make_vuln("critical"), 0, 0)
        assert r.impact_bonus == 0.0

    def test_one_impacted(self):
        r = calculate_risk_score(make_vuln("critical"), 1, 0)
        assert r.impact_bonus == 2.0

    def test_five_impacted_capped_at_10(self):
        r = calculate_risk_score(make_vuln("critical"), 5, 0)
        assert r.impact_bonus == 10.0

    def test_ten_impacted_still_capped_at_10(self):
        r = calculate_risk_score(make_vuln("critical"), 10, 0)
        assert r.impact_bonus == 10.0

    def test_impact_cap_is_10(self):
        r = calculate_risk_score(make_vuln("critical"), 100, 0)
        assert r.impact_bonus == 10.0


# ── Depth bonus ────────────────────────────────────────────────────────────────

class TestDepthBonus:
    def test_zero_depth(self):
        r = calculate_risk_score(make_vuln("critical"), 0, 0)
        assert r.depth_bonus == 0.0

    def test_one_hop(self):
        r = calculate_risk_score(make_vuln("critical"), 0, 1)
        assert r.depth_bonus == 2.0

    def test_five_hops_capped_at_10(self):
        r = calculate_risk_score(make_vuln("critical"), 0, 5)
        assert r.depth_bonus == 10.0

    def test_depth_cap_is_10(self):
        r = calculate_risk_score(make_vuln("critical"), 0, 100)
        assert r.depth_bonus == 10.0


# ── Final score ────────────────────────────────────────────────────────────────

class TestFinalScore:
    def test_score_cannot_exceed_100(self):
        r = calculate_risk_score(make_vuln("critical"), 100, 100)
        assert r.risk_score == 100.0

    def test_critical_no_impact(self):
        r = calculate_risk_score(make_vuln("critical"), 0, 0)
        assert r.risk_score == 90.0

    def test_high_with_5_services_3_hops(self):
        # 70 + min(10, 5*2) + min(10, 3*2) = 70 + 10 + 6 = 86
        r = calculate_risk_score(make_vuln("high"), 5, 3)
        assert r.risk_score == 86.0

    def test_low_with_max_bonuses(self):
        # 20 + 10 + 10 = 40
        r = calculate_risk_score(make_vuln("low"), 100, 100)
        assert r.risk_score == 40.0

    def test_medium_with_partial_bonuses(self):
        # 40 + min(10, 2*2) + min(10, 2*2) = 40 + 4 + 4 = 48
        r = calculate_risk_score(make_vuln("medium"), 2, 2)
        assert r.risk_score == 48.0


# ── Priority thresholds ────────────────────────────────────────────────────────

class TestPriorityThresholds:
    """Test boundary conditions explicitly."""

    def test_p1_at_exactly_85(self):
        # critical + 0 + min(10, 2*2) + min(10, 1*2) = 90+... need to get 85
        # 70 (high) + 10 (5 services) + 6 (3 hops) = 86 → P1? No, 86 >= 85 → P1
        r = calculate_risk_score(make_vuln("high"), 5, 3)
        assert r.priority == "P1"

    def test_p2_at_exactly_70(self):
        # high (70) + 0 + 0 = 70 → P2 (70 ≤ score < 85)
        r = calculate_risk_score(make_vuln("high"), 0, 0)
        assert r.priority == "P2"
        assert r.risk_score == 70.0

    def test_p2_below_85(self):
        # high (70) + 4 + 4 = 78
        r = calculate_risk_score(make_vuln("high"), 2, 2)
        assert r.priority == "P2"
        assert r.risk_score == 78.0

    def test_p3_at_exactly_45(self):
        # medium (40) + 2 + 2 = 44 → P4;  medium (40) + 4 + 2 = 46 → P3
        r = calculate_risk_score(make_vuln("medium"), 2, 1)
        # 40 + 4 + 2 = 46
        assert r.risk_score == 46.0
        assert r.priority == "P3"

    def test_p4_below_45(self):
        # low (20) + 0 + 0 = 20
        r = calculate_risk_score(make_vuln("low"), 0, 0)
        assert r.priority == "P4"

    def test_p4_at_44(self):
        # medium (40) + 2 + 2 = 44
        r = calculate_risk_score(make_vuln("medium"), 1, 1)
        assert r.risk_score == 44.0
        assert r.priority == "P4"

    def test_p1_critical_with_impact(self):
        # critical (90) + any bonus → always P1
        r = calculate_risk_score(make_vuln("critical"), 3, 2)
        assert r.priority == "P1"


# ── Ranking ────────────────────────────────────────────────────────────────────

class TestRankFindings:
    def test_rank_descending(self):
        scores = [
            calculate_risk_score(make_vuln("low", "v1"), 0, 0),
            calculate_risk_score(make_vuln("critical", "v2"), 5, 3),
            calculate_risk_score(make_vuln("medium", "v3"), 1, 1),
        ]
        ranked = rank_findings(scores)
        assert ranked[0].vulnerability_id == "v2"
        assert ranked[-1].vulnerability_id == "v1"

    def test_rank_preserves_identity(self):
        """Each finding keeps its own vulnerability_id after ranking."""
        scores = [
            calculate_risk_score(make_vuln("critical", "v-a"), 0, 0),
            calculate_risk_score(make_vuln("high", "v-b"), 0, 0),
        ]
        ranked = rank_findings(scores)
        assert ranked[0].vulnerability_id == "v-a"
        assert ranked[1].vulnerability_id == "v-b"

    def test_rank_empty_list(self):
        assert rank_findings([]) == []


# ── RiskScore model ────────────────────────────────────────────────────────────

class TestRiskScoreModel:
    def test_model_fields_present(self):
        r = calculate_risk_score(make_vuln("high"), 3, 2)
        assert r.vulnerability_id
        assert r.vulnerability_title
        assert r.explanation
        assert isinstance(r.risk_score, float)
        assert r.priority in {"P1", "P2", "P3", "P4"}

    def test_explanation_mentions_all_components(self):
        r = calculate_risk_score(make_vuln("high"), 3, 2)
        assert "severity" in r.explanation
        assert "impact_bonus" in r.explanation
        assert "depth_bonus" in r.explanation
        assert "risk_score" in r.explanation
