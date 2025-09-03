# Iris AI Assistant

![Iris AI Assistant Logo](extension/icons/icon128.png)

## Overview

Iris AI Assistant is a powerful Chrome extension that transforms any webpage into an intelligent conversation with AI. It provides context-aware discussions powered by Google's Gemini and OpenAI's GPT models.

## Features

### Smart Context Awareness
- Intelligent content extraction that prioritizes visible content
- Relevance scoring for extracted content
- Content hierarchy (headings > paragraphs > other elements)
- Structured data extraction when available

### Unified AI Interface
- Simplified intent-based options:
  - **Creative**: For more diverse and creative responses
  - **Balanced**: For general-purpose balanced responses
  - **Precise**: For factual and concise responses

### Quick Actions
- One-click buttons for common tasks:
  - 📝 **Summarize**: Get a concise summary of the page
  - 💡 **Explain**: Explain concepts in simple terms
  - 🔍 **Find**: Identify key facts and figures
  - 🌐 **Translate**: Translate content to another language
  - 💻 **Code**: Extract and explain code examples

### Offline Mode
- Response caching using IndexedDB
- Offline detection and graceful degradation
- Simple offline Q&A system using cached responses
- Queue for pending requests when connection is restored

### Multi-tab Sync
- Share conversation context across browser tabs
- Real-time updates across tabs
- Tab-specific context when needed
- Shared conversation history

### Better Error UX
- Friendly error messages with actionable steps
- Automatic retry with exponential backoff
- Troubleshooting guidance for common errors
- Network status monitoring

### Performance Optimization
- Lazy loading of UI components
- Response caching
- Optimized DOM operations
- Efficient context management
- Background processing for heavy operations

### Privacy Controls
- Granular privacy settings:
  - Page content sharing controls
  - History retention options
  - Data minimization options
  - Local-only mode option
- Content filtering before sending to AI

### Responsive Design
- Mobile-friendly touch targets
- Adaptive layouts for different screen sizes
- Optimized for touch interactions

## Installation

### From Chrome Web Store
1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (coming soon)
2. Search for "Iris AI Assistant"
3. Click "Add to Chrome"

### Manual Installation (Developer Mode)
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the `extension` folder from this repository
5. The extension icon should appear in your browser toolbar

## Usage

1. Click the Iris icon in your browser toolbar to activate the assistant
2. Ask questions about the current webpage or use quick actions
3. Adjust settings by clicking the gear icon in the Iris panel

## Proxy Server Setup

Iris uses a proxy server to communicate with AI providers. You can:

1. Use the default production server (recommended)
2. Run your own local server (for development)
3. Deploy your own instance to Railway or another platform

### Local Server Setup

1. Navigate to the `proxy` directory
2. Copy `.env.example` to `.env` and add your API keys
3. Run `npm install` to install dependencies
4. Run `npm start` to start the server
5. In Iris settings, select "Local" for the proxy server

### Railway Deployment

1. Fork this repository
2. Create a new project on [Railway](https://railway.app/)
3. Connect your GitHub repository
4. Add environment variables from `.env.example`
5. Deploy the project
6. In Iris settings, update the proxy URL to your Railway deployment URL

## Development

### Extension Structure
- `content.js`: Main script that creates the chat interface and handles interactions
- `background.js`: Service worker that handles extension icon clicks and initialization
- `manifest.json`: Extension configuration

### Proxy Server Structure
- `server.js`: Express server that handles API requests
- `package.json`: Dependencies and scripts
- `.env.example`: Example environment variables

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Google Gemini API](https://ai.google.dev/)
- [OpenAI API](https://openai.com/api/)
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/)
