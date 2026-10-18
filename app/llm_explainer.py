"""
GraphGuard LLM Investigation Explainer

Provides a small, reusable function to explain security investigation findings,
their potential blast-radius impact, and recommended next steps using the LLM.

Adheres strictly to the following architectural rules:
1. Reuses the official OpenAI Python SDK and Responses API (or injected client).
2. Uses ONLY verified evidence from InvestigationResult — never invents nodes,
   services, owners, vulnerabilities, or paths.
3. Preserves deterministic risk scoring and ticket creation without alteration.
4. Reads API key securely from environment variables, never hardcodes or logs keys.
5. Handles missing API keys and API communication errors with clear exceptions.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional

from app.config import settings
from app.models import InvestigationResult, InvestigationExplanation

logger = logging.getLogger(__name__)


def _format_investigation_evidence(result: InvestigationResult) -> str:
    """
    Serializes verified evidence fields from InvestigationResult into a clean,
    structured textual representation for the LLM.
    """
    evidence_lines: list[str] = [
        f"Target Entity: {result.target_entity or 'N/A'} (Type: {result.target_entity_type or 'unknown'})",
        f"Investigation Question: {result.question}",
    ]

    # Vulnerabilities
    if result.vulnerabilities_found:
        evidence_lines.append("\nVulnerabilities Identified in Graph:")
        for v in result.vulnerabilities_found:
            status_info = f", Status: {v.status}" if v.status else ""
            version_info = f", Affected Version: {v.affected_version}" if v.affected_version else ""
            desc = f" - Description: {v.description}" if v.description else ""
            evidence_lines.append(f"  - [{v.id}] {v.title} (Severity: {v.severity}{status_info}{version_info}){desc}")
    else:
        evidence_lines.append("\nVulnerabilities Identified in Graph: None recorded")

    # Impacted Services & Dependency Paths
    if result.impacted_services:
        evidence_lines.append("\nImpacted Downstream Services (Verified Dependency Graph):")
        for s in result.impacted_services:
            evidence_lines.append(
                f"  - [{s.service_id}] {s.service_name} (Criticality: {s.criticality}, "
                f"Connection: {s.connection_type}, Hops: {s.hop_count})"
            )
            for path in s.dependency_paths:
                hop_names = " -> ".join(hop.service_name for hop in path.path)
                if hop_names:
                    evidence_lines.append(f"    Path: {hop_names}")
    else:
        evidence_lines.append("\nImpacted Downstream Services: None observed")

    # Owners
    if result.owner_info:
        evidence_lines.append("\nResponsible Service Owners:")
        for o in result.owner_info:
            team_info = f", Team: {o.team}" if o.team else ""
            contact_info = f", Contact: {o.contact}" if o.contact else ""
            evidence_lines.append(f"  - [{o.id}] {o.name}{team_info}{contact_info}")
    else:
        evidence_lines.append("\nResponsible Service Owners: None verified")

    # Deterministic Risk Scores
    if result.risk_scores:
        evidence_lines.append("\nDeterministic Risk Scores (Computed by Risk Engine):")
        for r in result.risk_scores:
            evidence_lines.append(
                f"  - Vulnerability {r.vulnerability_id}: Score={r.risk_score:.1f}/100 "
                f"(Priority={r.priority}, Base={r.severity_base:.1f}, ImpactBonus={r.impact_bonus:.1f}, "
                f"DepthBonus={r.depth_bonus:.1f}) | Details: {r.explanation}"
            )

    # Remediation Ticket
    if result.ticket:
        evidence_lines.append("\nRemediation Ticket Status:")
        evidence_lines.append(
            f"  - Ticket ID: {result.ticket.id} | Status: {result.ticket.status} | Priority: {result.ticket.priority}"
        )
        if result.ticket.title:
            evidence_lines.append(f"  - Title: {result.ticket.title}")
        if result.ticket.description:
            evidence_lines.append(f"  - Details: {result.ticket.description}")


    # Audit Trail
    if result.audit_trail:
        evidence_lines.append("\nTool Execution Audit Trail:")
        for entry in result.audit_trail:
            evidence_lines.append(f"  - {entry}")

    return "\n".join(evidence_lines)


def _extract_text_from_response(response: Any) -> str:
    """Helper to extract text output from OpenAI Responses API or standard Chat completion response."""
    output_text = getattr(response, "output_text", None)
    if output_text and isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    output_items = getattr(response, "output", None) or []
    message_texts = []
    for item in output_items:
        item_type = getattr(item, "type", None) or (item.get("type") if isinstance(item, dict) else None)
        if item_type == "message":
            content = getattr(item, "content", None) or (item.get("content") if isinstance(item, dict) else None)
            if isinstance(content, list):
                for part in content:
                    p_text = getattr(part, "text", None) or (part.get("text") if isinstance(part, dict) else None)
                    if p_text:
                        message_texts.append(p_text)
            elif isinstance(content, str) and content:
                message_texts.append(content)

    if message_texts:
        return "\n".join(message_texts).strip()

    # Fallback to chat completion choices if available
    choices = getattr(response, "choices", None)
    if choices and len(choices) > 0:
        first_choice = choices[0]
        msg = getattr(first_choice, "message", None)
        if msg:
            content = getattr(msg, "content", "")
            if content:
                return str(content).strip()

    return ""


def _parse_explanation_sections(raw_text: str) -> tuple[str, str, list[str]]:
    """
    Parses LLM output into (explanation, potential_impact, recommended_next_steps).
    Supports JSON or markdown sections.
    """
    # 1. Try parsing JSON if present
    json_candidate = raw_text.strip()
    if json_candidate.startswith("```"):
        json_candidate = re.sub(r"^```(?:json)?\s*", "", json_candidate)
        json_candidate = re.sub(r"\s*```$", "", json_candidate)

    if json_candidate.startswith("{") and json_candidate.endswith("}"):
        try:
            data = json.loads(json_candidate)
            explanation = str(data.get("explanation", "")).strip()
            potential_impact = str(data.get("potential_impact", "")).strip()
            raw_steps = data.get("recommended_next_steps", [])
            steps = [str(s).strip() for s in raw_steps if str(s).strip()]
            if explanation and potential_impact:
                return explanation, potential_impact, steps
        except Exception:
            pass

    # 2. Parse markdown sections
    explanation_match = re.search(
        r"(?:###?|\*\*)\s*(?:1[.)]?\s*)?(?:Finding Explanation|Explanation of Finding|Explanation)[:\*\s]*\n?(.*?)(?=(?:###?|\*\*)\s*(?:2[.)]?\s*)?(?:Potential Impact|Impact)|$)",
        raw_text,
        re.IGNORECASE | re.DOTALL,
    )
    impact_match = re.search(
        r"(?:###?|\*\*)\s*(?:2[.)]?\s*)?(?:Potential Impact|Impact)[:\*\s]*\n?(.*?)(?=(?:###?|\*\*)\s*(?:3[.)]?\s*)?(?:Recommended Next Steps|Next Steps|Recommendations)|$)",
        raw_text,
        re.IGNORECASE | re.DOTALL,
    )
    steps_match = re.search(
        r"(?:###?|\*\*)\s*(?:3[.)]?\s*)?(?:Recommended Next Steps|Next Steps|Recommendations)[:\*\s]*\n?(.*)",
        raw_text,
        re.IGNORECASE | re.DOTALL,
    )

    explanation = explanation_match.group(1).strip() if explanation_match else ""
    potential_impact = impact_match.group(1).strip() if impact_match else ""
    raw_steps_str = steps_match.group(1).strip() if steps_match else ""

    steps: list[str] = []
    if raw_steps_str:
        for line in raw_steps_str.splitlines():
            cleaned = re.sub(r"^[-*•\d.)]+\s*", "", line).strip()
            if cleaned and not cleaned.startswith("#"):
                steps.append(cleaned)

    # 3. Fallbacks if section headers were not strictly followed
    if not explanation and not potential_impact:
        explanation = raw_text.strip()
        potential_impact = "Refer to the investigation explanation above for verified impact details."

    return explanation, potential_impact, steps


def explain_investigation_result(
    result: InvestigationResult,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    client: Any = None,
) -> InvestigationExplanation:
    """
    Explains an InvestigationResult using the official OpenAI Responses API.

    Args:
        result:  The verified InvestigationResult to explain.
        api_key: Optional API key override. If not provided, reads from environment.
        model:   Optional model override. Defaults to settings.OPENAI_MODEL ("gpt-4o-mini").
        client:  Optional pre-configured client (useful for unit testing / mocking).

    Returns:
        InvestigationExplanation containing explanation, potential_impact, and recommended_next_steps.

    Raises:
        ValueError: If the OpenAI API key is missing or empty.
        RuntimeError: If an error occurs during API communication.
    """
    # 1. Resolve and validate API key if client is not directly supplied
    resolved_key = (api_key or os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY).strip()
    if client is None and not resolved_key:
        raise ValueError(
            "OpenAI API key is missing. Set the OPENAI_API_KEY environment variable or pass api_key."
        )

    resolved_model = model or settings.OPENAI_MODEL

    # 2. Prepare evidence strictly from the result
    evidence_text = _format_investigation_evidence(result)

    system_instructions = (
        "You are GraphGuard's Security Intelligence Explainer. "
        "Your task is to analyze the provided security investigation evidence and explain the finding, "
        "its potential impact on connected systems, and recommended next steps.\n\n"
        "STRICT EVIDENCE-BASED CONSTRAINTS:\n"
        "1. Base your explanation SOLELY on the verified facts, services, vulnerabilities, owners, "
        "and dependency paths provided in the evidence below.\n"
        "2. NEVER invent, hallucinate, or extrapolate services, owners, vulnerabilities, dependencies, "
        "or credentials that are not present in the evidence.\n"
        "3. DO NOT recalculate, modify, or replace the deterministic numeric risk score or priority. "
        "Acknowledge the score and priority established by the risk engine.\n"
        "4. Structure your response into exactly three sections:\n"
        "   ### 1. Explanation\n"
        "   ### 2. Potential Impact\n"
        "   ### 3. Recommended Next Steps (bulleted list)\n"
    )

    user_prompt = (
        f"Please explain this security investigation finding based strictly on the following evidence:\n\n"
        f"{evidence_text}\n\n"
        f"Provide the explanation, potential impact, and recommended next steps."
    )

    # 3. Initialize client if needed
    if client is None:
        try:
            import openai
            client = openai.OpenAI(api_key=resolved_key)
        except Exception as exc:
            logger.error("Failed to initialize OpenAI client: %s", exc)
            raise RuntimeError(f"Failed to initialize OpenAI client: {exc}") from exc

    # 4. Invoke LLM via Responses API
    try:
        response = client.responses.create(
            model=resolved_model,
            instructions=system_instructions,
            input=[{"role": "user", "content": user_prompt}],
            temperature=0.2,
        )
    except Exception as exc:
        logger.error("OpenAI Responses API call failed: %s", exc)
        raise RuntimeError(f"OpenAI API error during explanation generation: {exc}") from exc

    # 5. Extract and parse response
    raw_text = _extract_text_from_response(response)
    explanation, potential_impact, steps = _parse_explanation_sections(raw_text)

    # If steps were not returned or parsed from LLM, preserve any existing recommended steps from result
    if not steps and result.recommended_next_steps:
        steps = list(result.recommended_next_steps)

    return InvestigationExplanation(
        explanation=explanation,
        potential_impact=potential_impact,
        recommended_next_steps=steps,
        raw_response=raw_text,
    )
