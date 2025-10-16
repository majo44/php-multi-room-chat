#!/bin/bash

echo "🚀 Starting PHP Chat Application on Railway..."

# Create storage directory if it doesn't exist
mkdir -p storage

# Set up database
echo "📦 Setting up database..."
php bin/setup-database.php

# Start the web server
echo "🌍 Starting web server on port $PORT..."
exec php -S 0.0.0.0:$PORT -t public