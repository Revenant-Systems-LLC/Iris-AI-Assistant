// Iris AI Assistant - Content Script
// Main orchestrator - handles initialization and message passing

(() => {
'use strict';

// Configuration
const CONFIG = {
  DEFAULT_PROXY_URL: 'http://localhost:3000/generate-content',
  PRODUCTION_PROXY_URL: 'https://iris-proxy.railway.app/generate-content', // Update after deployment
  LLM_MODELS: {
    gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'],
    openai: ['gpt-4o', 'gpt-4o-mini']
  },
  MAX_CONTEXT_LENGTH: 5000,
  MAX_HISTORY_LENGTH: 8
};

// Global state
let chatContainer = null;
let isInitialized = false;
let currentSettings = {
  proxy_url: CONFIG.DEFAULT_PROXY_URL,
  temperature: 0.7,
  theme: 'dark',
  llm: 'gemini',
  model: 'gemini-1.5-flash',
  chat_history: []
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
      'iris_temperature', 
      'iris_theme',
      'iris_llm',
      'iris_model',
      'iris_chat_history'
    ]);
    
    currentSettings = {
      proxy_url: stored.iris_proxy_url || CONFIG.DEFAULT_PROXY_URL,
      temperature: stored.iris_temperature || 0.7,
      theme: stored.iris_theme || 'dark',
      llm: stored.iris_llm || 'gemini',
      model: stored.iris_model || 'gemini-1.5-flash',
      chat_history: stored.iris_chat_history || []
    };
    
  } catch (error) {
    console.warn('⚠️ Could not load settings, using defaults:', error);
  }
}

// Save settings to Chrome storage
async function saveSettings() {
  try {
    await chrome.storage.sync.set({
      iris_proxy_url: currentSettings.proxy_url,
      iris_temperature: currentSettings.temperature,
      iris_theme: currentSettings.theme,
      iris_llm: currentSettings.llm,
      iris_model: currentSettings.model,
      iris_chat_history: currentSettings.chat_history
    });
  } catch (error) {
    console.error('❌ Failed to save settings:', error);
  }
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
        <button id="iris-close-btn" title="Close">&times;</button>
      </div>
    </div>
    
    <div id="iris-chat-messages"></div>
    
    <div id="iris-input-area">
      <div class="iris-model-selector">
        <select id="iris-llm-select">
          <option value="gemini">Gemini</option>
          <option value="openai">OpenAI</option>
        </select>
        <select id="iris-model-select"></select>
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
          <button id="iris-settings-close" class="iris-modal-close">&times;</button>
        </div>
        
        <div class="iris-modal-body">
          <div class="iris-setting-group">
            <label for="iris-temp-slider">Temperature: <span id="iris-temp-value">${currentSettings.temperature}</span></label>
            <input type="range" id="iris-temp-slider" min="0" max="1" step="0.1" value="${currentSettings.temperature}">
          </div>
          
          <div class="iris-setting-group">
            <label for="iris-proxy-input">Proxy URL:</label>
            <input type="url" id="iris-proxy-input" value="${currentSettings.proxy_url}">
          </div>
          
          <div class="iris-setting-group">
            <label for="iris-theme-select">Theme:</label>
            <select id="iris-theme-select">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
        
        <div class="iris-modal-footer">
          <button id="iris-export-btn" class="iris-btn-secondary">Export Chat</button>
          <button id="iris-save-settings-btn" class="iris-btn-primary">Save Settings</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(chatContainer);
  
  // Apply styles
  injectStyles();
  
  // Initialize model selector
  updateModelSelector();
  
  // Load chat history
  displayChatHistory();
}

// Update model selector based on selected LLM
function updateModelSelector() {
  const llmSelect = document.getElementById('iris-llm-select');
  const modelSelect = document.getElementById('iris-model-select');
  
  if (!llmSelect || !modelSelect) return;
  
  llmSelect.value = currentSettings.llm;
  
  // Clear and populate model options
  modelSelect.innerHTML = '';
  const models = CONFIG.LLM_MODELS[currentSettings.llm] || [];
  
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });
  
  modelSelect.value = currentSettings.model;
}

// Display chat history from storage
function displayChatHistory() {
  const messagesDiv = document.getElementById('iris-chat-messages');
  if (!messagesDiv || !currentSettings.chat_history) return;
  
  messagesDiv.innerHTML = '';
  
  currentSettings.chat_history.forEach(message => {
    if (message.role === 'user' || message.role === 'model') {
      displayMessage(message.role, message.parts[0].text);
    }
  });
}

