#!/bin/bash
# Setup git hooks for production deployment

echo "========================================"
echo "Setting up Production Git Hooks"
echo "========================================"
echo ""

# Create post-merge hook (runs after git pull)
cat > .git/hooks/post-merge <<'EOF'
#!/bin/bash
# Automatically make scripts executable after git pull
chmod +x scripts/*.sh 2>/dev/null || true
echo "✓ Scripts are now executable"
EOF

chmod +x .git/hooks/post-merge

echo "✓ Git hooks installed"
echo ""
echo "From now on, 'git pull' will automatically run 'chmod +x scripts/*.sh'"
echo ""
