"""
tests/test_llm_explainer.py

Unit tests for LLM Investigation Explainer.
Validates:
1. Reusing official OpenAI Responses API pattern with mocked client.
2. Explaining finding, blast radius impact, and recommended next steps.
3. Prompt strictly contains only evidence and fields from the InvestigationResult.
4. Preserving deterministic risk scores and ticket creation (untouched numeric scoring).
5. Reading API key from environment without hardcoding or logging.
6. Handling missing API keys and API communication errors with clear exceptions.
7. Mocking LLM calls so no real API credits are consumed.
"""

from __future__ import annotations

import json
import os
from unittest.mock import MagicMock, patch
import pytest

from app.agent import GraphGuardAgent
from app.llm_explainer import (
    explain_investigation_result,
    _format_investigation_evidence,
    _parse_explanation_sections,
)
from app.models import (
    InvestigationResult,
    InvestigationExplanation,
    ServiceNode,
    VulnerabilityNode,
    OwnerNode,
    ImpactedService,
    DependencyPath,
    PathHop,
    RiskScore,
    RemediationTicket,
)


def _create_mock_response(output_text: str):
    """Helper to mock an OpenAI Responses API response object."""
    resp = MagicMock()
    resp.output_text = output_text
    resp.output = [
        MagicMock(
            type="message",
            content=[{"type": "output_text", "text": output_text}],
        )
    ]
    return resp


@pytest.fixture
def sample_investigation_result() -> InvestigationResult:
    """Creates a sample verified InvestigationResult with deterministic scores."""
    vulnerability = VulnerabilityNode(
        id="vuln-sql-1",
        title="SQL Injection in Order Processing",
        severity="critical",
        description="Unescaped input in query builder",
        affected_version="2.1.0",
        status="open",
    )
    owner = OwnerNode(
        id="owner-payments",
        name="Security Team Lead",
        team="Core Infrastructure",
        contact="infra-sec@example.com",
    )
    path = DependencyPath(
        path=[
            PathHop(service_id="svc-frontend", service_name="Web Storefront", criticality="high"),
            PathHop(service_id="svc-order", service_name="Order Service", criticality="critical"),
        ],
        hop_count=2,
        connection_type="indirect",
        dependent_service_id="svc-frontend",
        dependent_service_name="Web Storefront",
        vulnerabilities_on_path=["vuln-sql-1"],
    )
    impacted = ImpactedService(
        service_id="svc-frontend",
        service_name="Web Storefront",
        criticality="high",
        connection_type="indirect",
        hop_count=2,
        owner=owner,
        dependency_paths=[path],
    )
    risk = RiskScore(
        vulnerability_id="vuln-sql-1",
        vulnerability_title="SQL Injection in Order Processing",
        severity="critical",
        severity_base=90.0,
        impact_bonus=4.0,
        depth_bonus=4.0,
        risk_score=98.0,
        priority="P1",
        affected_service_count=1,
        observed_depth=2,
        explanation="Deterministic risk score based on critical severity and 2-hop impact.",
    )
    ticket = RemediationTicket(
        id="tkt-sample-123",
        title="Remediate SQL Injection in Order Processing",
        description="Auto-generated remediation ticket",
        status="PROPOSED",
        priority="P1",
        target_service_id="svc-order",
        vulnerability_id="vuln-sql-1",
        risk_score=98.0,
        evidence_json="{}",
        created_at="2026-10-18T12:00:00Z",
    )

    return InvestigationResult(
        investigation_id="inv-sample-1",
        mode="deterministic_demo",
        question="Investigate Order Service for critical risks",
        target_entity="svc-order",
        target_entity_type="service",
        vulnerabilities_found=[vulnerability],
        impacted_services=[impacted],
        risk_scores=[risk],
        owner_info=[owner],
        ticket=ticket,
        recommended_next_steps=[
            "Apply SQL sanitizer patch",
            "Notify Core Infrastructure team",
        ],
    )


