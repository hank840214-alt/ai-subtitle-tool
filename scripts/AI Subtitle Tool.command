#!/usr/bin/env bash
# macOS double-click launcher — save to Desktop, chmod +x, then double-click.
# Opens a Terminal window and starts the app.
cd "$(dirname "$0")/.."
exec bash scripts/start.sh
