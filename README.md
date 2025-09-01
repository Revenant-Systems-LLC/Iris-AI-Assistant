## **Iris AI Assistant - Chrome Extension 'AyeEyes'**

*Transform any webpage into an intelligent conversation with AI.* 

***Context-aware discussions powered by Gemini and ChatGPT.***

![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome Extension](https://img.shields.io/badge/chrome-extension-yellow.svg)

## Features

-  **Context-Aware AI**: Automatically understands webpage content for relevant responses
-  **Multi-LLM Support**: Switch between Google Gemini and OpenAI models seamlessly  
-  **Persistent Conversations**: Chat history saved across sessions
-  **Beautiful UI**: Modern, draggable interface with dark/light themes
-  **Customizable**: Adjustable temperature, proxy URLs, and model selection
-  **Export Chats**: Save conversation history as text files
-  **Privacy-First**: All data stored locally in Chrome storage

##  Quick Start

### Prerequisites

- Chrome/Chromium browser
- Node.js 16+ (for proxy server)
- Google Gemini API key ([Get here](https://aistudio.google.com/app/apikey))
- OpenAI API key ([Get here](https://platform.openai.com/api-keys)) (optional)

### 1. Deploy Proxy Server

#### Option A: Railway (Recommended - Free)

1. Fork this repository
2. Visit [Railway.app](https://railway.app)
3. Click "Deploy from GitHub repo"
4. Select your forked repository
5. Set environment variables:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `OPENAI_API_KEY`: Your OpenAI API key (optional)
   - `NODE_ENV`: production
6. Deploy! Your proxy URL will be: `https://your-app.railway.app/generate-content`

#### Option B: Local Development

```bash
cd proxy
npm install
cp .env.example .env
# Edit .env with your API keys
npm start
```

**Install Chrome Extension**
Download or clone this repository
Open Chrome → Extensions (chrome://extensions/)
Enable "Developer mode" (top right toggle)
Click "Load unpacked"
Select the extension/ folder
Iris icon should appear in your Chrome toolbar! (Don't forget to PIN it)

**Configure & Use**
Click the Iris icon on any webpage
Click the settings gear to configure:
Set your proxy URL (from step 1)
Choose your preferred AI model
Adjust temperature and theme
Start chatting! Iris automatically understands the page context


## Project Development Structure

 
├── extension/                   # Chrome extension files

│   ├── manifest.json            # Extension configuration

│   ├── content.js               # Main chat interface

│   ├── background.js            # Service worker

│   └── icons/                   # Extension icons

├── proxy/                       # Node.js proxy server

│   ├── server.js                # Express server

│   ├── package.json             # Dependencies

│   └── .env.example             # Environment template
      
├── railway.json                 # Railway deployment config

├── render.yaml                  # Render deployment config

├── DEPLOYMENT.md                # Directions for installation 

├── DEVELOPMENT_TIMELINE.md      # Entire development history

├── TRANSFORMATION_SUMMARY.md    # My progress towards the UPD

└── README.md                    # This file



# Local Development
 
Start proxy server
```
cd proxy

npm install

npm run dev 
```
 Uses nodemon for auto-reload
 
# Load extension in Chrome
 1. Open chrome://extensions/
 2. Enable Developer mode
 3. Load unpacked → select extension/ folder

# Test health endpoint
```
curl http://localhost:3000/health
```

# Security & Privacy

API keys stored securely on proxy server only.

No data sent to third parties except chosen AI providers.

Chat history stored locally in Chrome storage.

HTTPS enforced for all API communications.


# License

This project is licensed under the MIT License.


# CONTACT ME

**Support:** support@revenantsystems.dev

**Issues:** GitHub Issues

**Email:** dave@revenantsystems.dev


---
░░░░░░░░░░░▄▐░░░

░░░░░▄▄▄░░▄██▄░░

░░░░▐▀█▀▌░░░░▀█▄

░░░░▐█▄█▌░░░░░░▀█

░░░░░▀▄▀░░░▄▄▄▄▄▀   

░░░▄▄▄██▀▀▀▀░░░░  |Made with ᚺᚾᛉᚲᛏ by David Fisher|  aka  |Dₐᵥₑ𖦹fₜₕₑDₑₐd|

░░█▀▄▄▄█░▀▀░░░░░  |Founder of Revenant Systems LLC|      

░░▌░▄▄▄▐▌▀▀▀░░░░  

░▐░░░▄▄░█░▀▀░░░░

█▌░░░▄░▀█▀░▀░░░░

░░░░░░▄▄▐▌▄▄░░░░

░░░░░░▀███▀█▄░░░

░░░░░▐▌▀▄▀▄▀▐░░░

░░░░░▐▀░░░░░░▐▌░

░░░░░█░░░░░░░░█░

░░░░▐▌░░░░░░░░░█
 
