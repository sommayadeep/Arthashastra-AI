import json
import datetime
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional
from urllib.parse import quote
from urllib.request import Request, urlopen

# ---------------------------------------------------------
# INDIAN BANKING NEWS INTELLIGENCE ENGINE - BACKEND AGENT
# ---------------------------------------------------------

SYSTEM_PROMPT = """
You are a Financial Intelligence Research Engine specialized in Indian Banking Sector monitoring.

Objective:
Fetch, summarize, classify, and display the most recent and material news related to Indian banks.

Scope:
- Public Sector Banks (PSBs)
- Private Sector Banks
- RBI circulars
- Banking regulations
- NPA updates
- Capital raising
- Mergers & acquisitions
- Fraud cases
- Management changes
- Policy rate changes
- Banking reforms
- Corporate Filings (MCA)
- Legal Disputes (e-Courts)
- Sectoral News & Trends
- Rating Agency Reports
- Management Interviews & Due Diligence Notes

Data Requirements:
1. Fetch news from last 7 days (default)
2. Categorize into:
   - Regulatory Updates (RBI, SEBI)
   - Financial Performance (Results, Outlook)
   - Credit & NPA (Defaults, Bad Loans)
   - Governance / Management (Changes, Shareholding pattern)
   - Market / Share Price
   - Fraud / Compliance
   - Legal / Litigations (e-Courts, NCLT)
   - Primary Insights (Site Visits, Interviews)
3. Provide:
   - Headline
   - Source
   - Date
   - 2–3 line summary
   - Risk Impact Level (Low / Medium / High)
   - Impact Type (Credit / Liquidity / Capital / Reputation)

Output Format:
Structured JSON:
{
  "bank_name": "",
  "news_category": "",
  "headline": "",
  "date": "",
  "summary": "",
  "risk_impact_level": "",
  "impact_type": ""
}
"""

class BankingNewsOrchestrator:
    def __init__(self):
        self.system_prompt = SYSTEM_PROMPT

    def _fetch_url(self, url: str, timeout_s: int = 15) -> bytes:
        req = Request(
            url,
            headers={
                "User-Agent": "ArthashastraAI/1.0 (+https://arthashastra.ai) Python",
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
            },
        )
        with urlopen(req, timeout=timeout_s) as resp:
            return resp.read()

    def _parse_google_news_rss(self, rss_bytes: bytes) -> List[Dict[str, Any]]:
        root = ET.fromstring(rss_bytes)
        channel = root.find("channel")
        if channel is None:
            return []
        items: List[Dict[str, Any]] = []
        for it in channel.findall("item"):
            title = (it.findtext("title") or "").strip()
            link = (it.findtext("link") or "").strip()
            pub = (it.findtext("pubDate") or "").strip()
            source_el = it.find("source")
            source = (source_el.text or "").strip() if source_el is not None else ""
            desc = (it.findtext("description") or "").strip()
            dt = None
            try:
                dt = parsedate_to_datetime(pub)
            except Exception:
                dt = None
            items.append(
                {
                    "title": title,
                    "link": link,
                    "source": source or "Google News",
                    "pubDate": pub,
                    "published_at": dt.isoformat() if dt else None,
                    "summary": re.sub(r"<[^>]+>", "", desc)[:280],
                }
            )
        return items

    def _classify(self, item: Dict[str, Any]) -> Dict[str, str]:
        text = f"{item.get('title','')} {item.get('summary','')}".lower()
        high = ("fraud", "scam", "npa", "default", "penalty", "fine", "violation", "pmla", "money laundering", "cancel")
        moderate = ("merger", "acquisition", "downgrade", "liquidity", "investigation", "capital", "adequacy", "curbs")
        if any(k in text for k in high):
            level = "High"
        elif any(k in text for k in moderate):
            level = "Moderate"
        else:
            level = "Low"

        if "liquidity" in text:
            impact = "Liquidity Impact"
        elif any(k in text for k in ("kyc", "rbi", "compliance", "circular", "guideline", "directive")):
            impact = "Compliance Impact"
        elif any(k in text for k in ("npa", "loan", "credit", "default")):
            impact = "Credit Risk"
        elif any(k in text for k in ("capital", "basel", "tier")):
            impact = "Capital Adequacy"
        else:
            impact = "Informational"

        return {"risk_impact_level": level, "impact_type": impact}

    def fetch_live_news(self, query: str = "Indian Banking Sector", hours: int = 168, limit: int = 30) -> Dict[str, Any]:
        """
        Live news via RSS (no API keys):
        - Google News RSS for query, filtered client-side by recency.
        """
        q = query or "Indian Banking Sector"
        try:
            hours_i = int(hours or 168)
        except Exception:
            hours_i = 168
        hours_i = max(1, min(hours_i, 24 * 31))

        try:
            limit_i = int(limit or 30)
        except Exception:
            limit_i = 30
        limit_i = max(1, min(limit_i, 100))

        rss_url = (
            "https://news.google.com/rss/search?q="
            + quote(f"{q} banking india")
            + "&hl=en-IN&gl=IN&ceid=IN:en"
        )
        fetched_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            raw = self._fetch_url(rss_url)
            items = self._parse_google_news_rss(raw)
        except Exception as e:
            msg = str(e) or e.__class__.__name__
            if len(msg) > 200:
                msg = msg[:200] + "…"
            return {
                "status": "error",
                "query": q,
                "hours": hours_i,
                "limit": limit_i,
                "count": 0,
                "items": [],
                "fetched_at": fetched_at,
                "note": f"News fetch failed: {msg}",
            }

        cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=hours_i)
        filtered: List[Dict[str, Any]] = []
        for it in items:
            ts = it.get("published_at")
            if not ts:
                continue
            try:
                dt = datetime.datetime.fromisoformat(ts)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=datetime.timezone.utc)
            except Exception:
                continue
            if dt >= cutoff:
                meta = self._classify(it)
                filtered.append({**it, **meta})

        filtered.sort(key=lambda x: x.get("published_at") or "", reverse=True)
        returned = filtered[:limit_i]
        return {
            "status": "success",
            "query": q,
            "hours": hours_i,
            "limit": limit_i,
            "count": len(filtered),
            "items": returned,
            "fetched_at": fetched_at,
            "note": None if filtered else f"No items found in the last {hours_i} hours. Try widening the window.",
        }

if __name__ == "__main__":
    agent = BankingNewsOrchestrator()
    # Example usage
    agent.fetch_live_news()
    print("\n[INFO] To see the UI, ensure 'start_localhost.command' is running and visit:")
    print("       http://localhost:8080/news_dashboard.html")
