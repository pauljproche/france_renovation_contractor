#!/bin/bash

# Start script for France Renovation Contractor
# This script starts all three services:
# 1. FastAPI backend (port 8000)
# 2. React frontend (port 5173)
# 3. Zulip bot

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}Starting France Renovation Contractor Application...${NC}\n"

# Create logs directory if it doesn't exist
mkdir -p logs

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    kill $BACKEND_PID $FRONTEND_PID $BOT_PID 2>/dev/null || true
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

# Start FastAPI backend
echo -e "${GREEN}[1/3] Starting FastAPI backend on port 8000...${NC}"
check_port 8000
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..
echo -e "  Backend PID: $BACKEND_PID"

# Wait a moment for backend to start
sleep 2

# Start React frontend
echo -e "${GREEN}[2/3] Starting React frontend on port 5173...${NC}"
check_port 5173
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
echo -e "  Frontend PID: $FRONTEND_PID"

# Wait a moment for frontend to start
sleep 2

# Start Zulip bot
echo -e "${GREEN}[3/3] Starting Zulip bot...${NC}"
python -m backend.zulip_bot.bot > logs/bot.log 2>&1 &
BOT_PID=$!
echo -e "  Bot PID: $BOT_PID"

echo -e "\n${GREEN}✓ All services started successfully!${NC}\n"
echo -e "${BLUE}Services:${NC}"
echo -e "  • Backend API:  http://localhost:8000"
echo -e "  • Frontend:     http://localhost:5173"
echo -e "  • Zulip Bot:    Running and listening for messages"
echo -e "\n${YELLOW}Logs are being written to the logs/ directory${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Wait for all background processes
wait

