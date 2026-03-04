from typing import Any, Dict, List, Optional


def _pct_variance(a: Optional[float], b: Optional[float]) -> Optional[int]:
    try:
        if a is None or b is None:
            return None
        denom = max(float(a), float(b), 0.0)
        if denom <= 0:
            return None
        return int(round(abs(float(b) - float(a)) / denom * 100))
    except Exception:
        return None


def build_audit_links(
    *,
    gst_filename: Optional[str],
    itr_filename: Optional[str],
    bank_filename: Optional[str],
    qual_filename: Optional[str],
    extracted: Dict[str, Any],
    dossier: Optional[Dict[str, Any]] = None,
    sentiment: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Audit-link traceability (demo-friendly):
    Provide a structured, source-to-decision map for key risk signals.
    """
    items: List[Dict[str, Any]] = []

    gst = (extracted or {}).get("gst") or {}
    itr = (extracted or {}).get("itr") or {}
    bank = (extracted or {}).get("bank") or {}

    # 1) GSTR-2A vs 3B reconciliation
    itc_2a = gst.get("gstr_2a_itc_inr")
    itc_3b = gst.get("gstr_3b_itc_inr")
    itc_var = _pct_variance(itc_2a, itc_3b)
    if itc_var is not None:
        items.append(
            {
                "id": "gst_recon_itc",
                "title": "GSTR-2A vs GSTR-3B reconciliation (ITC)",
                "source": {"doc": "GST", "file": gst_filename or "gst_docs", "fields": ["gstr_2a_itc_inr", "gstr_3b_itc_inr"]},
                "evidence": {"gstr_2a_itc_inr": itc_2a, "gstr_3b_itc_inr": itc_3b, "variance_pct": itc_var},
            }
        )

    # 2) GST vs Bank inflow mismatch
    turn = gst.get("turnover_inr")
    inflow = bank.get("inflow_inr")
    var = _pct_variance(turn, inflow)
    if var is not None:
        items.append(
            {
                "id": "gst_bank_mismatch",
                "title": "GST ↔ Bank inflow triangulation",
                "source": {"doc": "GST+Bank", "file": f"{gst_filename or 'gst_docs'} + {bank_filename or 'bank_docs'}", "fields": ["turnover_inr", "inflow_inr"]},
                "evidence": {"gst_turnover_inr": turn, "bank_inflow_inr": inflow, "variance_pct": var},
            }
        )

    # 3) Truth-Seeker utilities vs revenue growth
    rev = itr.get("revenue_inr")
    rev_prev = itr.get("revenue_prev_inr")
    util = itr.get("electricity_expense_inr")
    util_prev = itr.get("electricity_expense_prev_inr")
    rev_var = _pct_variance(rev_prev, rev)
    util_var = _pct_variance(util_prev, util)
    if rev_var is not None and util_var is not None:
        items.append(
            {
                "id": "triangulation_utilities",
                "title": "Truth-Seeker: Utilities vs Revenue growth",
                "source": {"doc": "ITR/P&L", "file": itr_filename or "itr_docs", "fields": ["revenue_inr", "revenue_prev_inr", "electricity_expense_inr", "electricity_expense_prev_inr"]},
                "evidence": {
                    "revenue_inr": rev,
                    "revenue_prev_inr": rev_prev,
                    "revenue_growth_pct": rev_var,
                    "utilities_inr": util,
                    "utilities_prev_inr": util_prev,
                    "utilities_growth_pct": util_var,
                },
            }
        )

    # 4) Circular trading heuristics
    if bank.get("pass_through_ratio") is not None or bank.get("round_trip_ratio") is not None:
        items.append(
            {
                "id": "circular_trading",
                "title": "Circular trading heuristic (bank pass-through + mirrored flows)",
                "source": {"doc": "Bank", "file": bank_filename or "bank_docs", "fields": ["pass_through_ratio", "round_trip_pairs", "round_trip_ratio"]},
                "evidence": {
                    "pass_through_ratio": bank.get("pass_through_ratio"),
                    "round_trip_pairs": bank.get("round_trip_pairs"),
                    "round_trip_ratio": bank.get("round_trip_ratio"),
                },
            }
        )

    # 5) MCA + e-Courts research pointers
    if dossier:
        items.append(
            {
                "id": "research_sources",
                "title": "External research dossier (MCA + e-Courts)",
                "source": {"doc": "MCA+e-Courts", "file": "samples/research_dossiers.json (demo fixture)", "fields": ["mca", "ecourts", "governance"]},
                "evidence": {
                    "matched_on": dossier.get("matched_on"),
                    "mca_cin": (dossier.get("mca") or {}).get("cin") if isinstance(dossier.get("mca"), dict) else None,
                    "ecourts_ongoing": (dossier.get("ecourts") or {}).get("ongoing_count") if isinstance(dossier.get("ecourts"), dict) else None,
                },
            }
        )

    # 6) EWS sentiment
    if sentiment:
        items.append(
            {
                "id": "ews_sentiment",
                "title": "EWS sentiment (qualitative disclosures / minutes / rating notes)",
                "source": {"doc": "Qualitative", "file": qual_filename or "qual_docs", "fields": ["sentiment_score", "signals"]},
                "evidence": {"label": sentiment.get("label"), "score": sentiment.get("score"), "signals": sentiment.get("signals")},
            }
        )

    return {"items": items}