// Display a message in the chat
function displayMessage(role, content) {
  const messagesDiv = document.getElementById('iris-chat-messages');
  if (!messagesDiv) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `iris-message iris-message-${role}`;
  
  // Convert markdown to HTML (simplified)
  let htmlContent = content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  
  messageDiv.innerHTML = htmlContent;
  
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Show status message
function showStatus(message, type = 'info') {
  const statusDiv = document.getElementById('iris-status');
  if (!statusDiv) return;
  
  statusDiv.textContent = message;
  statusDiv.className = `iris-status-${type}`;
  statusDiv.classList.remove('iris-hidden');
  
  setTimeout(() => {
    statusDiv.classList.add('iris-hidden');
  }, 3000);
}

// Get page content for context
function getPageContent() {
  // Get selected text if available
  const selection = window.getSelection().toString().trim();
  if (selection) {
    return `Selected text: "${selection}"`;
  }
  
  // Get page content
  const title = document.title || '';
  const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map(h => h.textContent.trim())
    .filter(text => text.length > 0)
    .slice(0, 5)
    .join('. ');
  
  const paragraphs = Array.from(document.querySelectorAll('p'))
    .map(p => p.textContent.trim())
    .filter(text => text.length > 20)
    .slice(0, 10)
    .join(' ');
  
  let context = `Page: ${title}`;
  if (metaDesc) context += `\nDescription: ${metaDesc}`;
  if (headings) context += `\nHeadings: ${headings}`;
  if (paragraphs) context += `\nContent: ${paragraphs}`;
  
  return context.substring(0, CONFIG.MAX_CONTEXT_LENGTH);
}

// Send message to AI
async function sendMessage(userInput = null) {
  const inputEl = document.getElementById('iris-chat-input');
  const sendBtn = document.getElementById('iris-send-btn');
  
  if (!inputEl || !sendBtn) return;
  
  const message = userInput || inputEl.value.trim();
  if (!message) return;
  
  // Clear input and disable send button
  inputEl.value = '';
  sendBtn.disabled = true;
  sendBtn.innerHTML = '<span>Sending...</span>';
  
  // Display user message
  displayMessage('user', message);
  
  // Add to chat history
  currentSettings.chat_history.push({
    role: 'user',
    parts: [{ text: message }]
  });
  
  try {
    showStatus('AI is thinking...', 'loading');
    
    // Prepare context for first message
    let contextMessages = [...currentSettings.chat_history];
    if (contextMessages.length === 1) {
      const pageContext = getPageContent();
      contextMessages.unshift({
        role: 'system',
        parts: [{ text: `You are Iris, a helpful AI assistant. Context about the current page: ${pageContext}` }]
      });
    }
    
    // Limit history length
    if (contextMessages.length > CONFIG.MAX_HISTORY_LENGTH) {
      contextMessages = contextMessages.slice(-CONFIG.MAX_HISTORY_LENGTH);
    }
    
    // Send request
    const payload = {
      llm: currentSettings.llm,
      model: currentSettings.model,
      contents: contextMessages,
      generationConfig: {
        temperature: currentSettings.temperature,
        maxOutputTokens: 1024
      }
    };
    
    const response = await fetch(currentSettings.proxy_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }
    
    const aiResponse = data.candidates[0].content.parts[0].text;
    
    // Display AI response
    displayMessage('model', aiResponse);
    
    // Add to chat history
    currentSettings.chat_history.push({
      role: 'model',
      parts: [{ text: aiResponse }]
    });
    
    // Save updated history
    await saveSettings();
    
    showStatus('Message sent successfully', 'success');
    
  } catch (error) {
    console.error('❌ Failed to send message:', error);
    displayMessage('model', `❌ Error: ${error.message}`);
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    // Re-enable send button
    sendBtn.disabled = false;
    sendBtn.innerHTML = '<span>Send</span>';
  }
}

// Setup all event listeners
function setupEventListeners() {
  // LLM selector change
  document.getElementById('iris-llm-select')?.addEventListener('change', (e) => {
    currentSettings.llm = e.target.value;
    updateModelSelector();
    saveSettings();
  });
  
  // Model selector change
  document.getElementById('iris-model-select')?.addEventListener('change', (e) => {
    currentSettings.model = e.target.value;
    saveSettings();
  });
  
  // Send button
  document.getElementById('iris-send-btn')?.addEventListener('click', () => sendMessage());
  
  // Input enter key
  document.getElementById('iris-chat-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Header buttons
  document.getElementById('iris-close-btn')?.addEventListener('click', toggleChat);
  document.getElementById('iris-clear-btn')?.addEventListener('click', clearChat);
  document.getElementById('iris-settings-btn')?.addEventListener('click', showSettings);
  
  // Settings modal
  document.getElementById('iris-settings-close')?.addEventListener('click', hideSettings);
  document.getElementById('iris-save-settings-btn')?.addEventListener('click', saveSettingsFromModal);
  document.getElementById('iris-export-btn')?.addEventListener('click', exportChat);
  
  // Settings inputs
  document.getElementById('iris-temp-slider')?.addEventListener('input', (e) => {
    document.getElementById('iris-temp-value').textContent = e.target.value;
  });
  
  // Dragging functionality
  setupDragFunctionality();
}

// Setup drag functionality
function setupDragFunctionality() {
  const header = document.getElementById('iris-chat-header');
  if (!header) return;
  
  let isDragging = false;
  let currentX = 0, currentY = 0, initialX = 0, initialY = 0;
  
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.iris-header-buttons')) return;
    
    initialX = e.clientX - currentX;
    initialY = e.clientY - currentY;
    isDragging = true;
    
    header.style.cursor = 'grabbing';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    
    chatContainer.style.left = currentX + 'px';
    chatContainer.style.top = currentY + 'px';
    chatContainer.style.right = 'auto';
    chatContainer.style.bottom = 'auto';
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      header.style.cursor = 'grab';
    }
  });
}

