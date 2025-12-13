#!/bin/bash

# Chrome Web Store Screenshot Requirements:
# - Screenshots: 1280x800 or 640x400
# - Small promo tile: 440x280
# - Store icon: 128x128

STORE_ASSETS_DIR="$(dirname "$0")/../store-assets"
RESIZED_DIR="$STORE_ASSETS_DIR/resized"
ICON_DIR="$(dirname "$0")/../public/icon"

# Create resized directory if it doesn't exist
mkdir -p "$RESIZED_DIR"

echo "Resizing screenshots for Chrome Web Store..."

# Resize screenshots to 1280x800
for i in 1 2 3 4 5 6; do
    INPUT=$(ls "$STORE_ASSETS_DIR"/screenshot-$i-*.png 2>/dev/null | head -1)
    if [ -f "$INPUT" ]; then
        BASENAME=$(basename "$INPUT" .png)
        OUTPUT="$RESIZED_DIR/${BASENAME}-1280x800.png"
        echo "Resizing $INPUT -> $OUTPUT"
        magick "$INPUT" -resize 1280x800^ -gravity center -extent 1280x800 "$OUTPUT"
    fi
done

# Create promo tile 440x280 from the first screenshot
if [ -f "$STORE_ASSETS_DIR/screenshot-1-sessions-light.png" ]; then
    echo "Creating promo tile 440x280..."
    magick "$STORE_ASSETS_DIR/screenshot-1-sessions-light.png" -resize 440x280^ -gravity center -extent 440x280 "$RESIZED_DIR/promo-tile-440x280.png"
fi

# Copy store icon
if [ -f "$ICON_DIR/128.png" ]; then
    echo "Copying store icon..."
    cp "$ICON_DIR/128.png" "$RESIZED_DIR/store-icon-128x128.png"
fi

echo ""
echo "Done! Resized files are in: $RESIZED_DIR"
ls -la "$RESIZED_DIR"
