import csv
import io
import json
import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


def _safe_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if not s:
        return None
    # Remove common formatting
    s = s.replace(",", "")
    s = s.replace("₹", "").replace("Rs.", "").replace("INR", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def _to_cr(inr: Optional[float]) -> Optional[float]:
    if inr is None:
        return None
    return inr / 1e7


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


@dataclass
class ParsedGST:
    turnover_inr: Optional[float]
    months: Optional[int]
    # India-specific reconciliation signals (optional)
    gstr_2a_itc_inr: Optional[float] = None
    gstr_3b_itc_inr: Optional[float] = None
    gstr_2a_taxable_inr: Optional[float] = None
    gstr_3b_taxable_inr: Optional[float] = None


@dataclass
class ParsedITR:
    profit_inr: Optional[float]
    revenue_inr: Optional[float]


@dataclass
class ParsedBank:
    inflow_inr: Optional[float]
    outflow_inr: Optional[float]
    avg_balance_inr: Optional[float]
    min_balance_inr: Optional[float]
    bounce_count: int
    emi_debit_inr: Optional[float]
    txn_count: int
    # Forensic / circular trading heuristics (optional)
    pass_through_ratio: Optional[float] = None
    net_inflow_inr: Optional[float] = None
    net_retention_ratio: Optional[float] = None
    round_trip_pairs: int = 0
    round_trip_value_inr: Optional[float] = None
    round_trip_ratio: Optional[float] = None
    round_value_ratio: Optional[float] = None


def parse_json_bytes(b: bytes) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(b.decode("utf-8", errors="ignore"))
    except Exception:
        return None


def parse_csv_bytes(b: bytes) -> Tuple[List[Dict[str, str]], List[str]]:
    text = b.decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(text))
    rows: List[Dict[str, str]] = []
    for r in reader:
        if r is None:
            continue
        rows.append({(k or "").strip(): (v or "").strip() for k, v in r.items()})
    return rows, [h.strip() for h in (reader.fieldnames or [])]


