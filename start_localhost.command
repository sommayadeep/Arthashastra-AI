#!/bin/zsh
set -euo pipefail

# Always run from the directory where this script resides
cd "$(dirname "$0")"

# Pick an available port from a preferred list, or fall back to a random high port
ports=(8080 8000 5500 3000 5173)
PORT=""
for p in "${ports[@]}"; do
  if ! lsof -i tcp:$p -sTCP:LISTEN >/dev/null 2>&1; then
    PORT="$p"
    break
  fi
done

if [ -z "$PORT" ]; then
  echo "No preferred port free. Selecting a random high port."
  if command -v python3 >/dev/null 2>&1; then
    PORT=$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()
PY
)
  else
    PORT=8888
  fi
fi

# Stop any previously started server recorded in .server.pid
if [ -f .server.pid ]; then
  OLD_PID=$(cat .server.pid || true)
  if [ -n "$OLD_PID" ] && ps -p "$OLD_PID" >/dev/null 2>&1; then
    echo "Stopping previous server (PID $OLD_PID)"
    kill "$OLD_PID" >/dev/null 2>&1 || true
    sleep 1
  fi
  rm -f .server.pid
fi

# Locate Python
PYBIN="python3"
if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYBIN="python"
  else
    echo "Python not found. Install from https://www.python.org/downloads/ and re-run this script."
    exit 1
  fi
fi

# Start server in background and log output
echo "Starting local server on http://localhost:$PORT ..."
nohup "$PYBIN" -m http.server "$PORT" --bind 127.0.0.1 > .server.log 2>&1 &
PID=$!
echo $PID > .server.pid
sleep 1

# Verify and open browser
if ps -p "$PID" >/dev/null 2>&1; then
  echo "Server running with PID $PID"
  echo "Log file: $(pwd)/.server.log"
  echo "Opening browser..."
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:$PORT"
  else
    echo "Open this URL in your browser: http://localhost:$PORT"
  fi
  echo "To stop: double-click stop_localhost.command"
else
  echo "Failed to start server. See .server.log for details."
  exit 1
fi
