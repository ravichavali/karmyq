#!/bin/bash
# Run production seeding in a detached screen session
# This allows seeding to continue even if SSH connection drops

echo "========================================"
echo "Production Database Seeding (Screen)"
echo "========================================"
echo ""

if [ -z "$DEMO_PASSWORD" ]; then
    echo "ERROR: DEMO_PASSWORD environment variable is required"
    echo ""
    echo "Usage:"
    echo "  export DEMO_PASSWORD=your_secure_password"
    echo "  ./scripts/seed-production-screen.sh"
    exit 1
fi

echo "This script will:"
echo "1. Start a detached screen session named 'karmyq-seed'"
echo "2. Run seeding in the background"
echo "3. You can disconnect and seeding will continue"
echo ""
echo "To check progress:"
echo "  screen -r karmyq-seed  (reattach to session)"
echo "  Ctrl+A, D  (detach from session)"
echo ""
echo "To check if seeding is still running:"
echo "  screen -ls"
echo ""

if [ "$SKIP_CONFIRMATION" != "true" ]; then
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo ""
echo "Starting screen session 'karmyq-seed'..."
echo ""

# Check if screen session already exists
if screen -list | grep -q "karmyq-seed"; then
    echo "❌ Screen session 'karmyq-seed' already exists"
    echo ""
    echo "Options:"
    echo "  1. Reattach: screen -r karmyq-seed"
    echo "  2. Kill old session: screen -S karmyq-seed -X quit"
    exit 1
fi

# Create a temporary script that will run inside screen
SCRIPT_FILE="/tmp/karmyq-seed-$$.sh"
cat > "$SCRIPT_FILE" << 'INNEREOF'
#!/bin/bash
cd ~/karmyq
export DEMO_PASSWORD="DEMO_PASSWORD_PLACEHOLDER"
./scripts/seed-production-local.sh
echo ""
echo "========================================"
echo "Seeding completed!"
echo "Press any key to close this screen session..."
echo "Or press Ctrl+A, D to detach and keep session alive"
echo "========================================"
read -n 1
INNEREOF

# Replace placeholder with actual password
sed -i "s/DEMO_PASSWORD_PLACEHOLDER/$DEMO_PASSWORD/" "$SCRIPT_FILE"
chmod +x "$SCRIPT_FILE"

# Start screen session with the script
screen -dmS karmyq-seed bash "$SCRIPT_FILE"

echo "✅ Screen session 'karmyq-seed' started successfully"
echo ""
echo "The seeding is now running in the background."
echo ""
echo "To monitor progress:"
echo "  screen -r karmyq-seed"
echo ""
echo "To detach from screen (leave it running):"
echo "  Press: Ctrl+A, then D"
echo ""
echo "To check if it's still running:"
echo "  screen -ls"
echo ""
echo "The session will automatically close when seeding completes."
