Iris AI Assistant - Installation Guide

This guide provides step-by-step instructions for installing and configuring the Iris AI Assistant Chrome extension.


Prerequisites

Before you begin, make sure you have:

• Google Chrome or a Chromium-based browser (Edge, Brave, etc.)
• A Google Gemini API key (required)
• An OpenAI API key (optional)
• Node.js and npm (for proxy server deployment)


Step 1: Get API Keys

Google Gemini API Key (Required)
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key and keep it secure


OpenAI API Key (Optional)
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account
3. Click "Create new secret key"
4. Copy your API key and keep it secure


Step 2: Deploy the Proxy Server

The proxy server is required to securely communicate with the AI models. Choose one of the following deployment options:


Option A: Railway Deployment (Recommended)
1. Fork this repository to your GitHub account
2. Visit [Railway.app](https://railway.app)
3. Sign in with your GitHub account
4. Click "New Project" → "Deploy from GitHub repo"
5. Select your forked repository
6. Add the following environment variables:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `OPENAI_API_KEY`: Your OpenAI API key (optional)
- `NODE_ENV`: production
7. Click "Deploy"
8. Once deployed, note your Railway app URL (e.g., `https://iris-proxy-production.up.railway.app`)


Option B: Local Deployment
1. Clone this repository to your local machine
2. Navigate to the proxy directory:
```bash
cd proxy
```
3. Install dependencies:
```bash
npm install
```
4. Create a .env file:
```bash
cp .env.example .env
```
5. Edit the .env file with your API keys:
```
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
PORT=3000
```
6. Start the server:
```bash
npm start
```
7. Your proxy server will be available at `http://localhost:3000`


Step 3: Install the Chrome Extension
1. Clone or download this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked"
5. Select the `extension` folder from the repository
6. The Iris AI Assistant icon should now appear in your browser toolbar


Step 4: Configure the Extension
1. Click the Iris AI Assistant icon in your browser toolbar
2. Click the settings gear icon (⚙️) in the top-right corner of the Iris panel
3. Configure the following settings:
- **Theme**: Choose between Dark, Light, or System
- **Privacy Level**: Select your preferred privacy level
- **Proxy URL**: Enter your proxy server URL:
  - For Railway: `https://your-app-name.railway.app/generate-content`
  - For local: `http://localhost:3000/generate-content`
4. Click "Save Settings"


Step 5: Test the Extension
1. Navigate to any webpage
2. Click the Iris AI Assistant icon in your browser toolbar
3. Try one of the quick actions:
- 📝 Summarize
- 💡 Explain
- 🌐 Translate
- 🔑 Key Points
- ❓ Ask Questions
4. Or type a custom question about the webpage content
5. Choose your preferred response style (Creative, Balanced, or Precise)
6. Click "Send" or press Enter


Troubleshooting

Extension Not Working
1. Check that the proxy server is running
2. Verify your API keys are correct
3. Ensure the proxy URL in the extension settings is correct
4. Check the browser console for any error messages


Proxy Server Issues
1. Verify your API keys are correctly set in the environment variables
2. Check that the server is running and accessible
3. Test the health endpoint: `https://your-proxy-url/health`
4. Check server logs for any error messages


API Key Issues
1. Verify your API keys are valid
2. Check for any usage limits or restrictions
3. Ensure the keys have the necessary permissions


Updating the Extension

When new versions are released:

1. Pull the latest changes from the repository
2. Navigate to `chrome://extensions/`
3. Find Iris AI Assistant and click "Remove"
4. Follow the installation steps again to install the updated version


Security Recommendations
• Never share your API keys publicly
• Use environment variables for API keys, not hardcoded values
• Deploy the proxy server with HTTPS enabled
• Regularly update the extension and proxy server


Next Steps
• Explore the different privacy settings to find your preferred balance
• Try the different response styles for various types of questions
• Use the quick actions for common tasks
• Export interesting conversations for future reference


For more information, refer to the [README.md](README.md) file.
