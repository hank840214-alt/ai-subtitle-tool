@echo off
REM AI Subtitle Tool — local launcher (Windows)
REM Starts the FastAPI backend and Next.js frontend, then opens the browser.

setlocal enabledelayedexpansion

set PORT_API=8000
set PORT_WEB=3000
set ROOT=%~dp0..

echo [subtitle] Starting AI Subtitle Tool...

REM ── Python venv ──────────────────────────────────────────────────────────
if not exist "%ROOT%\.venv\Scripts\python.exe" (
    echo [subtitle] No .venv found — creating one...
    python -m venv "%ROOT%\.venv"
    "%ROOT%\.venv\Scripts\pip" install -e "%ROOT%[web]"
)

REM ── Start API ─────────────────────────────────────────────────────────────
echo [subtitle] Starting API on port %PORT_API%...
start "AI Subtitle API" /min cmd /c "%ROOT%\.venv\Scripts\uvicorn" api.main:app --host 127.0.0.1 --port %PORT_API% --log-level warning

REM Wait for API
:wait_api
timeout /t 1 /nobreak >nul
"%ROOT%\.venv\Scripts\python" -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:%PORT_API%/api/health')" 2>nul
if errorlevel 1 goto wait_api
echo [subtitle] API ready at http://127.0.0.1:%PORT_API%

REM ── Start Web ─────────────────────────────────────────────────────────────
if not exist "%ROOT%\web\node_modules" (
    echo [subtitle] Installing web dependencies...
    npm --prefix "%ROOT%\web" ci
)

echo [subtitle] Starting web UI on port %PORT_WEB%...
set API_URL=http://127.0.0.1:%PORT_API%
set PORT=%PORT_WEB%
start "AI Subtitle Web" /min cmd /c npm --prefix "%ROOT%\web" run dev
timeout /t 3 /nobreak >nul

REM ── Open browser ──────────────────────────────────────────────────────────
echo [subtitle] Opening http://localhost:%PORT_WEB%
start http://localhost:%PORT_WEB%

echo [subtitle] Press any key to stop all services.
pause >nul

REM ── Cleanup ───────────────────────────────────────────────────────────────
taskkill /fi "WindowTitle eq AI Subtitle API" /f >nul 2>&1
taskkill /fi "WindowTitle eq AI Subtitle Web" /f >nul 2>&1
echo [subtitle] Stopped.