// Toggle chat visibility
function toggleChat() {
  if (!chatContainer) {
    initialize().then(() => {
      chatContainer.style.display = 'flex';
    });
    return;
  }
  
  const isHidden = chatContainer.style.display === 'none';
  chatContainer.style.display = isHidden ? 'flex' : 'none';
  
  // Auto-summarize on first open if no history
  if (isHidden && currentSettings.chat_history.length === 0) {
    setTimeout(() => sendMessage('Please summarize this webpage'), 500);
  }
}

// Clear chat history
async function clearChat() {
  if (!confirm('Clear all chat history?')) return;
  
  currentSettings.chat_history = [];
  await saveSettings();
  
  const messagesDiv = document.getElementById('iris-chat-messages');
  if (messagesDiv) messagesDiv.innerHTML = '';
  
  showStatus('Chat history cleared', 'success');
}

// Show settings modal
function showSettings() {
  const modal = document.getElementById('iris-settings-modal');
  if (!modal) return;
  
  // Update form values
  document.getElementById('iris-temp-slider').value = currentSettings.temperature;
  document.getElementById('iris-temp-value').textContent = currentSettings.temperature;
  document.getElementById('iris-proxy-input').value = currentSettings.proxy_url;
  document.getElementById('iris-theme-select').value = currentSettings.theme;
  
  modal.classList.remove('iris-hidden');
}

// Hide settings modal
function hideSettings() {
  const modal = document.getElementById('iris-settings-modal');
  if (modal) modal.classList.add('iris-hidden');
}

// Save settings from modal
async function saveSettingsFromModal() {
  currentSettings.temperature = parseFloat(document.getElementById('iris-temp-slider').value);
  currentSettings.proxy_url = document.getElementById('iris-proxy-input').value;
  currentSettings.theme = document.getElementById('iris-theme-select').value;
  
  // Update theme class
  chatContainer.className = `iris-theme-${currentSettings.theme}`;
  
  await saveSettings();
  hideSettings();
  showStatus('Settings saved successfully', 'success');
}

