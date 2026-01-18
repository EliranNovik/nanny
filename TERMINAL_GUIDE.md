# Terminal Guide - Starting/Stopping Servers

## The Problem

When you run `npm run dev` directly, it runs in the **foreground** and blocks your terminal. You can't run other commands until you stop it (Ctrl+C).

## Solution: Use Background Scripts

### Option 1: Use the Startup Scripts (Recommended)

**Start both servers:**

```bash
./start.sh
```

**Stop both servers:**

```bash
./stop.sh
```

This runs both servers in the **background**, so your terminal stays free!

### Option 2: Manual Background Process

**Start Backend (background):**

```bash
cd apps/api
nohup npm run dev > ../api.log 2>&1 &
cd ../..
```

**Start Frontend (background):**

```bash
cd apps/web
nohup npm run dev > ../web.log 2>&1 &
cd ../..
```

**Stop servers:**

```bash
# Stop backend
pkill -f "ts-node-dev.*api"

# Stop frontend
pkill -f "vite"

# Or stop both
./stop.sh
```

### Option 3: Use Separate Terminal Windows/Tabs

**Terminal 1 - Backend:**

```bash
cd apps/api
npm run dev
# (runs in foreground, blocks this terminal)
```

**Terminal 2 - Frontend:**

```bash
cd apps/web
npm run dev
# (runs in foreground, blocks this terminal)
```

**To stop:** Press `Ctrl+C` in each terminal

### Option 4: Use `screen` or `tmux` (Advanced)

**Using screen:**

```bash
# Create a screen session
screen -S nanny

# Start backend
cd apps/api && npm run dev

# Detach: Press Ctrl+A then D
# Reattach: screen -r nanny
```

## View Logs

**If using background scripts:**

```bash
# Backend logs
tail -f api.log

# Frontend logs
tail -f web.log
```

## Check if Servers are Running

```bash
# Check ports
lsof -ti:4000,5175

# Or check processes
ps aux | grep -E "ts-node-dev|vite" | grep -v grep
```

## Quick Commands Reference

```bash
# Start everything
./start.sh

# Stop everything
./stop.sh

# Restart everything
./stop.sh && sleep 2 && ./start.sh

# Check status
lsof -ti:4000,5175 && echo "✅ Running" || echo "❌ Not running"
```
