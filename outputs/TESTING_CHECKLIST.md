Iris AI Assistant - Testing Checklist

This document provides a comprehensive checklist for testing the Iris AI Assistant Chrome extension after installation.


Installation Verification
• Extension icon appears in Chrome toolbar
• Extension can be pinned to toolbar for easy access
• Extension details page shows correct version (3.0.0)
• Extension permissions are correctly granted


Basic Functionality
• Click extension icon to open Iris panel
• Iris panel appears on the right side of the page (default)
• Welcome message is displayed
• Input field is present and accepts text
• Send button works to submit messages
• Pressing Enter in the input field submits messages
• Iris responds to basic questions about the current page
• Close button (X) hides the Iris panel
• Clicking extension icon again re-opens the panel


Quick Actions
• Quick action buttons are displayed at the bottom of the panel
• "Summarize" button works and generates a summary of the page
• "Explain" button works and explains concepts on the page
• "Find" button works and identifies key facts/figures
• "Translate" button prompts for language and translates content
• "Code" button extracts and explains code examples (if present)


Settings
• Settings icon (gear) opens settings panel
• Theme setting changes appearance (Light/Dark/System)
• Position setting moves panel (Left/Right)
• Font Size setting changes text size (Small/Medium/Large)
• Quick Actions toggle shows/hides quick action buttons
• AI Provider setting changes between Gemini and OpenAI
• Response Style setting changes between Creative/Balanced/Precise
• Context Length setting changes conversation memory
• Privacy Level setting works (Minimal/Balanced/Full)
• Offline Mode setting works (Auto/Always/Never)
• Sync Across Tabs setting enables multi-tab functionality
• Proxy Server setting allows changing API endpoint
• "Reset to Defaults" button restores default settings
• "Clear History" button clears conversation history


Advanced Features
• Conversation persists when navigating between pages
• Panel can be dragged to reposition
• Panel can be resized by dragging corner
• Multi-tab sync works when enabled (conversation appears in other tabs)
• Offline mode works when internet connection is lost
• Error messages are clear and provide guidance
• Long responses are properly formatted with markdown


Cross-browser Testing
• Works on Chrome for Windows
• Works on Chrome for macOS
• Works on Chrome for Linux
• Works on Chrome for Android (responsive design)
• Works on Edge (Chromium-based)


Performance Testing
• Extension loads quickly on page load
• UI remains responsive during AI processing
• No noticeable slowdown on complex pages
• Memory usage remains reasonable during extended use


Bug Reporting

If you encounter any issues during testing, please report them with the following information:

1. Description of the issue
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Browser version and OS
6. Screenshots (if applicable)
7. Console errors (if any)


Submit bug reports to: [GitHub Issues](https://github.com/Revenant-Systems-LLC/Iris-AI-Assistant/issues)
