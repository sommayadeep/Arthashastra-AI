import datetime
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple


def _normalize_key(value: str) -> str:
    v = (value or "").strip().lower()
    v = re.sub(r"[^a-z0-9]+", " ", v)
    v = re.sub(r"\s+", " ", v).strip()
    return v


def _split_promoters(promoters: Optional[str]) -> List[str]:
    raw = (promoters or "").strip()
    if not raw:
        return []
    parts = re.split(r"[,\n;/]+", raw)
    return [p.strip() for p in parts if p and p.strip()]


def _load_fixture() -> Dict[str, Any]:
    """
    Loads offline fixture so the demo works without internet access.
    In production, replace with authenticated connectors to MCA / e-Courts.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, "samples", "research_dossiers.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _find_fixture_record(company: Optional[str], promoters: Optional[str]) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    fixtures = _load_fixture()
    companies = fixtures.get("companies") if isinstance(fixtures.get("companies"), dict) else {}
    promoters_map = fixtures.get("promoters") if isinstance(fixtures.get("promoters"), dict) else {}

    if company:
        nk = _normalize_key(company)
        for k, v in companies.items():
            if _normalize_key(k) == nk and isinstance(v, dict):
                return v, "company"

    for p in _split_promoters(promoters):
        nk = _normalize_key(p)
        for k, v in promoters_map.items():
            if _normalize_key(k) == nk and isinstance(v, dict):
                return v, "promoter"

    return None, None


def compute_research_dossier(company: Optional[str], promoters: Optional[str], sector: Optional[str]) -> Dict[str, Any]:
    """
    Returns a structured research dossier (MCA + e-Courts) to support
    promoter/litigation due diligence and qualitative underwriting.
    """
    fetched_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    record, matched_on = _find_fixture_record(company, promoters)

    dossier: Dict[str, Any] = {
        "fetched_at": fetched_at,
        "matched_on": matched_on,
        "sources": {
            "mca": "MCA filings (company master data, directors, charges, compliance history)",
            "ecourts": "e-Courts / NCLT case metadata (pending/closed matters, hearing dates)",
        },
        "mca": (record or {}).get("mca") if isinstance(record, dict) else None,
        "ecourts": (record or {}).get("ecourts") if isinstance(record, dict) else None,
        "sector": sector or None,
    }
    return dossier


def research_alerts(dossier: Dict[str, Any]) -> List[str]:
    """
    Converts dossier signals into alert strings for the UI.
    """
    alerts: List[str] = []
    mca = dossier.get("mca") if isinstance(dossier, dict) else None
    ec = dossier.get("ecourts") if isinstance(dossier, dict) else None

    if isinstance(mca, dict):
        charges = mca.get("charges")
        if isinstance(charges, dict):
            active = charges.get("active_count")
            try:
                active_i = int(active)
            except Exception:
                active_i = None
            if active_i is not None and active_i > 0:
                lender = charges.get("lender") or "secured lender"
                alerts.append(f"MCA filings: {active_i} active charge(s) detected ({lender}).")
        flags = mca.get("flags")
        if isinstance(flags, list):
            for f in flags[:2]:
                if f:
                    alerts.append(f"MCA compliance: {str(f)}")

    if isinstance(ec, dict):
        try:
            ongoing = int(ec.get("ongoing_count") or 0)
        except Exception:
            ongoing = 0
        if ongoing > 0:
            alerts.append(f"e-Courts: {ongoing} ongoing litigation matter(s) found (review case status & exposure).")

        highlights = ec.get("highlights")
        if isinstance(highlights, list):
            for h in highlights[:2]:
                if h:
                    alerts.append(f"Litigation highlight: {str(h)}")

    return alerts