// Export chat history
function exportChat() {
  const history = currentSettings.chat_history
    .map(msg => `${msg.role === 'user' ? 'User' : 'Iris'}: ${msg.parts[0].text}`)
    .join('\n\n');
  
  const blob = new Blob([history], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `iris-chat-${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
  showStatus('Chat exported successfully', 'success');
}

// Inject CSS styles
function injectStyles() {
  if (document.getElementById('iris-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'iris-styles';
  style.textContent = `
    /* Iris AI Assistant Styles */
    #iris-chat-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 400px;
      height: 500px;
      background: var(--iris-bg);
      border: 1px solid var(--iris-border);
      border-radius: 12px;
      box-shadow: 0 8px 24px var(--iris-shadow);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      backdrop-filter: blur(8px);
    }
    
    /* Dark theme */
    .iris-theme-dark {
      --iris-bg: rgba(32, 33, 36, 0.95);
      --iris-text: #ffffff;
      --iris-border: #444444;
      --iris-shadow: rgba(0, 0, 0, 0.3);
      --iris-input-bg: #2a2b2f;
      --iris-message-user-bg: #4285f4;
      --iris-message-ai-bg: #333438;
      --iris-accent: #40e0d0;
    }
    
    /* Light theme */
    .iris-theme-light {
      --iris-bg: rgba(255, 255, 255, 0.95);
      --iris-text: #000000;
      --iris-border: #cccccc;
      --iris-shadow: rgba(0, 0, 0, 0.1);
      --iris-input-bg: #f8f9fa;
      --iris-message-user-bg: #4285f4;
      --iris-message-ai-bg: #f1f3f4;
      --iris-accent: #1976d2;
    }
    
    #iris-chat-header {
      background: linear-gradient(135deg, var(--iris-accent), #667eea);
      color: white;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
      user-select: none;
    }
    
    .iris-header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
    
    .iris-logo {
      font-size: 18px;
      animation: iris-pulse 2s infinite;
    }
    
    @keyframes iris-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    .iris-header-buttons {
      display: flex;
      gap: 8px;
    }
    
    .iris-header-buttons button {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    
    .iris-header-buttons button:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    #iris-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      color: var(--iris-text);
    }
    
    .iris-message {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.4;
      word-wrap: break-word;
    }
    
    .iris-message-user {
      align-self: flex-end;
      background: var(--iris-message-user-bg);
      color: white;
    }
    
    .iris-message-model {
      align-self: flex-start;
      background: var(--iris-message-ai-bg);
      color: var(--iris-text);
    }
    
    .iris-message code {
      background: rgba(0, 0, 0, 0.1);
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
    }
    
    #iris-input-area {
      padding: 16px;
      border-top: 1px solid var(--iris-border);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .iris-model-selector {
      display: flex;
      gap: 8px;
    }
    
    .iris-model-selector select {
      background: var(--iris-input-bg);
      border: 1px solid var(--iris-border);
      border-radius: 6px;
      padding: 6px 8px;
      color: var(--iris-text);
      font-size: 12px;
      cursor: pointer;
    }
    
    .iris-input-container {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    
    #iris-chat-input {
      flex: 1;
      background: var(--iris-input-bg);
      border: 1px solid var(--iris-border);
      border-radius: 8px;
      padding: 10px 12px;
      color: var(--iris-text);
      resize: none;
      font-family: inherit;
      font-size: 14px;
    }
    
    #iris-chat-input:focus {
      outline: none;
      border-color: var(--iris-accent);
    }
    
    #iris-send-btn {
      background: var(--iris-accent);
      border: none;
      border-radius: 8px;
      padding: 10px 16px;
      color: white;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    
    #iris-send-btn:hover:not(:disabled) {
      opacity: 0.9;
    }
    
    #iris-send-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    #iris-status {
      font-size: 12px;
      padding: 6px 0;
      text-align: center;
    }
    
    .iris-status-loading { color: var(--iris-accent); }
    .iris-status-success { color: #4caf50; }
    .iris-status-error { color: #f44336; }
    
    .iris-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    }
    
    .iris-modal-content {
      background: var(--iris-bg);
      border-radius: 12px;
      width: 90%;
      max-width: 400px;
      color: var(--iris-text);
    }
    
    .iris-modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--iris-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .iris-modal-header h3 {
      margin: 0;
      font-size: 18px;
    }
    
    .iris-modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--iris-text);
    }
    
    .iris-modal-body {
      padding: 20px;
    }
    
    .iris-setting-group {
      margin-bottom: 16px;
    }
    
    .iris-setting-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
    }
    
    .iris-setting-group input,
    .iris-setting-group select {
      width: 100%;
      background: var(--iris-input-bg);
      border: 1px solid var(--iris-border);
      border-radius: 6px;
      padding: 8px 10px;
      color: var(--iris-text);
    }
    
    .iris-modal-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--iris-border);
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    
    .iris-btn-primary,
    .iris-btn-secondary {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
      border: none;
    }
    
    .iris-btn-primary {
      background: var(--iris-accent);
      color: white;
    }
    
    .iris-btn-secondary {
      background: transparent;
      color: var(--iris-text);
      border: 1px solid var(--iris-border);
    }
    
    .iris-hidden {
      display: none !important;
    }
    
    /* Scrollbar styling */
    #iris-chat-messages::-webkit-scrollbar {
      width: 6px;
    }
    
    #iris-chat-messages::-webkit-scrollbar-track {
      background: transparent;
    }
    
    #iris-chat-messages::-webkit-scrollbar-thumb {
      background: var(--iris-border);
      border-radius: 3px;
    }
  `;
  
  document.head.appendChild(style);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleIris') {
    toggleChat();
    sendResponse({ success: true });
  }
});

// Auto-initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

})();
