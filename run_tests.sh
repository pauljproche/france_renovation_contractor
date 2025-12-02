#!/bin/bash
# Quick script to run the agent test suite

cd "$(dirname "$0")"

echo "Starting Agent Test Suite..."
echo "Make sure the backend API is running on http://localhost:8000"
echo ""

# Check for command-line arguments
if [ "$1" = "--priority" ] || [ "$1" = "-p" ]; then
    echo "Running high-priority tests only..."
    python3 tests/agent_test_suite.py --priority
elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    python3 tests/agent_test_suite.py --help
elif [ "$1" = "--list-categories" ]; then
    python3 tests/agent_test_suite.py --list-categories
elif [ "$1" = "--categories" ] || [ "$1" = "-c" ]; then
    # Pass all arguments to the test suite
    python3 tests/agent_test_suite.py "$@"
else
    # Run all tests by default
    python3 tests/agent_test_suite.py "$@"
fi

