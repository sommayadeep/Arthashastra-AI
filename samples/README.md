# Sample Inputs (For Real Auto-Fill Demo)

Your current backend supports structured uploads:
- GST: `.json` or `.csv`
- ITR: `.json` or `.csv`
- Bank statement: `.csv`

Use these files to validate the full pipeline (Auto-Extract → Risk/Alerts → CAM → Archive → View Case):
- `samples/gst_returns_12m.json`
- `samples/itr_3y.json`
- `samples/bank_statement_12m.csv`

## Quick run
1. Start backend: `python3 app.py` (listens on `http://127.0.0.1:5050`)
2. Start frontend: `start_localhost.command` (typically `http://localhost:8080`)
3. In `new-case.html`, upload the three sample files and click **Arthashastra AI Auto-Extract**.

## Notes
- For PDF-only workflows (GST/ITR/Bank PDFs), you’ll need a PDF text/OCR extraction step to convert to structured tables before this engine can auto-fill.
