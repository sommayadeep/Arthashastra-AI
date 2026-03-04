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
    dossier["governance"] = _governance_signals(dossier.get("mca"))
    dossier["network"] = _build_network_graph(company, dossier.get("mca"))
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

    gov = dossier.get("governance") if isinstance(dossier, dict) else None
    if isinstance(gov, dict):
        flags = gov.get("flags")
        if isinstance(flags, list):
            for f in flags[:2]:
                if f:
                    alerts.append(f"Governance network: {str(f)}")

    return alerts


def _to_int(v) -> Optional[int]:
    try:
        if v is None:
            return None
        return int(v)
    except Exception:
        return None


def _governance_signals(mca: Any) -> Dict[str, Any]:
    """
    Governance red-flags (network effect):
    - Ghost directors (10+ board seats)
    - Auditor overlap across related entities (independence risk)
    """
    if not isinstance(mca, dict):
        return {"flags": [], "ghost_directors": [], "auditor_overlap": []}

    flags: List[str] = []
    ghost: List[Dict[str, Any]] = []
    overlap: List[Dict[str, Any]] = []

    directors = mca.get("directors")
    if isinstance(directors, list):
        for d in directors:
            if not isinstance(d, dict):
                continue
            name = d.get("name") or "Director"
            seats = _to_int(d.get("board_seats") or d.get("directorships") or d.get("boards"))
            distressed = _to_int(d.get("distressed_boards") or d.get("failed_boards"))
            if seats is not None and seats >= 10:
                ghost.append({"name": name, "board_seats": seats, "distressed_boards": distressed or 0})
                flags.append(f"Ghost director risk: {name} holds {seats}+ board seats.")
            if distressed is not None and distressed >= 3:
                flags.append(f"Board contagion risk: {name} sits on {distressed} distressed boards.")

    auditor = mca.get("statutory_auditor")
    auditor_firm = auditor.get("firm") if isinstance(auditor, dict) else None

    related = mca.get("related_entities")
    if auditor_firm and isinstance(related, list):
        for ent in related:
            if not isinstance(ent, dict):
                continue
            firm = ent.get("auditor_firm")
            pct = ent.get("cross_holding_pct")
            pct_f = None
            try:
                pct_f = float(pct) if pct is not None else None
            except Exception:
                pct_f = None
            if firm and _normalize_key(firm) == _normalize_key(auditor_firm) and (pct_f is None or pct_f >= 10):
                overlap.append({"entity": ent.get("name"), "auditor_firm": auditor_firm, "cross_holding_pct": pct_f})
                flags.append(
                    f"Auditor independence risk: {auditor_firm} also audits related entity {ent.get('name')} (cross-holding {pct_f if pct_f is not None else 'N/A'}%)."
                )

    return {"flags": flags, "ghost_directors": ghost, "auditor_overlap": overlap}


def _build_network_graph(company: Optional[str], mca: Any) -> Dict[str, Any]:
    """
    Minimal knowledge-graph spec for client-side rendering (no heavy graph libs).
    """
    if not isinstance(mca, dict):
        return {"nodes": [], "edges": []}

    company_name = company or "Entity"
    nodes: List[Dict[str, Any]] = [{"id": "company", "label": company_name, "type": "company"}]
    edges: List[Dict[str, Any]] = []

    auditor = mca.get("statutory_auditor")
    if isinstance(auditor, dict) and auditor.get("firm"):
        nodes.append({"id": "auditor", "label": str(auditor.get("firm")), "type": "auditor"})
        edges.append({"from": "company", "to": "auditor", "type": "audited_by"})

    directors = mca.get("directors")
    if isinstance(directors, list):
        for i, d in enumerate(directors[:8]):  # keep it compact
            if not isinstance(d, dict):
                continue
            did = f"dir_{i}"
            nodes.append({"id": did, "label": str(d.get("name") or "Director"), "type": "director"})
            edges.append({"from": "company", "to": did, "type": "director_of"})

    related = mca.get("related_entities")
    if isinstance(related, list):
        for i, ent in enumerate(related[:6]):
            if not isinstance(ent, dict):
                continue
            rid = f"rel_{i}"
            label = str(ent.get("name") or "Related Entity")
            nodes.append({"id": rid, "label": label, "type": "related"})
            edges.append({"from": "company", "to": rid, "type": "related_party"})
            # Optional auditor overlap edge for graph emphasis
            if ent.get("auditor_firm") and isinstance(auditor, dict) and auditor.get("firm"):
                if _normalize_key(ent.get("auditor_firm")) == _normalize_key(auditor.get("firm")):
                    edges.append({"from": "auditor", "to": rid, "type": "audits"})

    return {"nodes": nodes, "edges": edges}
