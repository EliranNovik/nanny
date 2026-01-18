#!/bin/bash

# Start both servers for Nanny Marketplace MVP (runs in background)

echo "🚀 Starting Nanny Marketplace..."
echo ""

# Check if .env files exist
if [ ! -f "apps/api/.env" ]; then
  echo "⚠️  Warning: apps/api/.env not found!"
  echo "   Create it with your Supabase credentials"
  echo ""
fi

if [ ! -f "apps/web/.env" ]; then
  echo "⚠️  Warning: apps/web/.env not found!"
  echo "   Create it with your Supabase credentials"
  echo ""
fi

# Stop any existing servers first
echo "🛑 Stopping any existing servers..."
pkill -f "ts-node-dev.*api" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Start backend in background
echo "📦 Starting Backend API (port 4000)..."
cd apps/api
nohup npm run dev > ../api.log 2>&1 &
API_PID=$!
cd ../..

# Wait a moment
sleep 2

# Start frontend in background
echo "🌐 Starting Frontend (port 5175)..."
cd apps/web
nohup npm run dev > ../web.log 2>&1 &
WEB_PID=$!
cd ../..

echo ""
echo "✅ Servers started in background!"
echo ""
echo "📡 Backend API: http://localhost:4000"
echo "🌐 Frontend: http://localhost:5175"
echo ""
echo "📋 Process IDs:"
echo "   Backend: $API_PID"
echo "   Frontend: $WEB_PID"
echo ""
echo "📝 Logs:"
echo "   Backend: tail -f api.log"
echo "   Frontend: tail -f web.log"
echo ""
echo "🛑 To stop servers, run: ./stop.sh"
echo ""

