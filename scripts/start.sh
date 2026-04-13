#!/usr/bin/env bash
# AI Subtitle Tool — local launcher (Unix/macOS)
# Starts the FastAPI backend and Next.js frontend, then opens the browser.
# Usage: ./scripts/start.sh [--port-api 8000] [--port-web 3000]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PORT_API=8000
PORT_WEB=3000

while [[ $# -gt 0 ]]; do
  case $1 in
    --port-api) PORT_API="$2"; shift 2 ;;
    --port-web) PORT_WEB="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Colour helpers ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'
info()  { echo -e "${CYAN}[subtitle]${RESET} $*"; }
ok()    { echo -e "${GREEN}[subtitle]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[subtitle]${RESET} $*"; }

# ── Cleanup on exit ─────────────────────────────────────────────────────────
API_PID="" WEB_PID=""
cleanup() {
  info "Shutting down..."
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# ── Python venv ─────────────────────────────────────────────────────────────
VENV="$ROOT/.venv"
if [[ ! -f "$VENV/bin/python" ]]; then
  warn "No .venv found — creating one..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet -e "$ROOT[web]"
fi
PYTHON="$VENV/bin/python"
UVICORN="$VENV/bin/uvicorn"

# ── Start API ────────────────────────────────────────────────────────────────
info "Starting API on port $PORT_API..."
cd "$ROOT"
"$UVICORN" api.main:app --host 127.0.0.1 --port "$PORT_API" --log-level warning &
API_PID=$!

# Wait for API to be ready
for i in {1..20}; do
  if "$PYTHON" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:$PORT_API/api/health')" 2>/dev/null; then
    break
  fi
  sleep 0.5
done
ok "API ready at http://127.0.0.1:$PORT_API"

# ── Start Web ────────────────────────────────────────────────────────────────
WEB_DIR="$ROOT/web"
if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  info "Installing web dependencies..."
  npm --prefix "$WEB_DIR" ci
fi

info "Starting web UI on port $PORT_WEB..."
API_URL="http://127.0.0.1:$PORT_API" PORT="$PORT_WEB" npm --prefix "$WEB_DIR" run dev &
WEB_PID=$!
sleep 3

# ── Open browser ─────────────────────────────────────────────────────────────
URL="http://localhost:$PORT_WEB"
ok "App running at $URL"
case "$(uname -s)" in
  Darwin) open "$URL" ;;
  Linux)  xdg-open "$URL" 2>/dev/null || true ;;
esac

info "Press Ctrl+C to stop."
wait
