import os
import sys

# Ensure local modules are importable when launched from other dirs
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_ai_agent import BankingNewsOrchestrator
from credit_intelligence import compute_credit_intelligence, parse_bank, parse_gst, parse_itr


agent = BankingNewsOrchestrator()


def _evaluate_copilot_profile(payload):
    payload = payload or {}

    def _choice(key, allowed, default):
        value = str(payload.get(key) or "").strip().lower()
        return value if value in allowed else default

    sector = _choice("sector", {"services", "manufacturing", "retail", "infrastructure"}, "services")
    cashflow = _choice("cashflow", {"strong", "stable", "uneven", "stressed"}, "stable")
    gst = _choice("gst", {"clean", "minor", "mismatch"}, "clean")
    collateral = _choice("collateral", {"strong", "adequate", "thin"}, "adequate")

    sector_weights = {
        "services": 1,
        "manufacturing": 0,
        "retail": -1,
        "infrastructure": 2,
    }
    cashflow_weights = {
        "strong": 3,
        "stable": 2,
        "uneven": -1,
        "stressed": -3,
    }
    gst_weights = {
        "clean": 2,
        "minor": 0,
        "mismatch": -3,
    }
    collateral_weights = {
        "strong": 2,
        "adequate": 1,
        "thin": -2,
    }

    sector_narratives = {
        "services": "Services cash cycles are easier to trust when invoicing and collections remain disciplined.",
        "manufacturing": "Manufacturing borrowers need closer working-capital monitoring because volatility can widen quickly.",
        "retail": "Retail borrowers are more exposed to demand shocks and margin compression during weaker cycles.",
        "infrastructure": "Infrastructure borrowers can support a stronger case when execution and cash generation stay on track.",
    }
    cashflow_narratives = {
        "strong": "Cash generation is strong enough to support a more confident underwriting stance.",
        "stable": "Cashflow is broadly stable, which supports a controlled approval path.",
        "uneven": "Cashflow is uneven, so the recommendation needs tighter monitoring and stronger conditions.",
        "stressed": "Cashflow stress is clearly visible, materially weakening the recommendation.",
    }
    gst_narratives = {
        "clean": "GST behavior is clean, improving confidence in revenue visibility and reporting discipline.",
        "minor": "Minor GST variance keeps the case workable, but not frictionless.",
        "mismatch": "GST reconciliation gaps reduce confidence because transaction integrity needs explanation.",
    }
    collateral_narratives = {
        "strong": "Collateral strength provides a meaningful downside buffer for the committee.",
        "adequate": "Collateral cover is acceptable, but not enough to ignore operating watchpoints.",
        "thin": "Thin collateral means the operating story must carry more of the decision confidence.",
    }

    score = (
        sector_weights[sector]
        + cashflow_weights[cashflow]
        + gst_weights[gst]
        + collateral_weights[collateral]
    )

    grade = "B"
    headline = "Proceed only after deeper review."
    risk_posture = "Elevated"
    action_line = "Escalate for manual committee review"
    next_step = "Seek stronger repayment evidence, explain reporting gaps, and tighten risk controls before moving further."

    if score >= 7:
        grade = "A"
        headline = "Recommend approval with standard controls."
        risk_posture = "Low to moderate"
        action_line = "Approve with routine monitoring"
        next_step = "Move forward while tracking utilization, covenant discipline, and periodic compliance checks."
    elif score >= 4:
        grade = "A-"
        headline = "Recommend with routine monitoring."
        risk_posture = "Moderate"
        action_line = "Approve with watchpoints"
        next_step = "Proceed with approval while documenting monitoring triggers around working capital and reporting discipline."
    elif score >= 1:
        grade = "BBB"
        headline = "Recommend a cautious approval path."
        risk_posture = "Moderate to elevated"
        action_line = "Approve with enhanced conditions"
        next_step = "Strengthen conditions, request tighter reporting cadence, and review exception areas before final sanction."

    confidence_score = max(79, min(98, 88 + (score * 2)))
    gst_text = (
        "minor GST variance" if gst == "minor" else
        "clean GST discipline" if gst == "clean" else
        "GST reconciliation gaps"
    )
    summary = (
        f"The backend copilot sees a {risk_posture.lower()} {sector} borrower with {cashflow} cashflow behavior, "
        f"{gst_text}, and {collateral} collateral cover. That combination supports a "
        f"{action_line.lower()} decision path."
    )

    reasons = [
        cashflow_narratives[cashflow],
        gst_narratives[gst],
        f"{collateral_narratives[collateral]} {sector_narratives[sector]}",
    ]

    return {
        "status": "success",
        "engine": "backend-credit-copilot",
        "inputs": {
            "sector": sector,
            "cashflow": cashflow,
            "gst": gst,
            "collateral": collateral,
        },
        "grade": grade,
        "confidence": f"{confidence_score}%",
        "headline": headline,
        "summary": summary,
        "riskPosture": risk_posture,
        "actionLine": action_line,
        "nextStep": next_step,
        "reasons": reasons,
    }


