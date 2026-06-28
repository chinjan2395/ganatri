#!/bin/bash

# Ganatri Development Server Startup Script
# Starts: Server (port 3000), Web (port 5173), Storybook (port 6006)

set -e

# Always run from repo root, regardless of caller cwd
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track running processes
PIDS=()

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}Shutting down all services...${NC}"
  for PID in "${PIDS[@]}"; do
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
      wait "$PID" 2>/dev/null || true
    fi
  done
  echo -e "${GREEN}All services stopped.${NC}"
  exit 0
}

# Trap signals
trap cleanup SIGINT SIGTERM EXIT

# Ensure node_modules and workspace symlinks (e.g. @ganatri/ds) are present
needs_install=false
if [ ! -d "node_modules" ]; then
  needs_install=true
else
  for pkg_json in packages/*/package.json; do
    pkg_name="$(node -pe "require('./$pkg_json').name")"
    if [ ! -e "node_modules/$pkg_name" ]; then
      needs_install=true
      break
    fi
  done
fi

if [ "$needs_install" = true ]; then
  echo -e "${YELLOW}Installing dependencies (workspace links missing or stale)...${NC}"
  npm install
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Starting Ganatri Development Environment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# Start Server
echo -e "${BLUE}[1/3]${NC} Starting ${GREEN}Server${NC} on http://localhost:3000..."
(cd packages/server && npm run dev) &
PIDS+=($!)
sleep 2

# Start Web
echo -e "${BLUE}[2/3]${NC} Starting ${GREEN}Web App${NC} on http://localhost:5173..."
(cd packages/web && npm run dev) &
PIDS+=($!)
sleep 2

# Start Storybook
echo -e "${BLUE}[3/3]${NC} Starting ${GREEN}Storybook${NC} on http://localhost:6006..."
(cd packages/ds && npm run storybook) &
PIDS+=($!)
sleep 2

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ All services started successfully!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Server:${NC}    http://localhost:3000"
echo -e "  ${GREEN}Web App:${NC}   http://localhost:5173"
echo -e "  ${GREEN}Storybook:${NC} http://localhost:6006"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for all processes
wait
