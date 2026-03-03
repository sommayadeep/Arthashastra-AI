import cgi
import json
import os
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

# Ensure local modules are importable when launched from other dirs
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend_ai_agent import BankingNewsOrchestrator
from credit_intelligence import compute_credit_intelligence, parse_bank, parse_gst, parse_itr


agent = BankingNewsOrchestrator()


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
            data = agent.fetch_live_news(query)
            return _json_response(self, data, 200)

        return _json_response(self, {"status": "error", "message": "Not found"}, 404)

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            if parsed.path != "/api/case/analyze":
                return _json_response(self, {"status": "error", "message": "Not found"}, 404)

            ctype, _pdict = cgi.parse_header(self.headers.get("content-type") or "")
            if ctype != "multipart/form-data":
                return _json_response(
                    self,
                    {"status": "error", "message": "Expected multipart/form-data"},
                    415,
                )

            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": self.headers.get("content-type", "")},
            )

            warnings = []

            adjust_raw = (form.getfirst("adjust") or "0").strip()
            try:
                officer_adjust = float(adjust_raw)
            except ValueError:
                officer_adjust = 0.0
                warnings.append("Invalid 'adjust' value; defaulted to 0.")

            def get_file(field: str):
                item = form[field] if field in form else None
                if item is None:
                    return None
                if isinstance(item, list):
                    item = item[0]
                if getattr(item, "file", None) is None:
                    return None
                filename = getattr(item, "filename", "") or ""
                data = item.file.read() if item.file else b""
                return filename, data

            gst = get_file("gst_docs")
            itr = get_file("itr_docs")
            bank = get_file("bank_docs")

            parsed_gst, w = parse_gst(gst[1], gst[0]) if gst else (parse_gst(b"", ""), ["GST not provided."])
            warnings.extend(w)
            parsed_itr, w = parse_itr(itr[1], itr[0]) if itr else (parse_itr(b"", ""), ["ITR not provided."])
            warnings.extend(w)
            parsed_bank, w = (
                parse_bank(bank[1], bank[0]) if bank else (parse_bank(b"", ""), ["Bank statement not provided."])
            )
            warnings.extend(w)

            intelligence = compute_credit_intelligence(
                parsed_gst, parsed_itr, parsed_bank, officer_adjustment=officer_adjust
            )

            passthrough = {
                "company": (form.getfirst("company") or None),
                "promoters": (form.getfirst("promoters") or None),
                "sector": (form.getfirst("sector") or None),
            }

            return _json_response(
                self,
                {
                    "status": "success",
                    "warnings": [w for w in warnings if w],
                    "passthrough": passthrough,
                    "intelligence": intelligence,
                },
                200,
            )
        except Exception as e:
            traceback.print_exc()
            return _json_response(self, {"status": "error", "message": str(e)}, 500)

    # Keep logs minimal; errors are printed via traceback in exception handler.
    def log_message(self, format, *args):
        sys.stdout.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), format % args))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    # Bind to loopback for local demo reliability (avoids IPv6/permission quirks on some macOS setups).
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"[*] Arthashastra AI backend listening on http://localhost:{port}")
    server.serve_forever()
