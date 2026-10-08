#!/bin/bash

echo "🚀 Booting Cyber Command Platform..."

# Cleanup function to kill background processes when Ctrl+C is pressed
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    kill $AGENT_PID 2>/dev/null
    echo "✅ Cyber Command gracefully shut down."
    exit 0
}

# Trap Ctrl+C (SIGINT) and call cleanup
trap cleanup SIGINT SIGTERM

# 1. Check if Docker is running, if not start Colima
if ! docker info >/dev/null 2>&1; then
    echo "-> 🐳 Docker is not running. Starting Colima (this may take a minute)..."
    colima start
fi

# 2. Start Redis (Queue)
echo "-> 🗄️ Starting Redis Queue..."
# Try to start existing container, if it fails, run a new one
docker start immunoorg-redis 2>/dev/null || docker run -d --name immunoorg-redis -p 6379:6379 redis >/dev/null 2>&1

# 3. Start Backend Node.js Server
echo "-> 🧠 Starting Backend API..."
cd backend
npm start > backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# 4. Start React Frontend
echo "-> 💻 Starting React Dashboard..."
npm run dev &
FRONTEND_PID=$!

# 5. Start Rust Security Agent (Stealth Mode)
echo "-> 🛡️ Starting Stealth Security Agent..."
export BACKEND_URL="http://localhost:4040"
~/.local/share/immunoorg/.immuno_agent > agent_startup.log 2>&1 &
AGENT_PID=$!

echo ""
echo "✅ ALL SYSTEMS ONLINE."
echo "🔗 Dashboard: http://localhost:5173"
echo "Press Ctrl+C at any time to safely shut down all services."
echo ""

# Wait indefinitely until Ctrl+C is pressed
wait
