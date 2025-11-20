#!/usr/bin/env python3
"""
Start script for France Renovation Contractor
This script starts all three services:
1. FastAPI backend (port 8000)
2. React frontend (port 5173)
3. Zulip bot
"""

import os
import sys
import subprocess
import signal
import time
from pathlib import Path

# Colors for output
GREEN = '\033[0;32m'
BLUE = '\033[0;34m'
YELLOW = '\033[1;33m'
NC = '\033[0m'  # No Color

# Get the directory where the script is located
SCRIPT_DIR = Path(__file__).parent.absolute()
os.chdir(SCRIPT_DIR)

# Store process IDs for cleanup
processes = []

def cleanup(signum=None, frame=None):
    """Cleanup function to stop all services"""
    print(f"\n{YELLOW}Shutting down services...{NC}")
    for proc in processes:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except:
            try:
                proc.kill()
            except:
                pass
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

def check_port(port):
    """Check if a port is already in use"""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    if result == 0:
        print(f"{YELLOW}Warning: Port {port} is already in use{NC}")
        return False
    return True

def main():
    # Create logs directory
    logs_dir = SCRIPT_DIR / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    print(f"{BLUE}Starting France Renovation Contractor Application...{NC}\n")
    
    # Start FastAPI backend
    print(f"{GREEN}[1/3] Starting FastAPI backend on port 8000...{NC}")
    if check_port(8000):
        backend_log = open(logs_dir / "backend.log", "w")
        backend_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
            cwd=SCRIPT_DIR / "backend",
            stdout=backend_log,
            stderr=backend_log
        )
        processes.append(backend_proc)
        print(f"  Backend PID: {backend_proc.pid}")
        time.sleep(2)
    
    # Start React frontend
    print(f"{GREEN}[2/3] Starting React frontend on port 5173...{NC}")
    if check_port(5173):
        frontend_log = open(logs_dir / "frontend.log", "w")
        frontend_proc = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=SCRIPT_DIR / "frontend",
            stdout=frontend_log,
            stderr=frontend_log
        )
        processes.append(frontend_proc)
        print(f"  Frontend PID: {frontend_proc.pid}")
        time.sleep(2)
    
    # Start Zulip bot
    print(f"{GREEN}[3/3] Starting Zulip bot...{NC}")
    bot_log = open(logs_dir / "bot.log", "w")
    bot_proc = subprocess.Popen(
        [sys.executable, "-m", "backend.zulip_bot.bot"],
        cwd=SCRIPT_DIR,
        stdout=bot_log,
        stderr=bot_log
    )
    processes.append(bot_proc)
    print(f"  Bot PID: {bot_proc.pid}")
    
    print(f"\n{GREEN}✓ All services started successfully!{NC}\n")
    print(f"{BLUE}Services:{NC}")
    print(f"  • Backend API:  http://localhost:8000")
    print(f"  • Frontend:     http://localhost:5173")
    print(f"  • Zulip Bot:    Running and listening for messages")
    print(f"\n{YELLOW}Logs are being written to the logs/ directory{NC}")
    print(f"{YELLOW}Press Ctrl+C to stop all services{NC}\n")
    
    # Wait for all processes
    try:
        for proc in processes:
            proc.wait()
    except KeyboardInterrupt:
        cleanup()

if __name__ == "__main__":
    main()

