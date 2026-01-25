#!/bin/bash

# VCC Manager Production Stop Script
# This script stops the production server

set -e

echo "🛑 Stopping VCC Manager production server..."

# Get the process ID of the running server
PID=$(ps aux | grep "node src/server.js" | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
    echo "❌ No running VCC Manager server found"
    exit 1
fi

echo "📋 Found server process with PID: $PID"

# Send TERM signal first for graceful shutdown
echo "📤 Sending TERM signal for graceful shutdown..."
kill -TERM $PID

# Wait for graceful shutdown
sleep 5

# Check if process is still running
if ps -p $PID > /dev/null 2>&1; then
    echo "⚠️  Graceful shutdown failed, sending KILL signal..."
    kill -KILL $PID
    sleep 2
fi

# Final check
if ps -p $PID > /dev/null 2>&1; then
    echo "❌ Failed to stop server process"
    exit 1
else
    echo "✅ VCC Manager production server stopped successfully"
fi

echo "🧹 Cleaning up temporary files..."
# Clean up any temporary files if needed
rm -rf /tmp/vcc-manager-*

echo "🎉 Production server shutdown complete"