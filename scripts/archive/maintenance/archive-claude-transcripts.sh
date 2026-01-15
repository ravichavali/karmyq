#!/bin/bash
# Archive Claude Code conversation transcripts
# This script should be run daily via cron to capture AI-assisted development sessions

set -e

# Configuration
ARCHIVE_DIR="./claude_chat_archive"
DATE=$(date +%Y-%m-%d)
ARCHIVE_FILE="${ARCHIVE_DIR}/transcripts_${DATE}.json"

# Create archive directory if it doesn't exist
mkdir -p "$ARCHIVE_DIR"

echo "==================================="
echo "Claude Transcript Archive"
echo "Date: $DATE"
echo "==================================="
echo ""

# Check if claude-code-transcripts is installed
if ! command -v claude-code-transcripts &> /dev/null; then
    echo "❌ claude-code-transcripts not found"
    echo "Install with: npm install -g @anthropic/claude-code-transcripts"
    exit 1
fi

# Archive transcripts
echo "Archiving transcripts to: $ARCHIVE_FILE"
echo ""

# Run the archive command
# Note: This will prompt to select a session interactively
# For automated use, you may need to select the most recent session programmatically
claude-code-transcripts -o "$ARCHIVE_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Transcripts archived successfully"
    echo "📁 Location: $ARCHIVE_FILE"
    echo ""

    # Show file size
    ls -lh "$ARCHIVE_FILE"

    # Count number of transcripts
    if command -v jq &> /dev/null; then
        COUNT=$(jq 'length' "$ARCHIVE_FILE" 2>/dev/null || echo "unknown")
        echo "📊 Transcripts archived: $COUNT"
    fi
else
    echo "❌ Archive failed"
    exit 1
fi

echo ""
echo "==================================="
echo "Archive complete!"
echo "==================================="
