#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

if [ -f .backend.pid ]; then
  BPID=$(cat .backend.pid || true)
  if [ -n "$BPID" ] && ps -p "$BPID" >/dev/null 2>&1; then
    echo "Stopping backend PID $BPID"
    kill "$BPID" >/dev/null 2>&1 || true
    sleep 1
  fi
  rm -f .backend.pid
fi

if [ ! -f .server.pid ]; then
  echo "No running server tracked."
  exit 0
fi

PID=$(cat .server.pid || true)
if [ -n "$PID" ] && ps -p "$PID" >/dev/null 2>&1; then
  echo "Stopping server PID $PID"
  kill "$PID" >/dev/null 2>&1 || true
  sleep 1
fi
rm -f .server.pid
echo "Stopped."
