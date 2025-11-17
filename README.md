<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Vaulty - PDF Exercise Extractor

A powerful desktop application built with Tauri v2 that extracts exercises from PDF textbooks using AI, allowing you to manage and organize educational content effortlessly.

## Features

- **AI-Powered Extraction**: Uses Google Gemini to automatically extract exercises from PDF documents
- **Interactive Bounding Boxes**: Draw boxes around exercises to crop and save images
- **Local Database**: SQLite database for persistent storage of exercises and metadata
- **Search & Filter**: Search exercises by name and filter by tags
- **Secure API Key Storage**: Encrypted storage of your Gemini API key
- **Cross-Platform**: Builds for macOS, Windows, and Linux
- **First-Run Setup**: Easy onboarding wizard for API key configuration
- **Export Functionality**: Export data as JSON and save cropped exercise images

## Prerequisites

- **Node.js** (v16 or later)
- **Rust** (latest stable) - [Install Rust](https://www.rust-lang.org/tools/install)
- **Tauri CLI** (installed via npm)

## Quick Start

### Installation

```bash
# Install dependencies
npm install --legacy-peer-deps
```

### Run in Development

```bash
# Start the Tauri app in dev mode
npm run tauri:dev
```

This will start both the Vite dev server and the Tauri desktop application with hot-reload enabled.

### Build for Production

```bash
# Create production builds for your platform
npm run tauri:build
```

Builds will be located in `src-tauri/target/release/bundle/`

## Architecture

Vaulty is a modern desktop application built with:

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Tauri v2 (Rust)
- **Database**: SQLite (local storage)
- **Styling**: Tailwind CSS v4 + Framer Motion
- **AI**: Google Gemini API (backend integration)

### Key Components

- **PDF Processing**: pdf.js for rendering and page conversion
- **Image Storage**: File system with relative paths
- **Database**: SQLite with structured schema for courses, weeks, and exercises
- **API Integration**: Rust backend handles all Gemini API calls securely

## Documentation

See [TAURI_MIGRATION.md](./TAURI_MIGRATION.md) for detailed migration notes, architecture documentation, and troubleshooting guide.

## Usage

1. **First Run**: Configure your Gemini API key (get one from [Google AI Studio](https://aistudio.google.com/apikey))
2. **Upload PDF**: Select a PDF textbook or worksheet
3. **AI Extraction**: Wait for Gemini to extract exercises
4. **Draw Boxes**: Select each exercise and draw a bounding box around it on the PDF
5. **Export**: Click "Save & Export" to save to database and download JSON
6. **Browse Database**: View, search, and filter all saved exercises

## New Features (Tauri Migration)

✨ **First-run setup wizard** for easy API key configuration
✨ **Settings UI** to update API key anytime
✨ **Search functionality** to find exercises quickly
✨ **Tag filtering** to organize exercises by type
✨ **Delete exercises** from the database view
✨ **File system storage** for better performance
✨ **Secure encryption** for API key storage
✨ **Cross-platform builds** for macOS, Windows, Linux

## License

This project was originally created with AI Studio and has been migrated to a standalone Tauri desktop application.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
