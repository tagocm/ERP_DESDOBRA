#!/bin/bash

# Configuration
PROJECT_DIR="/Users/tago/Documents/MARTIGRAN/APPS/ERP_DESDOBRA"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Navigate to project directory
cd "$PROJECT_DIR" || exit

# Check for changes
if [[ -n $(git status --porcelain) ]]; then
    echo "[$TIMESTAMP] Changes detected. Syncing to GitHub..."
    git add .
    git commit -m "Auto-sync: $TIMESTAMP"
    git push origin main
    echo "[$TIMESTAMP] Sync complete."
else
    echo "[$TIMESTAMP] No changes to sync."
fi
