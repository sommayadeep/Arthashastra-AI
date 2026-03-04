# Sample Inputs (For Real Auto-Fill Demo)

Your current backend supports structured uploads:
- GST: `.json` or `.csv`
- ITR: `.json` or `.csv`
- Bank statement: `.csv`

Use these files to validate the full pipeline (Auto-Extract → Risk/Alerts → CAM → Archive → View Case):
- `samples/gst_returns_12m.json`
- `samples/itr_3y.json`
- `samples/bank_statement_12m.csv`
- (Research demo) `samples/research_dossiers.json`
- (EWS demo) `samples/board_minutes_rating_3y.txt`

### What this demo shows
- `gst_returns_12m.json` includes GSTR-2A vs GSTR-3B ITC fields to trigger reconciliation checks.
- `itr_3y.json` includes utilities + legal expense fields to trigger Truth-Seeker triangulation and EWS checks.
- `bank_statement_12m.csv` is constructed to demonstrate circular trading heuristics (high pass-through + mirrored flows).
- `research_dossiers.json` provides an offline fixture for MCA filings + e-Courts litigation summaries (shown in alerts + AI report).
- `board_minutes_rating_3y.txt` triggers the EWS sentiment heatmap + defensive tone alerts.

## Quick run
1. Start backend: `python3 app.py` (listens on `http://127.0.0.1:5050`)
2. Start frontend: `start_localhost.command` (typically `http://localhost:8080`)
3. In `new-case.html`, upload the three sample files and click **Arthashastra AI Auto-Extract**.
4. Use borrower name `Maurya Infra Pvt Ltd` (placeholder default) to see the MCA/e-Courts research dossier populate.
5. (Optional) Upload `board_minutes_rating_3y.txt` under Board Minutes / Rating Notes to see the 3Y EWS heatmap.

## Notes
- For PDF-only workflows (GST/ITR/Bank PDFs), you’ll need a PDF text/OCR extraction step to convert to structured tables before this engine can auto-fill.
