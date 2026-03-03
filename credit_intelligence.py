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

    if name.endswith(".json"):
        obj = parse_json_bytes(file_bytes) or {}
        turnover_inr = _safe_float(obj.get("turnover_inr") or obj.get("gst_turnover_inr") or obj.get("turnover"))
        months = int(obj.get("months")) if _safe_float(obj.get("months")) is not None else None
        return ParsedGST(turnover_inr=turnover_inr, months=months), warnings

    if name.endswith(".csv"):
        rows, headers = parse_csv_bytes(file_bytes)
        # Heuristics: look for turnover columns
        cand_cols = [h for h in headers if h.lower() in {"turnover", "taxable_value", "gross_turnover", "gst_turnover"}]
        if not cand_cols:
            warnings.append("GST CSV: missing turnover column (expected 'turnover'/'taxable_value').")
            return ParsedGST(turnover_inr=None, months=len(rows) or None), warnings
        col = cand_cols[0]
        s = 0.0
        c = 0
        for r in rows:
            v = _safe_float(r.get(col))
            if v is None:
                continue
            s += v
            c += 1
        turnover_inr = s if c > 0 else None
        months = len(rows) or None
        return ParsedGST(turnover_inr=turnover_inr, months=months), warnings

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

    for r in rows:
        txn_count += 1
        if credit_col:
            v = _safe_float(r.get(credit_col))
            if v is not None:
                inflow += max(0.0, v)
        if debit_col:
            v = _safe_float(r.get(debit_col))
            if v is not None:
                dv = max(0.0, v)
                outflow += dv
                if desc_col:
                    d = (r.get(desc_col) or "").lower()
                    if any(k in d for k in ("emi", "loan", "interest", "instalment", "installment")):
                        emi_debits += dv
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

    return (
        ParsedBank(
            inflow_inr=inflow if inflow > 0 else None,
            outflow_inr=outflow if outflow > 0 else None,
            avg_balance_inr=avg_bal,
            min_balance_inr=min_bal_out,
            bounce_count=bounces,
            emi_debit_inr=emi_debits if emi_debits > 0 else None,
            txn_count=txn_count,
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
            },
        },
        "credit_summary": summary,
    }
