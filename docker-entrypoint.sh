#!/bin/sh
set -e

echo "🎬 AI Subtitle Tool starting..."

# Start FastAPI backend (background)
uvicorn api.main:app --host 127.0.0.1 --port 8000 --log-level warning &
API_PID=$!

# Wait for API to be ready
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
echo "✅ API ready"

# Start Next.js frontend (foreground)
echo "✅ Web UI at http://localhost:3000"
cd /app/web
API_URL=http://127.0.0.1:8000 PORT=3000 HOSTNAME=0.0.0.0 node server.js &
WEB_PID=$!

# Graceful shutdown
trap "kill $API_PID $WEB_PID 2>/dev/null; exit 0" INT TERM

wait
