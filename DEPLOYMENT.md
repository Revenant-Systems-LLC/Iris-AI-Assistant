# 🚀 Iris AI Assistant - Deployment Guide

## Phase 1: Infrastructure Deployment (10 minutes)

### ✅ Deploy Proxy Server to Railway

1. **Sign up for Railway**: [railway.app](https://railway.app) (free GitHub account)

2. **Deploy Repository**:
   - Click "Deploy from GitHub repo" 
   - Connect your GitHub account
   - Select this repository
   - Railway auto-detects `railway.json` configuration

3. **Configure Environment Variables** in Railway Dashboard:
GEMINI_API_KEY=your_actual_api_key_here OPENAI_API_KEY=your_actual_api_key_here
NODE_ENV=production PORT=3000


4. **Verify Deployment**:
- Railway provides URL like: `https://iris-proxy-production.railway.app`
- Test health: `curl https://your-url.railway.app/health`
- Should return: `{"status":"healthy","timestamp":"...","keys":{"gemini":true}}`

## Phase 2: Chrome Extension Configuration (5 minutes)

### ✅ Update Production Settings

1. **Edit `extension/content.js`** - Line ~9:
```javascript
const CONFIG = {
  DEFAULT_PROXY_URL: 'http://localhost:3000/generate-content',
  PRODUCTION_PROXY_URL: 'https://YOUR-RAILWAY-URL.railway.app/generate-content', // UPDATE THIS
  // ... rest unchanged
};
Update Default URL - Line ~17:
let currentSettings = {
  proxy_url: CONFIG.PRODUCTION_PROXY_URL, // Change from DEFAULT to PRODUCTION
  // ... rest unchanged
};
✅ Load Extension in Chrome
Open Chrome → chrome://extensions/
Enable "Developer mode" (toggle top-right)
Click "Load unpacked"
Select the extension/ folder from your project
Iris icon appears in Chrome toolbar ✨
Phase 3: Testing & Validation (5 minutes)
✅ Functional Testing
Visit any webpage (e.g., Wikipedia article)
Click Iris icon in toolbar
Settings test:
Click gear icon ⚙️
Verify proxy URL shows your Railway URL
Test theme switching
Chat test:
Type: "Summarize this page"
Should get AI response about the webpage
Verify message history persists
✅ Error Handling Test
Network test: Disable internet → should show "Network error"
Invalid model: Change model to non-existent → should show error
Empty input: Try sending empty message → should do nothing
🚨 Troubleshooting
Common Issues:
"Network error" in extension:

Check Railway deployment is running
Verify environment variables set correctly
Test health endpoint returns 200
"Invalid API key" errors:

Confirm API keys in Railway environment variables
Test API keys work with direct curl commands
Check API quota hasn't been exceeded
Extension not loading:

Enable Developer mode in Chrome
Check console for JavaScript errors
Verify manifest.json permissions correct
🎯 Success Metrics
After deployment, you should have:

✅ Live proxy server with uptime monitoring
✅ Functional Chrome extension working on any website
✅ Professional documentation with screenshots
✅ Portfolio-ready project demonstrating full-stack skills
✅ Ready to deploy? Follow this checklist step-by-step!
