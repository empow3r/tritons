#!/bin/bash
# Simple script to open the enhanced chat interface

echo "🚀 Opening TRITONS Enhanced Chat Interface..."

# Check if system is running
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "❌ TRITONS system not running on port 8080"
    echo "Start it with: node multi-llm-hierarchical-system.js"
    exit 1
fi

# Start a simple HTTP server for the chat interface
echo "📊 Starting enhanced chat server on port 8081..."

# Create a simple server to serve the chat interface
cat > temp-chat-server.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'tritons-chat-interface.html'));
});

app.listen(8081, () => {
    console.log('🎯 Enhanced Chat Interface: http://localhost:8081');
    console.log('📊 Main Dashboard: http://localhost:8080');
});
EOF

# Start the server
node temp-chat-server.js &
CHAT_PID=$!

echo "✅ Chat interface started!"
echo ""
echo "🎯 Enhanced Chat: http://localhost:8081"
echo "📊 Main Dashboard: http://localhost:8080"
echo ""

# Open in browser if available
if command -v open > /dev/null; then
    open http://localhost:8081
elif command -v xdg-open > /dev/null; then
    xdg-open http://localhost:8081
fi

echo "Press Ctrl+C to stop the chat server"

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    kill $CHAT_PID 2>/dev/null
    rm -f temp-chat-server.js
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for interrupt
wait