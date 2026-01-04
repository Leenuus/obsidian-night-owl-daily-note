#!/bin/bash

# Define the output directory
DEST="obsidian-night-owl-daily-note"

# Create the directory if it doesn't exist, or clear it if it does
rm -rf "$DEST"
mkdir -p "$DEST"

# List of files to include
FILES=("main.js" "styles.css" "manifest.json")

# Copy files and check for existence
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$DEST/"
        echo "✅ Copied $file to $DEST/"
    else
        echo "❌ Warning: $file not found, skipping."
    fi
done

echo "Done! You can now copy the contents of /$DEST to your Obsidian vault."