def parse_gst(file_bytes: bytes, filename: str) -> Tuple[ParsedGST, List[str]]:
    warnings: List[str] = []
    name = (filename or "").lower()
    turnover_inr: Optional[float] = None
    months: Optional[int] = None
    gstr_2a_itc_inr: Optional[float] = None
    gstr_3b_itc_inr: Optional[float] = None
    gstr_2a_taxable_inr: Optional[float] = None
    gstr_3b_taxable_inr: Optional[float] = None

    if name.endswith(".json"):
        obj = parse_json_bytes(file_bytes) or {}
        turnover_inr = _safe_float(
            obj.get("turnover_inr")
            or obj.get("gst_turnover_inr")
            or obj.get("turnover")
            or obj.get("gstr_3b_turnover_inr")
            or obj.get("gstr_3b_taxable_inr")
        )
        months = int(obj.get("months")) if _safe_float(obj.get("months")) is not None else None
        gstr_2a_itc_inr = _safe_float(
            obj.get("gstr_2a_itc_inr")
            or obj.get("itc_2a_inr")
            or obj.get("itc_available_2a_inr")
            or obj.get("itc_available_inr")
        )
        gstr_3b_itc_inr = _safe_float(
            obj.get("gstr_3b_itc_inr")
            or obj.get("itc_3b_inr")
            or obj.get("itc_claimed_3b_inr")
            or obj.get("itc_claimed_inr")
        )
        gstr_2a_taxable_inr = _safe_float(
            obj.get("gstr_2a_taxable_inr")
            or obj.get("gstr_2a_taxable_value_inr")
            or obj.get("inward_taxable_inr")
            or obj.get("purchases_inr")
        )
        gstr_3b_taxable_inr = _safe_float(
            obj.get("gstr_3b_taxable_inr")
            or obj.get("gstr_3b_taxable_value_inr")
            or obj.get("outward_taxable_inr")
            or obj.get("taxable_turnover_inr")
        )
        if turnover_inr is None and gstr_3b_taxable_inr is not None:
            turnover_inr = gstr_3b_taxable_inr
        return (
            ParsedGST(
                turnover_inr=turnover_inr,
                months=months,
                gstr_2a_itc_inr=gstr_2a_itc_inr,
                gstr_3b_itc_inr=gstr_3b_itc_inr,
                gstr_2a_taxable_inr=gstr_2a_taxable_inr,
                gstr_3b_taxable_inr=gstr_3b_taxable_inr,
            ),
            warnings,
        )

    if name.endswith(".csv"):
        rows, headers = parse_csv_bytes(file_bytes)
        hmap = {h.lower(): h for h in headers}

        turnover_candidates = (
            "turnover",
            "taxable_value",
            "gross_turnover",
            "gst_turnover",
            "gstr_3b_turnover_inr",
            "gstr_3b_taxable_inr",
            "gstr_3b_taxable_value_inr",
        )
        turnover_col = next((hmap.get(k) for k in turnover_candidates if hmap.get(k)), None)

        itc_2a_candidates = ("gstr_2a_itc_inr", "itc_2a_inr", "itc_available_2a_inr", "itc_available_inr")
        itc_3b_candidates = ("gstr_3b_itc_inr", "itc_3b_inr", "itc_claimed_3b_inr", "itc_claimed_inr")
        taxable_2a_candidates = ("gstr_2a_taxable_inr", "gstr_2a_taxable_value_inr", "inward_taxable_inr", "purchases_inr")
        taxable_3b_candidates = ("gstr_3b_taxable_inr", "gstr_3b_taxable_value_inr", "outward_taxable_inr", "taxable_turnover_inr")

        itc_2a_col = next((hmap.get(k) for k in itc_2a_candidates if hmap.get(k)), None)
        itc_3b_col = next((hmap.get(k) for k in itc_3b_candidates if hmap.get(k)), None)
        taxable_2a_col = next((hmap.get(k) for k in taxable_2a_candidates if hmap.get(k)), None)
        taxable_3b_col = next((hmap.get(k) for k in taxable_3b_candidates if hmap.get(k)), None)

        def _sum_col(col: Optional[str]) -> Optional[float]:
            if not col:
                return None
            s = 0.0
            c = 0
            for r in rows:
                v = _safe_float(r.get(col))
                if v is None:
                    continue
                s += v
                c += 1
            return s if c > 0 else None

        turnover_inr = _sum_col(turnover_col)
        gstr_2a_itc_inr = _sum_col(itc_2a_col)
        gstr_3b_itc_inr = _sum_col(itc_3b_col)
        gstr_2a_taxable_inr = _sum_col(taxable_2a_col)
        gstr_3b_taxable_inr = _sum_col(taxable_3b_col)

        if turnover_inr is None and gstr_3b_taxable_inr is not None:
            turnover_inr = gstr_3b_taxable_inr

        months = len(rows) or None
        if turnover_inr is None and all(x is None for x in (gstr_2a_itc_inr, gstr_3b_itc_inr, gstr_2a_taxable_inr, gstr_3b_taxable_inr)):
            warnings.append("GST CSV: missing turnover/summary columns (expected 'turnover'/'taxable_value' or GSTR-3B fields).")

        return (
            ParsedGST(
                turnover_inr=turnover_inr,
                months=months,
                gstr_2a_itc_inr=gstr_2a_itc_inr,
                gstr_3b_itc_inr=gstr_3b_itc_inr,
                gstr_2a_taxable_inr=gstr_2a_taxable_inr,
                gstr_3b_taxable_inr=gstr_3b_taxable_inr,
            ),
            warnings,
        )

    warnings.append("GST file not parsed (supported: .csv, .json).")
    return ParsedGST(turnover_inr=None, months=None), warnings


def parse_itr(file_bytes: bytes, filename: str) -> Tuple[ParsedITR, List[str]]:
    warnings: List[str] = []
    name = (filename or "").lower()
    profit_inr: Optional[float] = None
    revenue_inr: Optional[float] = None

    if name.endswith(".json"):
        obj = parse_json_bytes(file_bytes) or {}
        profit_inr = _safe_float(obj.get("profit_inr") or obj.get("pbt_inr") or obj.get("pat_inr") or obj.get("profit"))
        revenue_inr = _safe_float(obj.get("revenue_inr") or obj.get("sales_inr") or obj.get("revenue"))
        return ParsedITR(profit_inr=profit_inr, revenue_inr=revenue_inr), warnings

    if name.endswith(".csv"):
        rows, headers = parse_csv_bytes(file_bytes)
        # Common patterns: one-row summary with profit/revenue columns
        profit_col = next((h for h in headers if h.lower() in {"profit", "profit_inr", "pat", "pbt", "net_profit"}), None)
        revenue_col = next((h for h in headers if h.lower() in {"revenue", "revenue_inr", "sales", "turnover"}), None)
        if rows:
            r0 = rows[0]
            profit_inr = _safe_float(r0.get(profit_col)) if profit_col else None
            revenue_inr = _safe_float(r0.get(revenue_col)) if revenue_col else None
        if profit_inr is None and profit_col is None:
            warnings.append("ITR CSV: missing profit column (expected 'profit'/'pat'/'pbt').")
        return ParsedITR(profit_inr=profit_inr, revenue_inr=revenue_inr), warnings

    warnings.append("ITR file not parsed (supported: .csv, .json).")
    return ParsedITR(profit_inr=None, revenue_inr=None), warnings


