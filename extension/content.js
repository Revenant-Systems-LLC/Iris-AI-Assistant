// Iris AI Assistant - Content Script
// Main orchestrator - handles initialization and message passing

(() => {
'use strict';

// Configuration
const CONFIG = {
  DEFAULT_PROXY_URL: 'http://localhost:3000/generate-content',
  PRODUCTION_PROXY_URL: 'https://iris-proxy-production.up.railway.app/generate-content',
  LLM_MODELS: {
    gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-pro'],
    openai: ['gpt-4o', 'gpt-4o-mini']
  },
  INTENT_MAPPINGS: {
    creative: {
      gemini: 'gemini-1.5-pro',
      openai: 'gpt-4o',
      temperature: 0.9
    },
    balanced: {
      gemini: 'gemini-1.5-flash',
      openai: 'gpt-4o',
      temperature: 0.7
    },
    precise: {
      gemini: 'gemini-1.5-flash',
      openai: 'gpt-4o-mini',
      temperature: 0.3
    }
  },
  QUICK_ACTIONS: [
    { id: 'summarize', icon: '📝', text: 'Summarize', prompt: 'Please summarize the key points of this webpage in a concise way.' },
    { id: 'explain', icon: '💡', text: 'Explain', prompt: 'Please explain the main concepts on this page in simple terms.' },
    { id: 'translate', icon: '🌐', text: 'Translate', prompt: 'Please translate the main content of this page to {language}.' },
    { id: 'keypoints', icon: '🔑', text: 'Key Points', prompt: 'What are the 3-5 most important points on this page?' },
    { id: 'questions', icon: '❓', text: 'Ask Questions', prompt: 'Please generate 3 insightful questions about the content of this page.' }
  ],
  MAX_CONTEXT_LENGTH: 8000,
  MAX_HISTORY_LENGTH: 12,
  OFFLINE_CACHE_SIZE: 50,
  CACHE_EXPIRATION: 24 * 60 * 60 * 1000, // 24 hours
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // Initial retry delay in ms
};

const TIER_FEATURES = {
  free: { queryLimit: 20, allowedIntents: ['balanced'] },
  pro: { queryLimit: Infinity, allowedIntents: ['creative', 'balanced', 'precise'] },
  revenant: { queryLimit: Infinity, allowedIntents: ['creative', 'balanced', 'precise'] }
};

// Tier display mapping
const TIER_DISPLAY_NAMES = {
  'free': 'The Pilgrim\'s Echo',
  'pro': 'The Harbinger\'s Sigil',
  'revenant': 'The Revenant\'s Avatar'
};

// Global state
let chatContainer = null;
let isInitialized = false;
let isOffline = !navigator.onLine;
let pendingRequests = [];
let currentSettings = {
  proxy_url: CONFIG.PRODUCTION_PROXY_URL,
  intent: 'balanced',
  theme: 'dark',
  llm: 'gemini',
  model: 'gemini-1.5-flash',
  privacy_level: 'standard', // standard, minimal, local_only
  chat_history: [],
  offline_cache: [],
  license_tier: 'free',
  daily_query_count: 0,
  last_query_reset: 0
};

// Initialize Iris when content script loads
async function initialize() {
  if (isInitialized) return;
  
  try {
    // Load settings from Chrome storage
    await loadSettings();
    
    // Create UI
    createChatInterface();
    
    // Setup event listeners
    setupEventListeners();
    
    // Initialize offline detection
    setupOfflineDetection();
    
    // Initialize IndexedDB for offline cache
    await initializeOfflineCache();
    
    // Setup multi-tab sync
    setupTabSync();
    
    isInitialized = true;
    console.log('✅ Iris AI Assistant initialized');
    
  } catch (error) {
    console.error('❌ Failed to initialize Iris:', error);
  }
}

// Load settings from Chrome storage
async function loadSettings() {
  try {
    const stored = await chrome.storage.sync.get([
      'iris_proxy_url',
      'iris_intent', 
      'iris_theme',
      'iris_llm',
      'iris_model',
      'iris_privacy_level',
      'iris_chat_history',
      'iris_offline_cache',
      'iris_license_tier',
      'iris_daily_query_count',
      'iris_last_query_reset',
      'iris_license_key'
    ]);
    
    currentSettings = {
      proxy_url: stored.iris_proxy_url || CONFIG.PRODUCTION_PROXY_URL,
      intent: stored.iris_intent || 'balanced',
      theme: stored.iris_theme || 'dark',
      llm: stored.iris_llm || 'gemini',
      model: stored.iris_model || 'gemini-1.5-flash',
      privacy_level: stored.iris_privacy_level || 'standard',
      chat_history: stored.iris_chat_history || [],
      offline_cache: stored.iris_offline_cache || [],
      license_tier: stored.iris_license_tier || 'free',
      daily_query_count: stored.iris_daily_query_count || 0,
      last_query_reset: stored.iris_last_query_reset || 0,
      license_key: stored.iris_license_key || null
    };
    
    // Reset daily counter if needed
    const now = Date.now();
    if (now - currentSettings.last_query_reset > 24 * 60 * 60 * 1000) {
      currentSettings.daily_query_count = 0;
      currentSettings.last_query_reset = now;
      await chrome.storage.sync.set({
        iris_daily_query_count: 0,
        iris_last_query_reset: now
      });
    }
    
    // Update model based on intent
    updateModelFromIntent();
    
  } catch (error) {
    console.warn('⚠️ Could not load settings, using defaults:', error);
  }
}

// Update model based on selected intent
function updateModelFromIntent() {
  const intentConfig = CONFIG.INTENT_MAPPINGS[currentSettings.intent];
  if (intentConfig) {
    currentSettings.model = intentConfig[currentSettings.llm];
    currentSettings.temperature = intentConfig.temperature;
  }
}

// Save settings to Chrome storage
async function saveSettings() {
  try {
    await chrome.storage.sync.set({
      iris_proxy_url: currentSettings.proxy_url,
      iris_intent: currentSettings.intent,
      iris_theme: currentSettings.theme,
      iris_llm: currentSettings.llm,
      iris_model: currentSettings.model,
      iris_privacy_level: currentSettings.privacy_level,
      iris_chat_history: currentSettings.chat_history,
      iris_offline_cache: currentSettings.offline_cache.slice(0, 10), // Only store the 10 most recent cache entries
      iris_license_tier: currentSettings.license_tier,
      iris_daily_query_count: currentSettings.daily_query_count,
      iris_last_query_reset: currentSettings.last_query_reset
    });
    
    // Broadcast settings change to other tabs
    broadcastSettingsChange();
    
  } catch (error) {
    console.error('❌ Failed to save settings:', error);
  }
}

// Initialize IndexedDB for offline cache
async function initializeOfflineCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('IrisOfflineCache', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('responses')) {
        const store = db.createObjectStore('responses', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    
    request.onsuccess = () => {
      console.log('✅ Offline cache initialized');
      resolve();
    };
    
    request.onerror = (event) => {
      console.error('❌ Failed to initialize offline cache:', event.target.error);
      reject(event.target.error);
    };
  });
}

// Setup offline detection
function setupOfflineDetection() {
  window.addEventListener('online', () => {
    isOffline = false;
    showStatus('You are back online', 'success');
    processPendingRequests();
  });
  
  window.addEventListener('offline', () => {
    isOffline = true;
    showStatus('You are offline. Some features may be limited.', 'warning');
  });
}

// Process any pending requests when coming back online
async function processPendingRequests() {
  if (pendingRequests.length === 0) return;
  
  showStatus(`Processing ${pendingRequests.length} pending requests...`, 'info');
  
  for (const request of pendingRequests) {
    try {
      await sendMessage(request.message, request.callback);
    } catch (error) {
      console.error('❌ Failed to process pending request:', error);
    }
  }
  
  pendingRequests = [];
  showStatus('All pending requests processed', 'success');
}

// Setup multi-tab sync
function setupTabSync() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.iris_chat_history) {
      // Only update if the change came from another tab
      const externalUpdate = true; // This would need a proper implementation to detect external updates
      if (externalUpdate) {
        currentSettings.chat_history = changes.iris_chat_history.newValue || [];
        displayChatHistory();
      }
    }
  });
}

