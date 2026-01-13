#!/bin/bash
# Daily backup script: Export database to JSON files
# Phase 6: JSON is updated via periodic export, not during writes
#
# This script should be run daily via cron job:
# 0 2 * * * /opt/france-renovation/scripts/backup_to_json.sh >> /opt/france-renovation/logs/backup.log 2>&1

set -e

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_DIR"

# Set up logging
LOG_FILE="$PROJECT_DIR/logs/backup.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "Starting JSON backup export..."

# Check if database is accessible
if ! python3 -c "
import os
os.chdir('backend')
from dotenv import load_dotenv
load_dotenv()
use_db = os.getenv('USE_DATABASE', 'false').lower() == 'true'
if not use_db:
    print('ERROR: USE_DATABASE is not set to true')
    exit(1)
" 2>&1 | tee -a "$LOG_FILE"; then
    log "ERROR: USE_DATABASE is not enabled. Skipping backup."
    exit 1
fi

# Determine Python executable (prefer venv Python)
PYTHON_CMD="python3"
if [ -f "backend/venv/bin/python3" ]; then
    PYTHON_CMD="backend/venv/bin/python3"
elif [ -f "venv/bin/python3" ]; then
    PYTHON_CMD="venv/bin/python3"
fi

# Verify Python can import required modules
if ! "$PYTHON_CMD" -c "import sqlalchemy" 2>/dev/null; then
    log "ERROR: sqlalchemy not found. Make sure virtual environment is set up correctly."
    exit 1
fi

# Run export script
if "$PYTHON_CMD" backend/scripts/migrate_db_to_json.py --output-dir data/ 2>&1 | tee -a "$LOG_FILE"; then
    log "✅ JSON backup export completed successfully"
    exit 0
else
    log "❌ JSON backup export failed"
    exit 1
fi
