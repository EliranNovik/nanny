#!/bin/bash

# Stop all servers for Nanny Marketplace MVP

echo "🛑 Stopping servers..."

# Kill backend (ts-node-dev)
pkill -f "ts-node-dev.*api" 2>/dev/null
echo "✅ Backend stopped"

# Kill frontend (vite)
pkill -f "vite" 2>/dev/null
echo "✅ Frontend stopped"

echo ""
echo "All servers stopped!"