def parse_bank(file_bytes: bytes, filename: str) -> Tuple[ParsedBank, List[str]]:
    warnings: List[str] = []
    name = (filename or "").lower()

    if not name.endswith(".csv"):
        warnings.append("Bank statement not parsed (supported: .csv).")
        return ParsedBank(
            inflow_inr=None,
            outflow_inr=None,
            avg_balance_inr=None,
            min_balance_inr=None,
            bounce_count=0,
            emi_debit_inr=None,
            txn_count=0,
        ), warnings

    rows, headers = parse_csv_bytes(file_bytes)
    hmap = {h.lower(): h for h in headers}

    credit_col = hmap.get("credit") or hmap.get("cr") or hmap.get("deposit")
    debit_col = hmap.get("debit") or hmap.get("dr") or hmap.get("withdrawal")
    bal_col = hmap.get("balance") or hmap.get("closing_balance") or hmap.get("closing balance")
    desc_col = hmap.get("description") or hmap.get("narration") or hmap.get("particulars")
    bounce_col = hmap.get("bounce") or hmap.get("cheque_bounce") or hmap.get("cheque bounce")

    inflow = 0.0
    outflow = 0.0
    emi_debits = 0.0
    bal_sum = 0.0
    bal_count = 0
    min_bal = math.inf
    bounces = 0
    txn_count = 0
    # Forensic stats
    amt_count = 0
    round_amt_count = 0
    credit_buckets: Dict[int, int] = {}
    debit_buckets: Dict[int, int] = {}

    def _bucket(v: float, bucket_inr: int = 1000) -> int:
        if bucket_inr <= 0:
            bucket_inr = 1000
        return int(round(v / bucket_inr) * bucket_inr)

    def _is_round_large(v: float) -> bool:
        # Heuristic: large, round-number transactions can be a weak signal in circular flows.
        if v < 50_000:
            return False
        return abs(v - round(v / 10_000) * 10_000) <= 1.0

    for r in rows:
        txn_count += 1
        if credit_col:
            v = _safe_float(r.get(credit_col))
            if v is not None:
                cv = max(0.0, v)
                inflow += cv
                if cv > 0:
                    amt_count += 1
                    if _is_round_large(cv):
                        round_amt_count += 1
                    b = _bucket(cv)
                    credit_buckets[b] = credit_buckets.get(b, 0) + 1
        if debit_col:
            v = _safe_float(r.get(debit_col))
            if v is not None:
                dv = max(0.0, v)
                outflow += dv
                if desc_col:
                    d = (r.get(desc_col) or "").lower()
                    if any(k in d for k in ("emi", "loan", "interest", "instalment", "installment")):
                        emi_debits += dv
                if dv > 0:
                    amt_count += 1
                    if _is_round_large(dv):
                        round_amt_count += 1
                    b = _bucket(dv)
                    debit_buckets[b] = debit_buckets.get(b, 0) + 1
        if bal_col:
            v = _safe_float(r.get(bal_col))
            if v is not None:
                bal_sum += v
                bal_count += 1
                min_bal = min(min_bal, v)
        if bounce_col:
            v = _safe_float(r.get(bounce_col))
            if v is not None and v > 0:
                bounces += int(v)
        elif desc_col:
            d = (r.get(desc_col) or "").lower()
            if any(k in d for k in ("cheque bounce", "chq bounce", "insufficient", "return", "rtn", "bounced")):
                bounces += 1

    if credit_col is None and debit_col is None:
        warnings.append("Bank CSV: missing 'credit'/'debit' columns (expected 'credit'/'debit'/'balance').")
    if bal_count == 0 and bal_col is None:
        warnings.append("Bank CSV: missing 'balance' column (expected 'balance').")

    avg_bal = (bal_sum / bal_count) if bal_count > 0 else None
    min_bal_out = None if min_bal is math.inf else float(min_bal)

    pass_through_ratio = None
    net_inflow = None
    net_retention_ratio = None
    if inflow > 0 and outflow >= 0:
        pass_through_ratio = outflow / inflow
        net_inflow = inflow - outflow
        net_retention_ratio = net_inflow / inflow

    # Approximate round-tripping: count/value of mirrored credit+debit buckets
    round_trip_pairs = 0
    round_trip_value = 0.0
    for b, ccount in credit_buckets.items():
        dcount = debit_buckets.get(b, 0)
        if dcount <= 0:
            continue
        m = min(ccount, dcount)
        round_trip_pairs += m
        round_trip_value += float(m) * float(b)
    round_trip_ratio = (round_trip_value / inflow) if inflow > 0 else None
    round_value_ratio = (round_amt_count / amt_count) if amt_count > 0 else None

    return (
        ParsedBank(
            inflow_inr=inflow if inflow > 0 else None,
            outflow_inr=outflow if outflow > 0 else None,
            avg_balance_inr=avg_bal,
            min_balance_inr=min_bal_out,
            bounce_count=bounces,
            emi_debit_inr=emi_debits if emi_debits > 0 else None,
            txn_count=txn_count,
            pass_through_ratio=pass_through_ratio,
            net_inflow_inr=net_inflow,
            net_retention_ratio=net_retention_ratio,
            round_trip_pairs=round_trip_pairs,
            round_trip_value_inr=round_trip_value if round_trip_value > 0 else None,
            round_trip_ratio=round_trip_ratio,
            round_value_ratio=round_value_ratio,
        ),
        warnings,
    )


