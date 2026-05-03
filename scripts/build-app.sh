#!/usr/bin/env bash
# Build macOS .app wrapper for AI Subtitle Tool (Docker-based)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="AI 字幕工具"
APP_PATH="$SCRIPT_DIR/$APP_NAME.app"

# Remove old build
rm -rf "$APP_PATH"

# Create .app via osacompile
osacompile -o "$APP_PATH" <<'APPLESCRIPT'
use scripting additions

set appName to "AI 字幕工具"
set containerName to "ai-subtitle-tool"
set imageName to "ghcr.io/hank840214-alt/ai-subtitle-tool:latest"
set webPort to 3000
set dockerBin to "/Users/hank/.orbstack/bin/docker"

-- Check if OrbStack/Docker is running
try
    do shell script dockerBin & " info > /dev/null 2>&1"
on error
    display dialog "OrbStack 沒有在執行中。" & return & return & "請先開啟 OrbStack，再重新啟動。" buttons {"開啟 OrbStack", "取消"} default button 1 with title appName with icon caution
    if button returned of result is "開啟 OrbStack" then
        tell application "OrbStack" to activate
        display dialog "OrbStack 正在啟動，請稍候 15 秒後再試一次。" buttons {"好"} default button 1 with title appName
    end if
    return
end try

-- Check if container is already running
set isRunning to false
try
    set containerStatus to do shell script dockerBin & " ps --filter name=" & containerName & " --format '{{.Status}}' 2>/dev/null"
    if containerStatus is not "" then
        set isRunning to true
    end if
end try

if isRunning then
    -- Already running, just open browser
    open location "http://localhost:" & webPort
    return
end if

-- Remove stopped container if exists
try
    do shell script dockerBin & " rm " & containerName & " 2>/dev/null"
end try

-- Pull latest image (silent)
try
    do shell script dockerBin & " pull " & imageName & " 2>/dev/null"
end try

-- Start container
try
    do shell script dockerBin & " run -d --name " & containerName & " -p " & webPort & ":3000 -v subtitle_models:/root/.cache/huggingface -v subtitle_jobs:/tmp/subtitle_jobs " & imageName
on error errMsg
    display dialog "啟動失敗：" & return & errMsg buttons {"好"} default button 1 with title appName with icon stop
    return
end try

-- Wait for web UI to be ready
set maxWait to 15
set ready to false
repeat with i from 1 to maxWait
    try
        do shell script "curl -sf http://localhost:" & webPort & " > /dev/null 2>&1"
        set ready to true
        exit repeat
    end try
    delay 1
end repeat

if ready then
    open location "http://localhost:" & webPort
    display notification "已在瀏覽器中開啟 http://localhost:" & webPort with title appName
else
    display dialog "服務啟動中，請稍後手動開啟：" & return & "http://localhost:" & webPort buttons {"好"} default button 1 with title appName with icon caution
end if
APPLESCRIPT

# Set a nice icon if available
if [ -f "$SCRIPT_DIR/../web/app/favicon.ico" ]; then
    echo "Note: To set a custom icon, right-click the .app → Get Info → drag an .icns file onto the icon"
fi

echo "✅ Built: $APP_PATH"
echo ""
echo "To install:"
echo "  1. Drag '$APP_NAME.app' to /Applications/"
echo "  2. Or drag to Dock for quick access"
echo ""
echo "First launch will ask for permission in System Settings → Privacy & Security"
