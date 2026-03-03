Ashtrashastra AI – Permanent Localhost Instructions (macOS)
===========================================================

This project includes two double-clickable scripts to reliably run a local web server:
- start_localhost.command — starts a local server on an available port and opens your browser
- stop_localhost.command  — stops the server that was started previously

How to allow running scripts on macOS (first time only)
-------------------------------------------------------
1) Open Terminal and run these commands once to make the scripts executable:
   chmod +x /Users/sommayadeepsaha/Desktop/ASHSTRASHASTRA_AI/start_localhost.command
   chmod +x /Users/sommayadeepsaha/Desktop/ASHSTRASHASTRA_AI/stop_localhost.command

2) The first time you double-click, macOS Gatekeeper may warn you. If it says it can’t open the app, do:
   - System Settings > Privacy & Security > Allow apps downloaded from: Allow Anyway for the script
   - Then double-click the script again

Usage
-----
- Double‑click start_localhost.command
  - It will pick a free port (prefers 8080, 8000, 5500, 3000, 5173)
  - Starts a Python-based static server bound to 127.0.0.1
  - Saves logs to .server.log and the PID to .server.pid
  - Opens your browser to http://localhost:<PORT>

- Double‑click stop_localhost.command
  - Stops the server using the saved PID

Troubleshooting
---------------
- If the browser says “connection refused,” check .server.log in this folder.
- Ensure Python 3 is installed (python3 --version). If missing, install from https://www.python.org/downloads/
- Some ports may be blocked by other apps; the script automatically tries alternative ports.
- If a previous server is stuck, run the stop script, then re-run the start script.

Alternative (no scripts)
------------------------
- Open Terminal in this folder and run: python3 -m http.server 8080
- Then open http://localhost:8080 in your browser.

AI Backend (Document Intelligence)
---------------------------------
- In a second Terminal window, run: `python3 app.py`
  - This starts the backend at `http://localhost:5050`
  - The frontend will call `/api/case/analyze` (and falls back to `http://localhost:5050/api/case/analyze` if needed)

Tip: If you host the backend elsewhere, set:
- `localStorage.setItem('arthashastra_backend_base', 'https://<your-backend-host>')`

Sample files (to see real auto-fill now)
---------------------------------------
- Use the structured sample uploads in `samples/`:
  - `samples/gst_returns_12m.json`
  - `samples/itr_3y.json`
  - `samples/bank_statement_12m.csv`