def compute_credit_intelligence(
    gst: ParsedGST,
    itr: ParsedITR,
    bank: ParsedBank,
    officer_adjustment: float = 0.0,
) -> Dict[str, Any]:
    alerts: List[str] = []

    gst_turnover = gst.turnover_inr
    itr_profit = itr.profit_inr
    bank_inflow = bank.inflow_inr
    bank_outflow = bank.outflow_inr

    # Basic cross-verification alerts
    if gst_turnover is not None and bank_inflow is not None and bank_inflow > 0:
        denom = max(gst_turnover, bank_inflow)
        variance = abs(gst_turnover - bank_inflow) / denom if denom > 0 else 0.0
        if variance >= 0.25:
            alerts.append("High GST–Bank inflow mismatch detected.")
        elif variance >= 0.12:
            alerts.append("Moderate GST–Bank inflow mismatch detected.")
        elif gst_turnover < 0.6 * bank_inflow:
            alerts.append("GST turnover materially below bank inflows (possible non-operating credits).")

    if itr_profit is not None and gst_turnover is not None and gst_turnover > 0:
        margin = itr_profit / gst_turnover
        if margin < 0.02:
            alerts.append("Low reported profit margin vs GST turnover.")
        elif margin > 0.35:
            alerts.append("Unusually high profit margin vs GST turnover (verify classification).")

    # Revenue inflation / reporting variance: ITR revenue vs GST turnover
    if itr.revenue_inr is not None and gst_turnover is not None and itr.revenue_inr > 0 and gst_turnover > 0:
        denom = max(itr.revenue_inr, gst_turnover)
        variance = abs(itr.revenue_inr - gst_turnover) / denom if denom > 0 else 0.0
        if variance >= 0.25:
            alerts.append(
                "Material ITR revenue ↔ GST turnover mismatch (possible revenue inflation/deflation or period shifting; review recognition & filing periods)."
            )
        elif variance >= 0.12:
            alerts.append("Moderate ITR revenue ↔ GST turnover variance observed (timing difference possible).")

    # India-specific GST reconciliation (GSTR-2A vs GSTR-3B)
    if gst.gstr_2a_itc_inr is not None and gst.gstr_3b_itc_inr is not None:
        denom = max(gst.gstr_2a_itc_inr, gst.gstr_3b_itc_inr, 0.0)
        if denom > 0:
            variance = abs(gst.gstr_3b_itc_inr - gst.gstr_2a_itc_inr) / denom
            pct = int(round(variance * 100))
            if variance >= 0.15:
                alerts.append(
                    f"GSTR-2A vs GSTR-3B ITC mismatch: {pct}% variance (possible ITC over-claim / synthetic invoicing; circular-trading vector)."
                )
            elif variance >= 0.07:
                alerts.append(f"Moderate GSTR-2A vs GSTR-3B ITC variance: {pct}% (review timing/eligibility).")

    if gst.gstr_2a_taxable_inr is not None and gst.gstr_3b_taxable_inr is not None:
        denom = max(gst.gstr_2a_taxable_inr, gst.gstr_3b_taxable_inr, 0.0)
        if denom > 0:
            variance = abs(gst.gstr_3b_taxable_inr - gst.gstr_2a_taxable_inr) / denom
            pct = int(round(variance * 100))
            if variance >= 0.20:
                alerts.append(
                    f"GSTR-2A vs GSTR-3B taxable value mismatch: {pct}% (possible invoice mismatch / reporting variance)."
                )

    if bank.avg_balance_inr is not None and bank.min_balance_inr is not None:
        if bank.min_balance_inr <= 0:
            alerts.append("Negative/near-zero bank balance observed.")
        if bank.min_balance_inr < 0.25 * bank.avg_balance_inr:
            alerts.append("Declining/volatile bank balances observed.")

    if bank.bounce_count >= 3:
        alerts.append(f"{bank.bounce_count} cheque/return events detected.")
    elif bank.bounce_count > 0:
        alerts.append("Cheque return event detected.")

    # Risk scoring (0..100; higher is worse)
    score = 35.0  # baseline
    if gst_turnover is None:
        score += 10
    if itr_profit is None:
        score += 10
    if bank_inflow is None:
        score += 10

    # Mismatch penalties
    if gst_turnover is not None and bank_inflow is not None and bank_inflow > 0:
        denom = max(gst_turnover, bank_inflow)
        variance = abs(gst_turnover - bank_inflow) / denom if denom > 0 else 0.0
        score += _clamp(variance * 100.0 * 0.25, 0.0, 25.0)

    if itr_profit is not None and gst_turnover is not None and gst_turnover > 0:
        margin = itr_profit / gst_turnover
        if margin < 0.03:
            score += 12
        elif margin < 0.06:
            score += 6
        elif margin > 0.30:
            score += 6

    if itr.revenue_inr is not None and gst_turnover is not None and itr.revenue_inr > 0 and gst_turnover > 0:
        denom = max(itr.revenue_inr, gst_turnover)
        variance = abs(itr.revenue_inr - gst_turnover) / denom if denom > 0 else 0.0
        score += _clamp(variance * 100.0 * 0.08, 0.0, 8.0)

    # GST reconciliation penalty (2A vs 3B)
    if gst.gstr_2a_itc_inr is not None and gst.gstr_3b_itc_inr is not None:
        denom = max(gst.gstr_2a_itc_inr, gst.gstr_3b_itc_inr, 0.0)
        if denom > 0:
            variance = abs(gst.gstr_3b_itc_inr - gst.gstr_2a_itc_inr) / denom
            score += _clamp(variance * 100.0 * 0.12, 0.0, 10.0)

    # Circular trading heuristic: high pass-through + mirrored flows, especially when GST aligns with bank inflows
    circular_signal = 0.0
    if bank_inflow is not None and bank_inflow > 0 and bank_outflow is not None and bank_outflow > 0:
        churn = bank.pass_through_ratio if bank.pass_through_ratio is not None else (bank_outflow / bank_inflow)
        mirrored = bank.round_trip_ratio if bank.round_trip_ratio is not None else 0.0
        retention = abs(bank.net_retention_ratio) if bank.net_retention_ratio is not None else abs((bank_inflow - bank_outflow) / bank_inflow)

        churn_score = 1.0 if (0.92 <= churn <= 1.08) else (0.6 if (0.85 <= churn <= 1.15) else 0.0)
        mirror_score = 1.0 if mirrored >= 0.55 else (0.6 if mirrored >= 0.35 else 0.0)
        retention_score = 1.0 if retention <= 0.10 else (0.6 if retention <= 0.18 else 0.0)
        circular_signal = (0.45 * churn_score) + (0.35 * mirror_score) + (0.20 * retention_score)

        gst_alignment = 0.0
        if gst_turnover is not None and gst_turnover > 0:
            denom = max(gst_turnover, bank_inflow)
            variance = abs(gst_turnover - bank_inflow) / denom if denom > 0 else 1.0
            gst_alignment = 1.0 if variance <= 0.12 else (0.6 if variance <= 0.25 else 0.0)
        circular_signal = circular_signal * (0.6 + 0.4 * gst_alignment)

    if circular_signal >= 0.78:
        alerts.append("Circular trading risk signal: high cash-flow pass-through with mirrored debit/credit patterns (GST × Bank).")
        score += 10
    elif circular_signal >= 0.55:
        alerts.append("Possible circular trading pattern: elevated pass-through and mirrored flows (review top counterparties).")
        score += 5

    if bank.avg_balance_inr is not None and bank.avg_balance_inr <= 0:
        score += 12
    if bank.min_balance_inr is not None and bank.min_balance_inr < 0:
        score += 10

    score += _clamp(bank.bounce_count * 4.0, 0.0, 18.0)

    # Officer adjustment reduces/increases risk
    score += (-1.0 * officer_adjustment)
    score = _clamp(score, 0.0, 100.0)

    if score <= 35:
        risk_status = "Low"
    elif score <= 65:
        risk_status = "Moderate"
    else:
        risk_status = "High"

    # Minimal "AI" narrative (deterministic template)
    parts: List[str] = []
    if gst_turnover is not None:
        parts.append("GST turnover indicates operating scale.")
    if bank_inflow is not None:
        parts.append("Bank inflows support cash-flow visibility.")
    if itr_profit is not None:
        parts.append("ITR profitability supports repayment capacity.")
    if not parts:
        parts.append("Insufficient document signal; proceed with caution.")

    if alerts:
        parts.append("Key alerts: " + "; ".join(alerts[:3]) + ".")

    summary = " ".join(parts)

    return {
        "risk": {
            "score": round(float(score), 1),
            "status": risk_status,
        },
        "alerts": alerts,
        "extracted": {
            "gst": {
                "turnover_inr": gst_turnover,
                "turnover_cr": round(_to_cr(gst_turnover), 2) if gst_turnover is not None else None,
                "months": gst.months,
                "gstr_2a_itc_inr": gst.gstr_2a_itc_inr,
                "gstr_3b_itc_inr": gst.gstr_3b_itc_inr,
                "gstr_2a_taxable_inr": gst.gstr_2a_taxable_inr,
                "gstr_3b_taxable_inr": gst.gstr_3b_taxable_inr,
            },
            "itr": {
                "profit_inr": itr_profit,
                "profit_cr": round(_to_cr(itr_profit), 2) if itr_profit is not None else None,
                "revenue_inr": itr.revenue_inr,
                "revenue_cr": round(_to_cr(itr.revenue_inr), 2) if itr.revenue_inr is not None else None,
            },
            "bank": {
                "inflow_inr": bank_inflow,
                "inflow_cr": round(_to_cr(bank_inflow), 2) if bank_inflow is not None else None,
                "outflow_inr": bank.outflow_inr,
                "outflow_cr": round(_to_cr(bank.outflow_inr), 2) if bank.outflow_inr is not None else None,
                "avg_balance_inr": bank.avg_balance_inr,
                "min_balance_inr": bank.min_balance_inr,
                "bounce_count": bank.bounce_count,
                "txn_count": bank.txn_count,
                # If bank statement includes EMI/loan/interest debits, treat as debt service proxy.
                "debt_service_inr": bank.emi_debit_inr,
                "debt_service_cr": round(_to_cr(bank.emi_debit_inr), 2) if bank.emi_debit_inr is not None else None,
                "pass_through_ratio": round(float(bank.pass_through_ratio), 3) if bank.pass_through_ratio is not None else None,
                "net_inflow_inr": bank.net_inflow_inr,
                "net_retention_ratio": round(float(bank.net_retention_ratio), 3) if bank.net_retention_ratio is not None else None,
                "round_trip_pairs": bank.round_trip_pairs,
                "round_trip_value_inr": bank.round_trip_value_inr,
                "round_trip_ratio": round(float(bank.round_trip_ratio), 3) if bank.round_trip_ratio is not None else None,
                "round_value_ratio": round(float(bank.round_value_ratio), 3) if bank.round_value_ratio is not None else None,
            },
        },
        "credit_summary": summary,
    }
