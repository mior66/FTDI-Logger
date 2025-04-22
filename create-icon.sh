#!/bin/bash

# Change to the application directory
cd "$(dirname "$0")"

# Create temporary directory for icon creation
mkdir -p tmp.iconset

# Convert SVG to PNG at different sizes
for size in 16 32 64 128 256 512 1024; do
  if command -v convert &> /dev/null; then
    # If ImageMagick is installed
    convert -background none -resize ${size}x${size} public/app-icon.svg tmp.iconset/icon_${size}x${size}.png
    convert -background none -resize $((size*2))x$((size*2)) public/app-icon.svg tmp.iconset/icon_${size}x${size}@2x.png
  elif command -v rsvg-convert &> /dev/null; then
    # If librsvg is installed
    rsvg-convert -w ${size} -h ${size} public/app-icon.svg > tmp.iconset/icon_${size}x${size}.png
    rsvg-convert -w $((size*2)) -h $((size*2)) public/app-icon.svg > tmp.iconset/icon_${size}x${size}@2x.png
  else
    # Fallback to sips (built into macOS)
    sips -z ${size} ${size} public/app-icon.svg --out tmp.iconset/icon_${size}x${size}.png &>/dev/null || true
    sips -z $((size*2)) $((size*2)) public/app-icon.svg --out tmp.iconset/icon_${size}x${size}@2x.png &>/dev/null || true
  fi
done

# Create icns file
iconutil -c icns tmp.iconset -o AppIcon.icns

# Clean up
rm -rf tmp.iconset

echo "Icon created: AppIcon.icns"
