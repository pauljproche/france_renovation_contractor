#!/bin/bash

# Production startup script for France Renovation Contractor
# This script starts the backend in production mode (no reload)
# Frontend should be built separately and served via nginx

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}Starting France Renovation Contractor (Production Mode)...${NC}\n"

# Create logs directory if it doesn't exist
mkdir -p logs

# Load environment variables
if [ -f "$SCRIPT_DIR/backend/.env" ]; then
    echo -e "${GREEN}Loading environment variables from backend/.env${NC}"
    export $(cat "$SCRIPT_DIR/backend/.env" | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}Warning: backend/.env file not found${NC}"
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID $BOT_PID 2>/dev/null || true
    exit
}

trap cleanup SIGINT SIGTERM

# Check if ports are already in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}Warning: Port $1 is already in use${NC}"
        return 1
    fi
    return 0
}

# Get port from environment or use default
BACKEND_PORT=${BACKEND_PORT:-8000}

# Start FastAPI backend (production mode - no reload)
echo -e "${GREEN}[1/2] Starting FastAPI backend on port $BACKEND_PORT (production mode)...${NC}"
check_port $BACKEND_PORT
cd backend

# Use production workers (adjust based on CPU cores)
WORKERS=${WORKERS:-4}
python -m uvicorn main:app \
    --host 0.0.0.0 \
    --port $BACKEND_PORT \
    --workers $WORKERS \
    --no-reload \
    --log-level info \
    > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo -e "  Backend PID: $BACKEND_PID"
echo -e "  Workers: $WORKERS"

# Wait a moment for backend to start
sleep 3

# Start Zulip bot (if configured)
if [ -n "$ZULIP_EMAIL" ] && [ -n "$ZULIP_API_KEY" ] && [ -n "$ZULIP_SITE" ]; then
    echo -e "${GREEN}[2/2] Starting Zulip bot...${NC}"
    python -m backend.zulip_bot.bot > logs/bot.log 2>&1 &
    BOT_PID=$!
    echo -e "  Bot PID: $BOT_PID"
else
    echo -e "${YELLOW}[2/2] Skipping Zulip bot (not configured)${NC}"
    BOT_PID=""
fi

echo -e "\n${GREEN}✓ Production services started successfully!${NC}\n"
echo -e "${BLUE}Services:${NC}"
echo -e "  • Backend API:  http://0.0.0.0:$BACKEND_PORT"
if [ -n "$BOT_PID" ]; then
    echo -e "  • Zulip Bot:    Running and listening for messages"
fi
echo -e "\n${YELLOW}Logs are being written to the logs/ directory${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}\n"
echo -e "${BLUE}Note: Frontend should be built and served via nginx${NC}"
echo -e "${BLUE}Run: cd frontend && npm run build${NC}\n"

# Wait for all background processes
wait







