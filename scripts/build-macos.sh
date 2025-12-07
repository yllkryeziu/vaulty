#!/bin/bash
# Build script for Vaulty macOS app

set -e

echo "🔨 Building Vaulty..."

# Build with Tauri (ignore DMG bundler error)
npm run tauri build || true

# Check if .app was created
APP_PATH="src-tauri/target/release/bundle/macos/vaulty.app"
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Build failed - no .app bundle found"
    exit 1
fi

echo "✅ App bundle created: $APP_PATH"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

# Create DMG with create-dmg
DMG_PATH="$HOME/Desktop/Vaulty-${VERSION}.dmg"
echo "📦 Creating DMG: $DMG_PATH"

# Remove old DMG if exists
rm -f "$DMG_PATH"

# Check if create-dmg is installed
if ! command -v create-dmg &> /dev/null; then
    echo "⚠️  create-dmg not found, installing via Homebrew..."
    brew install create-dmg
fi

create-dmg \
    --volname "Vaulty" \
    --volicon "src-tauri/icons/icon.icns" \
    --window-pos 200 120 \
    --window-size 600 400 \
    --icon-size 100 \
    --icon "vaulty.app" 175 190 \
    --hide-extension "vaulty.app" \
    --app-drop-link 425 190 \
    "$DMG_PATH" \
    "$APP_PATH"

echo ""
echo "✅ Build complete!"
echo "📍 App: $APP_PATH"
echo "📍 DMG: $DMG_PATH"
echo ""
echo "To install, open the DMG and drag Vaulty to Applications."