// Broadcast settings change to other tabs
function broadcastSettingsChange() {
  chrome.runtime.sendMessage({
    action: 'syncChatHistory',
    chatHistory: currentSettings.chat_history
  }).catch(() => {
    // Ignore errors if background script isn't ready
  });
}

// Create the chat interface
function createChatInterface() {
  if (chatContainer) return;
  
  chatContainer = document.createElement('div');
  chatContainer.id = 'iris-chat-container';
  chatContainer.className = `iris-theme-${currentSettings.theme}`;
  chatContainer.style.display = 'none';
  
  chatContainer.innerHTML = `
    <div id="iris-chat-header" class="iris-draggable">
      <div class="iris-header-title">
        <span class="iris-logo">✧</span>
        <span>Iris AI Assistant</span>
      </div>
      <div class="iris-header-buttons">
        <button id="iris-settings-btn" title="Settings">⚙️</button>
        <button id="iris-clear-btn" title="Clear History">🗑️</button>
        <button id="iris-close-btn" title="Close">×</button>
      </div>
    </div>
    
    <div id="iris-chat-messages"></div>
    
    <div id="iris-quick-actions">
      ${CONFIG.QUICK_ACTIONS.map(action => 
        `<button class="iris-quick-action" data-id="${action.id}" title="${action.text}">
          ${action.icon} ${action.text}
        </button>`
      ).join('')}
    </div>
    
    <div id="iris-input-area">
      <div class="iris-intent-selector">
        <label>Response style:</label>
        <div class="iris-intent-options">
          <button class="iris-intent-btn ${currentSettings.intent === 'creative' ? 'active' : ''}" data-intent="creative">Creative</button>
          <button class="iris-intent-btn ${currentSettings.intent === 'balanced' ? 'active' : ''}" data-intent="balanced">Balanced</button>
          <button class="iris-intent-btn ${currentSettings.intent === 'precise' ? 'active' : ''}" data-intent="precise">Precise</button>
        </div>
      </div>
      
      <div class="iris-input-container">
        <textarea 
          id="iris-chat-input" 
          placeholder="Ask about this page or selected text..."
          rows="2"
        ></textarea>
        <button id="iris-send-btn" title="Send message">
          <span>Send</span>
        </button>
      </div>
      
      <div id="iris-status" class="iris-hidden"></div>
    </div>
    
    <div id="iris-settings-modal" class="iris-modal iris-hidden">
      <div class="iris-modal-content">
        <div class="iris-modal-header">
          <h3>Iris Settings</h3>
          <button id="iris-settings-close" class="iris-modal-close">×</button>
        </div>
        
        <div class="iris-modal-body">
          <div class="iris-setting-group">
            <label for="iris-theme-select">Theme:</label>
            <select id="iris-theme-select">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>
          
          <div class="iris-setting-group">
            <label for="iris-privacy-select">Privacy Level:</label>
            <select id="iris-privacy-select">
              <option value="standard">Standard - Full page context</option>
              <option value="minimal">Minimal - Only essential content</option>
              <option value="local_only" class="pro-feature">Local Only (Pro)</option>
            </select>
          </div>
          
          <div class="iris-setting-group">
            <label for="iris-license-key-input">License Key:</label>
            <input type="text" id="iris-license-key-input" placeholder="Enter your license key...">
          </div>

          <div class="iris-setting-group">
            <label for="iris-proxy-input">Proxy URL (Advanced):</label>
            <input type="url" id="iris-proxy
