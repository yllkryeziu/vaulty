# Vaulty - Tauri Migration Guide

This document explains the Tauri v2 migration and how to build and run the application.

## What Changed

### Architecture
- **Before**: Web app using localStorage, CDN dependencies, client-side API calls
- **After**: Tauri desktop app with Rust backend, SQLite database, secure API key storage

### Key Changes

1. **Database**: localStorage → SQLite database (stored in app data directory)
2. **Images**: Base64 strings → File system storage
3. **API Calls**: Client-side Gemini API → Rust backend with secure key storage
4. **Dependencies**: CDN imports → npm packages (proper bundling)
5. **Styling**: CDN Tailwind → PostCSS + Tailwind build process (exact same appearance)

### New Features

1. **First-Run Setup**: Wizard to configure API key on first launch
2. **Settings Management**: Update API key through UI (stored securely in database)
3. **Search & Filter**: Search exercises by name, filter by tags
4. **Edit/Delete**: Delete exercises from database view
5. **Cross-Platform**: Builds for macOS, Windows, and Linux

## Prerequisites

- **Node.js** (v16 or later)
- **Rust** (latest stable)
- **Tauri CLI** (installed via npm)

## Development

### Install Dependencies

```bash
npm install --legacy-peer-deps
```

### Run in Development Mode

```bash
npm run tauri:dev
```

This will:
1. Start Vite dev server on port 5173
2. Launch Tauri window with hot-reload

### Build for Production

```bash
npm run tauri:build
```

Builds will be created in `src-tauri/target/release/bundle/`

## Project Structure

```
vaulty/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Tauri app entry point
│   │   ├── db.rs           # SQLite database setup
│   │   ├── commands.rs     # Tauri commands (API)
│   │   └── gemini.rs       # Gemini API integration
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── components/             # React components
├── services/               # Frontend services
├── utils/                  # Utility functions
├── App.tsx                 # Main app component
├── index.tsx               # Entry point
├── tailwind.config.js      # Tailwind configuration
└── package.json            # Node dependencies
```

## Tauri Commands

The Rust backend exposes these commands to the frontend:

### API Key Management
- `save_api_key(apiKey: string)` - Store API key securely
- `get_api_key()` - Retrieve API key

### AI Integration
- `extract_exercises_with_ai(images: string[])` - Extract exercises from PDF images

### Database Operations
- `save_week_data(courseName, weekNumber, exercises)` - Save exercises to database
- `get_all_courses()` - Get all courses and exercises
- `delete_exercise(exerciseId)` - Delete an exercise
- `search_exercises(query)` - Search exercises by name
- `filter_by_tags(tags)` - Filter exercises by tags

### File Operations
- `save_image(imageData, exerciseName)` - Save cropped image to filesystem
- `get_image_path(relativePath)` - Load image as base64

## Data Storage

### Database Location
- **macOS**: `~/Library/Application Support/com.vaulty.app/vaulty.db`
- **Windows**: `%APPDATA%\com.vaulty.app\vaulty.db`
- **Linux**: `~/.local/share/com.vaulty.app/vaulty.db`

### Images Location
Same directory as database, in `images/` subfolder

### Database Schema

```sql
CREATE TABLE courses (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE weeks (
    id INTEGER PRIMARY KEY,
    course_id INTEGER,
    week_number INTEGER,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE exercises (
    id INTEGER PRIMARY KEY,
    week_id INTEGER,
    name TEXT,
    tags_json TEXT,
    image_path TEXT,
    FOREIGN KEY (week_id) REFERENCES weeks(id) ON DELETE CASCADE
);

CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

## Styling

The app uses the exact same styling as before:
- Tailwind CSS (dark theme)
- Framer Motion (animations)
- Lucide React (icons)
- Custom scrollbar styles

All colors, spacing, and components remain identical to the original web app.

## Troubleshooting

### Icons Not Found
The app uses default Tauri icons. To generate custom icons:
```bash
npx tauri icon path/to/1024x1024.png
```

### Database Errors
Delete the database file and restart the app to rebuild:
- macOS: `rm ~/Library/Application\ Support/com.vaulty.app/vaulty.db`

### Build Failures
1. Ensure Rust is installed: `rustc --version`
2. Update Rust: `rustup update`
3. Clean build: `cd src-tauri && cargo clean`

## Deployment

### macOS
- DMG installer: `src-tauri/target/release/bundle/dmg/`
- App bundle: `src-tauri/target/release/bundle/macos/`

### Windows
- MSI installer: `src-tauri/target/release/bundle/msi/`
- NSIS installer: `src-tauri/target/release/bundle/nsis/`

### Linux
- AppImage: `src-tauri/target/release/bundle/appimage/`
- DEB package: `src-tauri/target/release/bundle/deb/`

## Notes

- The app requires a Gemini API key to extract exercises
- Get your API key from: https://aistudio.google.com/apikey
- First-run setup will prompt for API key configuration
- JSON export functionality is preserved for backup purposes
