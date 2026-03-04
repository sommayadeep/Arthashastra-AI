import re
from typing import Any, Dict, List, Optional, Tuple


HIGH_RISK_PHRASES = (
    "going concern",
    "material uncertainty",
    "qualified opinion",
    "adverse opinion",
    "default",
    "wilful default",
    "fraud",
    "forensic",
    "resignation",
    "restatement",
    "liquidity crunch",
    "cash crunch",
    "covenant breach",
    "stressed",
    "litigation",
    "notice of demand",
    "nclt",
    "insolvency",
)

MODERATE_RISK_PHRASES = (
    "delay",
    "renegotiate",
    "tight liquidity",
    "working capital",
    "provision",
    "contingent liability",
    "dispute",
    "write-off",
    "impairment",
    "one-time",
    "exceptional item",
    "reclassification",
    "change in accounting policy",
)

DEFENSIVE_MARKERS = (
    "however",
    "notwithstanding",
    "subject to",
    "except that",
    "management believes",
    "we reiterate",
    "clarification",
)


def _score_text(text: str) -> Tuple[float, List[str]]:
    t = (text or "").lower()
    hits: List[str] = []
    score = 35.0  # baseline

    for p in HIGH_RISK_PHRASES:
        if p in t:
            hits.append(p)
            score += 14

    for p in MODERATE_RISK_PHRASES:
        if p in t:
            hits.append(p)
            score += 7

    defensiveness = sum(t.count(p) for p in DEFENSIVE_MARKERS)
    score += min(defensiveness * 2.0, 12.0)

    return min(max(score, 0.0), 100.0), hits


def _label(score: float) -> str:
    if score >= 75:
        return "Elevated"
    if score >= 55:
        return "Watchlist"
    return "Stable"


def _extract_year_blocks(text: str) -> List[Tuple[str, str]]:
    """
    Supports simple formats like:
      FY2023: ...
      FY2024: ...
      FY2025: ...
    """
    blocks: List[Tuple[str, str]] = []
    for line in (text or "").splitlines():
        m = re.match(r"^\s*(FY\s*20\d{2}|20\d{2})\s*:\s*(.+)\s*$", line.strip(), re.IGNORECASE)
        if not m:
            continue
        year = re.sub(r"\s+", "", m.group(1)).upper()
        body = m.group(2).strip()
        if body:
            blocks.append((year, body))
    return blocks


def compute_ews_sentiment(qual_text: Optional[str], primary_insights: Optional[str] = None) -> Dict[str, Any]:
    """
    Lightweight early-warning signal (EWS) sentiment for demo:
    - Scores qualitative text (board minutes / rating notes / site-visit notes)
    - Optionally extracts year-labelled blocks for a 3Y heatmap
    """
    combined = "\n".join([x for x in [(qual_text or "").strip(), (primary_insights or "").strip()] if x])
    overall_score, hits = _score_text(combined)

    trend = []
    blocks = _extract_year_blocks(qual_text or "")
    for year, body in blocks[:6]:
        s, _ = _score_text(body)
        trend.append({"period": year, "score": round(float(s), 1), "label": _label(s)})

    # Keep only unique hits, preserve order
    seen = set()
    uniq_hits = []
    for h in hits:
        if h in seen:
            continue
        seen.add(h)
        uniq_hits.append(h)

    return {
        "score": round(float(overall_score), 1),
        "label": _label(overall_score),
        "signals": uniq_hits[:12],
        "trend": trend[:3],
    }