class TestLLMExplainer:
    def test_successful_explanation_with_mocked_responses_api(self, sample_investigation_result):
        """Test explanation generation using mocked OpenAI client."""
        mock_output = (
            "### 1. Explanation\n"
            "Order Service has an open critical vulnerability vuln-sql-1 (SQL Injection in Order Processing).\n\n"
            "### 2. Potential Impact\n"
            "Web Storefront depends indirectly on Order Service across a 2-hop path and may experience compromised order workflows.\n\n"
            "### 3. Recommended Next Steps\n"
            "- Deploy parameterized queries to Order Service\n"
            "- Coordinate testing with Web Storefront maintainers\n"
            "- Review ticket tkt-sample-123 with Core Infrastructure\n"
        )
        mock_client = MagicMock()
        mock_client.responses.create.return_value = _create_mock_response(mock_output)

        explanation = explain_investigation_result(
            result=sample_investigation_result,
            client=mock_client,
        )

        assert isinstance(explanation, InvestigationExplanation)
        assert "Order Service has an open critical vulnerability" in explanation.explanation
        assert "Web Storefront depends indirectly" in explanation.potential_impact
        assert len(explanation.recommended_next_steps) >= 3
        assert any("parameterized queries" in s for s in explanation.recommended_next_steps)
        assert explanation.raw_response == mock_output.strip()

        # Verify client.responses.create was called with expected arguments
        mock_client.responses.create.assert_called_once()
        kwargs = mock_client.responses.create.call_args.kwargs
        assert "instructions" in kwargs
        assert "input" in kwargs
        prompt_content = kwargs["input"][0]["content"]
        assert "vuln-sql-1" in prompt_content
        assert "Web Storefront" in prompt_content

    def test_strict_evidence_boundaries_no_invented_fields(self, sample_investigation_result):
        """Verify prompt contains ONLY verified fields from InvestigationResult and forbids hallucination."""
        evidence_text = _format_investigation_evidence(sample_investigation_result)

        # Verified entities from sample must appear
        assert "svc-order" in evidence_text
        assert "vuln-sql-1" in evidence_text
        assert "SQL Injection in Order Processing" in evidence_text
        assert "Web Storefront" in evidence_text
        assert "Security Team Lead" in evidence_text
        assert "infra-sec@example.com" in evidence_text
        assert "Score=98.0/100" in evidence_text
        assert "Priority=P1" in evidence_text
        assert "tkt-sample-123" in evidence_text

        # Entities not in the sample must NEVER be in the evidence
        assert "AWS RDS" not in evidence_text
        assert "Billing Gateway" not in evidence_text
        assert "Zero-day" not in evidence_text

        # Verify system instructions forbid invention
        mock_client = MagicMock()
        mock_client.responses.create.return_value = _create_mock_response(
            "### 1. Explanation\nFinding verified.\n### 2. Potential Impact\nImpact verified.\n### 3. Recommended Next Steps\n- Step 1"
        )
        explain_investigation_result(result=sample_investigation_result, client=mock_client)
        instructions = mock_client.responses.create.call_args.kwargs["instructions"]
        assert "NEVER invent, hallucinate, or extrapolate" in instructions
        assert "DO NOT recalculate, modify, or replace the deterministic numeric risk score" in instructions

    def test_deterministic_risk_scores_and_ticket_remain_untouched(self, sample_investigation_result):
        """Ensure LLM explainer does not modify or overwrite numeric risk score or ticket."""
        original_score = sample_investigation_result.risk_scores[0].risk_score
        original_priority = sample_investigation_result.risk_scores[0].priority
        original_ticket_id = sample_investigation_result.ticket.id

        mock_client = MagicMock()
        mock_client.responses.create.return_value = _create_mock_response(
            "### 1. Explanation\nDone.\n### 2. Potential Impact\nDone.\n### 3. Recommended Next Steps\n- Step"
        )

        explain_investigation_result(sample_investigation_result, client=mock_client)

        # Verify original fields are completely unchanged
        assert sample_investigation_result.risk_scores[0].risk_score == original_score == 98.0
        assert sample_investigation_result.risk_scores[0].priority == original_priority == "P1"
        assert sample_investigation_result.ticket.id == original_ticket_id == "tkt-sample-123"

    def test_missing_api_key_raises_clear_error(self, sample_investigation_result):
        """Verify missing API key raises a clear, descriptive ValueError."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}, clear=False):
            with patch("app.config.settings.OPENAI_API_KEY", ""):
                with pytest.raises(ValueError) as excinfo:
                    explain_investigation_result(
                        result=sample_investigation_result,
                        api_key="",
                        client=None,
                    )
                assert "OpenAI API key is missing" in str(excinfo.value)

    def test_api_communication_error_raises_clear_runtime_error(self, sample_investigation_result):
        """Verify API errors (rate limits, timeouts) are wrapped in a clear RuntimeError."""
        mock_client = MagicMock()
        mock_client.responses.create.side_effect = RuntimeError("Connection timed out to api.openai.com")

        with pytest.raises(RuntimeError) as excinfo:
            explain_investigation_result(
                result=sample_investigation_result,
                client=mock_client,
            )
        assert "OpenAI API error during explanation generation" in str(excinfo.value)
        assert "Connection timed out" in str(excinfo.value)

    def test_json_response_parsing_support(self, sample_investigation_result):
        """Verify JSON-formatted responses are parsed accurately into InvestigationExplanation."""
        json_output = json.dumps({
            "explanation": "Verified SQL injection detected in order processing.",
            "potential_impact": "Downstream web storefront may fail during order submission.",
            "recommended_next_steps": [
                "Patch order validation routine",
                "Execute integration test suite",
            ],
        })
        mock_client = MagicMock()
        mock_client.responses.create.return_value = _create_mock_response(f"```json\n{json_output}\n```")

        explanation = explain_investigation_result(sample_investigation_result, client=mock_client)
        assert explanation.explanation == "Verified SQL injection detected in order processing."
        assert explanation.potential_impact == "Downstream web storefront may fail during order submission."
        assert explanation.recommended_next_steps == [
            "Patch order validation routine",
            "Execute integration test suite",
        ]

    def test_agent_explain_investigation_method(self, sample_investigation_result):
        """Verify GraphGuardAgent.explain_investigation() integration."""
        mock_client = MagicMock()
        mock_client.responses.create.return_value = _create_mock_response(
            "### 1. Explanation\nAgent finding explained.\n### 2. Potential Impact\nService impact.\n### 3. Recommended Next Steps\n- Step A"
        )

        agent = GraphGuardAgent(api_key="mock-key", provider="openai")
        agent._openai_client = mock_client

        explanation = agent.explain_investigation(sample_investigation_result)
        assert isinstance(explanation, InvestigationExplanation)
        assert "Agent finding explained." in explanation.explanation
        assert "Service impact." in explanation.potential_impact
        assert "Step A" in explanation.recommended_next_steps
