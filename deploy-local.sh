#!/bin/bash

# Production-like deployment script
echo "🚀 Starting PHP Multi-Room Chat in production mode..."

# Set production environment variables
export APP_DEBUG=false
export WEBSOCKET_HOST=127.0.0.1
export WEBSOCKET_PORT=8081
export APP_URL=http://localhost:8000

echo "📦 Installing dependencies..."
composer install --no-dev --optimize-autoloader

echo "🗄️ Setting up database..."
php bin/setup-database.php

echo "🌐 Starting WebSocket server on port 8081..."
nohup php bin/websocket-server.php > websocket.log 2>&1 &
WEBSOCKET_PID=$!
echo "WebSocket PID: $WEBSOCKET_PID"

echo "🌍 Starting HTTP server on port 8000..."
nohup php -S 0.0.0.0:8000 -t public > http.log 2>&1 &
HTTP_PID=$!
echo "HTTP PID: $HTTP_PID"

echo ""
echo "✅ Application started successfully!"
echo "📱 Local: http://localhost:8000"
echo "🌐 Network: http://$(hostname -I | awk '{print $1}'):8000"
echo ""
echo "📋 PIDs saved:"
echo "  WebSocket: $WEBSOCKET_PID"
echo "  HTTP: $HTTP_PID"
echo ""
echo "🛑 To stop:"
echo "  kill $WEBSOCKET_PID $HTTP_PID"
echo ""
echo "📊 Logs:"
echo "  WebSocket: tail -f websocket.log"
echo "  HTTP: tail -f http.log"