def _analyze_from_files(files, form):
    warnings = []
    adjust_raw = (form.get("adjust") or "0").strip()
    try:
        officer_adjust = float(adjust_raw)
    except ValueError:
        officer_adjust = 0.0
        warnings.append("Invalid 'adjust' value; defaulted to 0.")

    gst_file = files.get("gst_docs")
    itr_file = files.get("itr_docs")
    bank_file = files.get("bank_docs")

    parsed_gst, w = (
        parse_gst(gst_file.read(), gst_file.filename) if gst_file else (parse_gst(b"", ""), ["GST not provided."])
    )
    warnings.extend(w)
    parsed_itr, w = (
        parse_itr(itr_file.read(), itr_file.filename) if itr_file else (parse_itr(b"", ""), ["ITR not provided."])
    )
    warnings.extend(w)
    parsed_bank, w = (
        parse_bank(bank_file.read(), bank_file.filename)
        if bank_file
        else (parse_bank(b"", ""), ["Bank statement not provided."])
    )
    warnings.extend(w)

    intelligence = compute_credit_intelligence(parsed_gst, parsed_itr, parsed_bank, officer_adjustment=officer_adjust)

    passthrough = {
        "company": form.get("company") or None,
        "promoters": form.get("promoters") or None,
        "sector": form.get("sector") or None,
        "primary_insights": form.get("primary_insights") or None,
    }
    return {
        "status": "success",
        "warnings": [w for w in warnings if w],
        "passthrough": passthrough,
        "intelligence": intelligence,
    }


# Production: Flask app for Render (gunicorn), with CORS.
try:
    from flask import Flask, jsonify, request
    from flask_cors import CORS

    app = Flask(__name__)
    CORS(app)

    @app.get("/")
    def health_check():
        return jsonify({"status": "active", "service": "Arthashastra AI Backend"})

    @app.get("/api/news")
    def get_news():
        query = request.args.get("q", "Indian Banking Sector")
        hours = request.args.get("hours", "168")
        limit = request.args.get("limit", "30")
        try:
            h = int(hours)
        except ValueError:
            h = 168
        try:
            l = int(limit)
        except ValueError:
            l = 30
        return jsonify(agent.fetch_live_news(query, hours=h, limit=l))

    @app.post("/api/case/analyze")
    def analyze_case():
        result = _analyze_from_files(request.files, request.form)
        return jsonify(result)

    @app.post("/api/copilot/evaluate")
    def evaluate_copilot():
        payload = request.get_json(silent=True) or {}
        return jsonify(_evaluate_copilot_profile(payload))

except Exception:
    # Local/offline fallback (no Flask installed): minimal HTTP server.
    import cgi
    import json
    import traceback
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import parse_qs, urlparse

    def _json_response(handler: BaseHTTPRequestHandler, payload, status: int = 200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(body)))
        handler.send_header("Access-Control-Allow-Origin", "*")
        handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        handler.send_header("Access-Control-Allow-Headers", "Content-Type")
        handler.end_headers()
        handler.wfile.write(body)

    class Handler(BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path == "/":
                return _json_response(self, {"status": "active", "service": "Arthashastra AI Backend"}, 200)

            if parsed.path == "/api/news":
                qs = parse_qs(parsed.query)
                query = (qs.get("q") or ["Indian Banking Sector"])[0]
                hours = (qs.get("hours") or ["168"])[0]
                limit = (qs.get("limit") or ["30"])[0]
                try:
                    h = int(hours)
                except ValueError:
                    h = 168
                try:
                    l = int(limit)
                except ValueError:
                    l = 30
                data = agent.fetch_live_news(query, hours=h, limit=l)
                return _json_response(self, data, 200)

            return _json_response(self, {"status": "error", "message": "Not found"}, 404)

        def do_POST(self):
            try:
                parsed = urlparse(self.path)
                if parsed.path == "/api/copilot/evaluate":
                    length = int(self.headers.get("content-length") or "0")
                    raw = self.rfile.read(length) if length > 0 else b"{}"
                    payload = json.loads(raw.decode("utf-8") or "{}")
                    return _json_response(self, _evaluate_copilot_profile(payload), 200)

                if parsed.path != "/api/case/analyze":
                    return _json_response(self, {"status": "error", "message": "Not found"}, 404)

                ctype, _pdict = cgi.parse_header(self.headers.get("content-type") or "")
                if ctype != "multipart/form-data":
                    return _json_response(self, {"status": "error", "message": "Expected multipart/form-data"}, 415)

                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": self.headers.get("content-type", "")},
                )

                # Build file-like objects compatible with _analyze_from_files
                class _F:
                    def __init__(self, item):
                        self._item = item
                        self.filename = getattr(item, "filename", "") or ""
                    def read(self):
                        return self._item.file.read() if getattr(self._item, "file", None) else b""

                files = {}
                for k in ("gst_docs", "itr_docs", "bank_docs"):
                    if k in form:
                        item = form[k]
                        if isinstance(item, list):
                            item = item[0]
                        if getattr(item, "file", None) is not None:
                            files[k] = _F(item)

                fields = {key: form.getfirst(key) for key in ("adjust", "company", "promoters", "sector", "primary_insights")}
                return _json_response(self, _analyze_from_files(files, fields), 200)
            except Exception as e:
                traceback.print_exc()
                return _json_response(self, {"status": "error", "message": str(e)}, 500)

        def log_message(self, format, *args):
            return

    def _serve_fallback():
        port = int(os.environ.get("PORT", 5050))
        server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        print(f"[*] Arthashastra AI backend listening on http://localhost:{port}")
        server.serve_forever()

    if __name__ == "__main__":
        _serve_fallback()

# If Flask is available, allow `python3 app.py` locally too.
if __name__ == "__main__" and "app" in globals():
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port)
