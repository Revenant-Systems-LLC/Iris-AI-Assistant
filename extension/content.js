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
    openai: ['gpt-4o', 'gpt-4o-mini'],
    // Keep NinjaTech models in code but they won't be used
    ninjatech: ['ninja-standard', 'ninja-advanced', 'ninja-expert']
  },
  INTENT_MAPPINGS: {
    creative: {
      gemini: 'gemini-1.5-pro',
      openai: 'gpt-4o',
      ninjatech: 'ninja-advanced', // This stays in code but won't be used
      temperature: 0.9
    },
    balanced: {
      gemini: 'gemini-1.5-flash',
      openai: 'gpt-4o-mini',
      ninjatech: 'ninja-standard', // This stays in code but won't be used
      temperature: 0.7
    },
    precise: {
      gemini: 'gemini-2.5-pro',
      openai: 'gpt-4o',
      ninjatech: 'ninja-expert', // This stays in code but won't be used
      temperature: 0.3
    }
  },
  // Change default provider to gemini instead of ninjatech
  DEFAULT_SETTINGS: {
    apiProvider: 'gemini', // Changed from 'ninjatech' to 'gemini'
    intent: 'balanced',
    // Rest of settings remain the same
    proxyUrl: 'auto',
    theme: 'system',
    fontSize: 'medium',
    position: 'right',
    width: 400,
    height: 600,
    contextLength: 10,
    privacyLevel: 'balanced',
    offlineMode: 'auto',
    quickActions: true,
    notifications: true,
    multiTabSync: true,
    debugMode: false
  },
  QUICK_ACTIONS: [
    {
      id: 'summarize',
      icon: '📝',
      label: 'Summarize',
      prompt: 'Summarize the key points of this page in a concise way.'
    },
    {
      id: 'explain',
      icon: '💡',
      label: 'Explain',
      prompt: 'Explain the main concepts on this page in simple terms.'
    },
    {
      id: 'find',
      icon: '🔍',
      label: 'Find',
      prompt: 'What are the most important facts or figures on this page?'
    },
    {
      id: 'translate',
      icon: '🌐',
      label: 'Translate',
      prompt: 'Translate the main content of this page to {language}.',
      requiresInput: true,
      inputPlaceholder: 'Enter language'
    },
    {
      id: 'code',
      icon: '💻',
      label: 'Code',
      prompt: 'Extract and explain any code examples from this page.'
    }
  ]
};

// State management
let state = {
  isVisible: false,
  isInitialized: false,
  isProcessing: false,
  settings: { ...CONFIG.DEFAULT_SETTINGS },
  conversation: [],
  contextWindow: [],
  currentPage: {
    url: '',
    title: '',
    content: '',
    metadata: {}
  },
  offlineCache: {},
  error: null,
  tabId: null,
  syncTimestamp: Date.now()
};

// DOM Elements
let irisContainer, irisChat, irisInput, irisSubmit, irisSettings, irisClose, irisToggle, irisQuickActions;

// Initialize the extension
async function initializeIris() {
  if (state.isInitialized) return;
  
  console.log('🌟 Initializing Iris AI Assistant');
  
  // Load settings from storage
  await loadSettings();
  
  // Create UI elements
  createUI();
  
  // Extract page context
  await extractPageContext();
  
  // Load conversation history
  await loadConversationHistory();
  
  // Initialize offline cache
  await initializeOfflineCache();
  
  // Set up multi-tab sync if enabled
  if (state.settings.multiTabSync) {
    initializeMultiTabSync();
  }
  
  // Register event listeners
  registerEventListeners();
  
  // Mark as initialized
  state.isInitialized = true;
  
  console.log('✅ Iris AI Assistant initialized successfully');
}

// Load user settings from Chrome storage
async function loadSettings() {
  try {
    const data = await chrome.storage.sync.get(CONFIG.STORAGE_KEYS.SETTINGS);
    state.settings = { ...CONFIG.DEFAULT_SETTINGS, ...(data[CONFIG.STORAGE_KEYS.SETTINGS] || {}) };
    console.log('📝 Settings loaded:', state.settings);
  } catch (error) {
    console.error('❌ Error loading settings:', error);
    state.settings = { ...CONFIG.DEFAULT_SETTINGS };
  }
}

// Save user settings to Chrome storage
async function saveSettings() {
  try {
    await chrome.storage.sync.set({ [CONFIG.STORAGE_KEYS.SETTINGS]: state.settings });
    console.log('💾 Settings saved successfully');
  } catch (error) {
    console.error('❌ Error saving settings:', error);
    showError('Failed to save settings. Please try again.');
  }
}

// Create the UI elements
function createUI() {
  // Create container
  irisContainer = document.createElement('div');
  irisContainer.id = 'iris-ai-assistant';
  irisContainer.className = `iris-container ${state.settings.theme === 'dark' || 
    (state.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 
    'iris-dark-theme' : 'iris-light-theme'}`;
  irisContainer.style.display = 'none';
  irisContainer.style.position = 'fixed';
  irisContainer.style.top = '20px';
  irisContainer.style[state.settings.position] = '20px';
  irisContainer.style.width = `${state.settings.width}px`;
  irisContainer.style.height = `${state.settings.height}px`;
  irisContainer.style.maxHeight = '80vh';
  irisContainer.style.zIndex = '9999999';
  irisContainer.style.borderRadius = '12px';
  irisContainer.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
  irisContainer.style.overflow = 'hidden';
  irisContainer.style.transition = 'all 0.3s ease';
  irisContainer.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'iris-header';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.padding = '12px 16px';
  header.style.borderBottom = '1px solid var(--iris-border-color, rgba(0, 0, 0, 0.1))';
  header.style.cursor = 'move';
  
  // Create logo and title
  const logoContainer = document.createElement('div');
  logoContainer.style.display = 'flex';
  logoContainer.style.alignItems = 'center';
  logoContainer.style.gap = '8px';
  
  const logo = document.createElement('div');
  logo.className = 'iris-logo';
  logo.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#6366F1" />
    <circle cx="12" cy="12" r="6" fill="#818CF8" />
    <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
  </svg>`;
  
  const title = document.createElement('div');
  title.className = 'iris-title';
  title.textContent = 'Iris AI';
  title.style.fontWeight = '600';
  title.style.fontSize = '16px';
  
  logoContainer.appendChild(logo);
  logoContainer.appendChild(title);
  
  // Create header buttons
  const headerButtons = document.createElement('div');
  headerButtons.style.display = 'flex';
  headerButtons.style.gap = '8px';
  
  irisSettings = document.createElement('button');
  irisSettings.className = 'iris-button iris-settings-button';
  irisSettings.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M13.5 8C13.5 8 12.5 11 8 11C3.5 11 2.5 8 2.5 8C2.5 8 3.5 5 8 5C12.5 5 13.5 8 13.5 8Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  irisSettings.title = 'Settings';
  irisSettings.style.background = 'none';
  irisSettings.style.border = 'none';
  irisSettings.style.cursor = 'pointer';
  irisSettings.style.padding = '4px';
  irisSettings.style.borderRadius = '4px';
  
  irisClose = document.createElement('button');
  irisClose.className = 'iris-button iris-close-button';
  irisClose.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  irisClose.title = 'Close';
  irisClose.style.background = 'none';
  irisClose.style.border = 'none';
  irisClose.style.cursor = 'pointer';
  irisClose.style.padding = '4px';
  irisClose.style.borderRadius = '4px';
  
  headerButtons.appendChild(irisSettings);
  headerButtons.appendChild(irisClose);
  
  header.appendChild(logoContainer);
  header.appendChild(headerButtons);
  
  // Create chat container
  irisChat = document.createElement('div');
  irisChat.className = 'iris-chat';
  irisChat.style.height = 'calc(100% - 120px)';
  irisChat.style.overflowY = 'auto';
  irisChat.style.padding = '16px';
  
  // Create quick actions
  irisQuickActions = document.createElement('div');
  irisQuickActions.className = 'iris-quick-actions';
  irisQuickActions.style.display = state.settings.quickActions ? 'flex' : 'none';
  irisQuickActions.style.gap = '8px';
  irisQuickActions.style.padding = '8px 16px';
  irisQuickActions.style.overflowX = 'auto';
  irisQuickActions.style.borderTop = '1px solid var(--iris-border-color, rgba(0, 0, 0, 0.1))';
  
  CONFIG.QUICK_ACTIONS.forEach(action => {
    const button = document.createElement('button');
    button.className = 'iris-quick-action';
    button.dataset.action = action.id;
    button.dataset.prompt = action.prompt;
    button.dataset.requiresInput = action.requiresInput || false;
    button.dataset.inputPlaceholder = action.inputPlaceholder || '';
    button.innerHTML = `${action.icon} <span>${action.label}</span>`;
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.gap = '4px';
    button.style.padding = '6px 12px';
    button.style.borderRadius = '16px';
    button.style.border = 'none';
    button.style.cursor = 'pointer';
    button.style.whiteSpace = 'nowrap';
    button.style.fontSize = '14px';
    button.style.fontWeight = '500';
    button.style.backgroundColor = 'var(--iris-button-bg, rgba(99, 102, 241, 0.1))';
    button.style.color = 'var(--iris-button-text, #6366F1)';
    
    irisQuickActions.appendChild(button);
  });
  
  // Create input container
  const inputContainer = document.createElement('div');
  inputContainer.className = 'iris-input-container';
  inputContainer.style.display = 'flex';
  inputContainer.style.alignItems = 'center';
  inputContainer.style.gap = '8px';
  inputContainer.style.padding = '12px 16px';
  inputContainer.style.borderTop = '1px solid var(--iris-border-color, rgba(0, 0, 0, 0.1))';
  
  irisInput = document.createElement('textarea');
  irisInput.className = 'iris-input';
  irisInput.placeholder = 'Ask Iris about this page...';
  irisInput.style.width = '100%';
  irisInput.style.padding = '8px 12px';
  irisInput.style.borderRadius = '8px';
  irisInput.style.border = '1px solid var(--iris-border-color, rgba(0, 0, 0, 0.1))';
  irisInput.style.resize = 'none';
  irisInput.style.minHeight = '40px';
  irisInput.style.maxHeight = '120px';
  irisInput.style.outline = 'none';
  irisInput.style.fontFamily = 'inherit';
  irisInput.style.fontSize = '14px';
  
  irisSubmit = document.createElement('button');
  irisSubmit.className = 'iris-submit';
  irisSubmit.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.3333 1.66667L9.16667 10.8333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M18.3333 1.66667L12.5 18.3333L9.16667 10.8333L1.66667 7.5L18.3333 1.66667Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  irisSubmit.style.background = 'var(--iris-primary-color, #6366F1)';
  irisSubmit.style.color = 'white';
  irisSubmit.style.border = 'none';
  irisSubmit.style.borderRadius = '8px';
  irisSubmit.style.width = '40px';
  irisSubmit.style.height = '40px';
  irisSubmit.style.display = 'flex';
  irisSubmit.style.alignItems = 'center';
  irisSubmit.style.justifyContent = 'center';
  irisSubmit.style.cursor = 'pointer';
  
  inputContainer.appendChild(irisInput);
  inputContainer.appendChild(irisSubmit);
  
  // Create toggle button (for mobile)
  irisToggle = document.createElement('button');
  irisToggle.id = 'iris-toggle';
  irisToggle.className = 'iris-toggle';
  irisToggle.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#6366F1" />
    <circle cx="12" cy="12" r="6" fill="#818CF8" />
    <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
  </svg>`;
  irisToggle.style.position = 'fixed';
  irisToggle.style.bottom = '20px';
  irisToggle.style.right = '20px';
  irisToggle.style.width = '48px';
  irisToggle.style.height = '48px';
  irisToggle.style.borderRadius = '50%';
  irisToggle.style.backgroundColor = 'white';
  irisToggle.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
  irisToggle.style.border = 'none';
  irisToggle.style.cursor = 'pointer';
  irisToggle.style.zIndex = '9999998';
  irisToggle.style.display = 'none';
  
  // Add elements to container
  irisContainer.appendChild(header);
  irisContainer.appendChild(irisChat);
  irisContainer.appendChild(irisQuickActions);
  irisContainer.appendChild(inputContainer);
  
  // Add container and toggle button to document
  document.body.appendChild(irisContainer);
  document.body.appendChild(irisToggle);
  
  // Add CSS variables
  const style = document.createElement('style');
  style.textContent = `
    .iris-light-theme {
      --iris-bg-color: #FFFFFF;
      --iris-text-color: #1F2937;
      --iris-border-color: rgba(0, 0, 0, 0.1);
      --iris-primary-color: #6366F1;
      --iris-secondary-color: #818CF8;
      --iris-button-bg: rgba(99, 102, 241, 0.1);
      --iris-button-text: #6366F1;
      --iris-message-bg: #F3F4F6;
      --iris-message-text: #1F2937;
      --iris-assistant-message-bg: #EEF2FF;
      --iris-assistant-message-text: #1F2937;
      
      color: var(--iris-text-color);
    }
    
    .iris-dark-theme {
      --iris-bg-color: #1F2937;
      --iris-text-color: #F9FAFB;
      --iris-border-color: rgba(255, 255, 255, 0.1);
      --iris-primary-color: #818CF8;
      --iris-secondary-color: #6366F1;
      --iris-button-bg: rgba(129, 140, 248, 0.2);
      --iris-button-text: #C7D2FE;
      --iris-message-bg: #374151;
      --iris-message-text: #F9FAFB;
      --iris-assistant-message-bg: #312E81;
      --iris-assistant-message-text: #F9FAFB;
      
      color: var(--iris-text-color);
    }
    
    .iris-button:hover {
      
    }
    
    .iris-quick-action:hover {
      filter: brightness(0.95);
    }
    
    .iris-submit:hover {
      filter: brightness(0.95);
    }
    
    .iris-message {
      margin-bottom: 12px;
      padding: 12px;
      border-radius: 8px;
      max-width: 85%;
      word-wrap: break-word;
    }
    
    .iris-user-message {
      
      color: var(--iris-message-text);
      align-self: flex-end;
      margin-left: auto;
    }
    
    .iris-assistant-message {
      
      color: var(--iris-assistant-message-text);
      align-self: flex-start;
    }
    
    .iris-message-container {
      display: flex;
      flex-direction: column;
    }
    
    .iris-error-message {
      
      color: #B91C1C;
      padding: 8px 12px;
      border-radius: 8px;
      margin: 8px 0;
      font-size: 14px;
    }
    
    @media (max-width: 768px) {
      #iris-ai-assistant {
        width: 90% !important;
        height: 70% !important;
        left: 5% !important;
        right: 5% !important;
        top: 15% !important;
      }
      
      #iris-toggle {
        display: flex !important;
        align-items: center;
        justify-content: center;
      }
    }
  `;
  
  document.head.appendChild(style);
  
  // Make the container draggable
  makeDraggable(irisContainer, header);
  
  // Make the container resizable
  makeResizable(irisContainer);
  
  // Add welcome message
  addMessage('assistant', 'Hello! I\'m Iris, your AI web assistant. How can I help you with this page?');
}

// Make an element draggable
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    
    // Check if position is set to 'right'
    if (state.settings.position === 'right') {
      element.style.right = (parseInt(element.style.right || '0') + pos1) + "px";
    } else {
      element.style.left = (element.offsetLeft - pos1) + "px";
    }
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Make an element resizable
function makeResizable(element) {
  const resizer = document.createElement('div');
  resizer.className = 'iris-resizer';
  resizer.style.position = 'absolute';
  resizer.style.width = '10px';
  resizer.style.height = '10px';
  resizer.style.right = '0';
  resizer.style.bottom = '0';
  resizer.style.cursor = 'nwse-resize';
  
  element.appendChild(resizer);
  
  let originalWidth = 0;
  let originalHeight = 0;
  let originalX = 0;
  let originalY = 0;
  
  resizer.addEventListener('mousedown', function(e) {
    e.preventDefault();
    originalWidth = parseFloat(getComputedStyle(element, null).getPropertyValue('width').replace('px', ''));
    originalHeight = parseFloat(getComputedStyle(element, null).getPropertyValue('height').replace('px', ''));
    originalX = e.pageX;
    originalY = e.pageY;
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResize);
  });
  
  function resize(e) {
    const width = originalWidth + (e.pageX - originalX);
    const height = originalHeight + (e.pageY - originalY);
    
    if (width > 300) {
      element.style.width = width + 'px';
      state.settings.width = width;
    }
    
    if (height > 200) {
      element.style.height = height + 'px';
      state.settings.height = height;
    }
  }
  
  function stopResize() {
    window.removeEventListener('mousemove', resize);
    saveSettings();
  }
}

// Register event listeners
function registerEventListeners() {
  // Close button
  irisClose.addEventListener('click', toggleIris);
  
  // Settings button
  irisSettings.addEventListener('click', openSettings);
  
  // Submit button
  irisSubmit.addEventListener('click', handleSubmit);
  
  // Input keypress (Enter to submit)
  irisInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });
  
  // Input auto-resize
  irisInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
  
  // Toggle button
  irisToggle.addEventListener('click', toggleIris);
  
  // Quick action buttons
  irisQuickActions.addEventListener('click', function(e) {
    const button = e.target.closest('.iris-quick-action');
    if (!button) return;
    
    const actionId = button.dataset.action;
    const prompt = button.dataset.prompt;
    const requiresInput = button.dataset.requiresInput === 'true';
    
    if (requiresInput) {
      const inputPlaceholder = button.dataset.inputPlaceholder;
      const userInput = prompt.includes('{language}') ? 
        window.prompt(`${inputPlaceholder}:`, 'English') : 
        window.prompt(`${inputPlaceholder}:`);
      
      if (userInput) {
        const finalPrompt = prompt.replace('{language}', userInput);
        handleQuickAction(actionId, finalPrompt);
      }
    } else {
      handleQuickAction(actionId, prompt);
    }
  });
  
  // Theme change listener
  if (state.settings.theme === 'system') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      updateTheme();
    });
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'toggleIris') {
      toggleIris();
    }
  });
}

// Handle quick action
async function handleQuickAction(actionId, prompt) {
  irisInput.value = prompt;
  handleSubmit();
}

// Handle form submission
async function handleSubmit() {
  const userInput = irisInput.value.trim();
  
  if (!userInput || state.isProcessing) return;
  
  // Add user message to chat
  addMessage('user', userInput);
  
  // Clear input
  irisInput.value = '';
  irisInput.style.height = 'auto';
  
  // Process the message
  await processUserMessage(userInput);
}

// Process user message and get AI response
async function processUserMessage(userInput) {
  try {
    state.isProcessing = true;
    
    // Add loading indicator
    const loadingId = addLoadingIndicator();
    
    // Update context window
    updateContextWindow(userInput);
    
    // Check if offline mode is active
    if (state.settings.offlineMode === 'always' || 
        (state.settings.offlineMode === 'auto' && !navigator.onLine)) {
      await handleOfflineMode(userInput, loadingId);
      return;
    }
    
    // Prepare request data
    const requestData = {
      provider: state.settings.apiProvider,
      model: CONFIG.INTENT_MAPPINGS[state.settings.intent][state.settings.apiProvider],
      temperature: CONFIG.INTENT_MAPPINGS[state.settings.intent].temperature,
      messages: state.contextWindow,
      pageContext: {
        url: state.currentPage.url,
        title: state.currentPage.title,
        content: state.currentPage.content,
        metadata: state.currentPage.metadata
      },
      privacyLevel: state.settings.privacyLevel
    };
    
    // Determine proxy URL
    let proxyUrl = state.settings.proxyUrl;
    if (proxyUrl === 'auto') {
      proxyUrl = CONFIG.PRODUCTION_PROXY_URL;
    } else if (proxyUrl === 'local') {
      proxyUrl = CONFIG.DEFAULT_PROXY_URL;
    }
    
    // Send request to proxy server
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    // Remove loading indicator
    removeLoadingIndicator(loadingId);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get response from AI');
    }
    
    const data = await response.json();
    
    // Add AI response to chat
    addMessage('assistant', data.content);
    
    // Update context window with AI response
    updateContextWindow(data.content, 'assistant');
    
    // Cache response for offline mode
    cacheResponse(userInput, data.content);
    
    // Sync conversation if multi-tab sync is enabled
    if (state.settings.multiTabSync) {
      syncConversation();
    }
    
  } catch (error) {
    console.error('❌ Error processing message:', error);
    showError(error.message || 'Failed to get response. Please try again.');
    
    // Remove loading indicator if it exists
    removeLoadingIndicator();
  } finally {
    state.isProcessing = false;
  }
}

// Extract context from the current page
async function extractPageContext() {
  try {
    console.log('🔍 Extracting page context');
    
    // Get basic page info
    state.currentPage.url = window.location.href;
    state.currentPage.title = document.title;
    
    // Extract metadata
    const metadata = {
      description: '',
      keywords: '',
      author: '',
      publishedDate: ''
    };
    
    // Get meta description
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) {
      metadata.description = descriptionMeta.getAttribute('content');
    }
    
    // Get meta keywords
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) {
      metadata.keywords = keywordsMeta.getAttribute('content');
    }
    
    // Get author
    const authorMeta = document.querySelector('meta[name="author"]');
    if (authorMeta) {
      metadata.author = authorMeta.getAttribute('content');
    }
    
    // Get published date
    const publishedDateMeta = document.querySelector('meta[property="article:published_time"]');
    if (publishedDateMeta) {
      metadata.publishedDate = publishedDateMeta.getAttribute('content');
    }
    
    state.currentPage.metadata = metadata;
    
    // Extract page content based on privacy level
    if (state.settings.privacyLevel === 'minimal') {
      // Minimal: Just title and URL
      state.currentPage.content = '';
    } else {
      // Balanced or Full: Extract content with different depth
      await extractPageContent(state.settings.privacyLevel === 'full');
    }
    
    console.log('✅ Page context extracted successfully');
  } catch (error) {
    console.error('❌ Error extracting page context:', error);
    state.currentPage.content = '';
  }
}

// Extract content from the page with smart context awareness
async function extractPageContent(fullExtraction = false) {
  // Define content extraction strategy
  const extractionStrategy = {
    // Important elements that likely contain main content
    primarySelectors: [
      'main',
      'article',
      '#content',
      '.content',
      '.main-content',
      '[role="main"]'
    ],
    // Secondary elements to check if primary not found
    secondarySelectors: [
      '.post',
      '.entry',
      '.blog-post',
      '#main',
      '.article'
    ],
    // Fallback to these common content containers
    fallbackSelectors: [
      '.container',
      '.wrapper',
      '#wrapper',
      '.page',
      'section'
    ],
    // Elements to prioritize within content
    priorityElements: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p',
      'table',
      'ul', 'ol',
      'blockquote',
      'pre', 'code'
    ],
    // Elements to ignore
    ignoreElements: [
      'nav',
      'header',
      'footer',
      'aside',
      '.sidebar',
      '.navigation',
      '.menu',
      '.ad',
      '.advertisement',
      '.banner',
      '.cookie',
      '.popup',
      '.modal',
      'script',
      'style',
      'noscript',
      'iframe'
    ]
  };
  
  // Function to get text content from elements
  function getTextFromElements(elements, maxLength = 10000) {
    let content = '';
    let length = 0;
    
    for (const element of elements) {
      // Skip if element is in ignore list
      if (Array.from(element.classList).some(cls => 
          extractionStrategy.ignoreElements.includes('.' + cls)) ||
          extractionStrategy.ignoreElements.includes(element.tagName.toLowerCase())) {
        continue;
      }
      
      // Get text content
      const text = element.textContent.trim();
      
      // Skip if empty
      if (!text) continue;
      
      // Add element text with appropriate formatting
      if (element.tagName.match(/^H[1-6]$/)) {
        content += `## ${text}\n\n`;
      } else if (element.tagName === 'P') {
        content += `${text}\n\n`;
      } else if (element.tagName === 'LI') {
        content += `- ${text}\n`;
      } else if (element.tagName === 'BLOCKQUOTE') {
        content += `> ${text}\n\n`;
      } else if (element.tagName === 'PRE' || element.tagName === 'CODE') {
        content += `\`\`\`\n${text}\n\`\`\`\n\n`;
      } else {
        content += `${text}\n\n`;
      }
      
      length += text.length;
      
      // Check if we've reached the max length
      if (length >= maxLength) {
        content += '... (content truncated due to length)';
        break;
      }
    }
    
    return content;
  }
  
  // Try to find main content container
  let contentContainer = null;
  let contentElements = [];
  
  // Try primary selectors
  for (const selector of extractionStrategy.primarySelectors) {
    contentContainer = document.querySelector(selector);
    if (contentContainer) break;
  }
  
  // Try secondary selectors if primary not found
  if (!contentContainer) {
    for (const selector of extractionStrategy.secondarySelectors) {
      contentContainer = document.querySelector(selector);
      if (contentContainer) break;
    }
  }
  
  // Try fallback selectors if still not found
  if (!contentContainer) {
    for (const selector of extractionStrategy.fallbackSelectors) {
      contentContainer = document.querySelector(selector);
      if (contentContainer) break;
    }
  }
  
  // If we found a container, extract priority elements from it
  if (contentContainer) {
    for (const selector of extractionStrategy.priorityElements) {
      const elements = contentContainer.querySelectorAll(selector);
      contentElements.push(...elements);
    }
  } else {
    // If no container found, extract priority elements from the whole document
    for (const selector of extractionStrategy.priorityElements) {
      const elements = document.querySelectorAll(selector);
      // Filter out elements that are likely in navigation, footer, etc.
      const filteredElements = Array.from(elements).filter(el => {
        const parents = getParents(el);
        return !parents.some(parent => 
          extractionStrategy.ignoreElements.includes(parent.tagName.toLowerCase()) ||
          Array.from(parent.classList).some(cls => 
            extractionStrategy.ignoreElements.includes('.' + cls))
        );
      });
      contentElements.push(...filteredElements);
    }
  }
  
  // Helper function to get all parents of an element
  function getParents(element) {
    const parents = [];
    let currentElement = element.parentElement;
    
    while (currentElement) {
      parents.push(currentElement);
      currentElement = currentElement.parentElement;
    }
    
    return parents;
  }
  
  // Extract text content with different max length based on privacy level
  const maxLength = fullExtraction ? 20000 : 10000;
  state.currentPage.content = getTextFromElements(contentElements, maxLength);
  
  // If content is still empty or very short, try a simpler approach
  if (state.currentPage.content.length < 100) {
    // Get all visible text from the page
    const bodyText = document.body.innerText;
    state.currentPage.content = bodyText.substring(0, maxLength);
    
    if (state.currentPage.content.length >= maxLength) {
      state.currentPage.content += '... (content truncated due to length)';
    }
  }
}

// Update context window with new message
function updateContextWindow(content, role = 'user') {
  // Add message to context window
  state.contextWindow.push({
    role,
    content
  });
  
  // Keep context window within limit
  const contextLength = state.settings.contextLength || 10;
  if (state.contextWindow.length > contextLength * 2) { // Keep pairs of messages
    state.contextWindow = state.contextWindow.slice(-contextLength * 2);
  }
  
  // Add to conversation history
  state.conversation.push({
    role,
    content,
    timestamp: Date.now()
  });
  
  // Save conversation history
  saveConversationHistory();
}

// Load conversation history from storage
async function loadConversationHistory() {
  try {
    const data = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.CONVERSATION_HISTORY);
    const history = data[CONFIG.STORAGE_KEYS.CONVERSATION_HISTORY] || [];
    
    // Filter history for current URL if not using multi-tab sync
    if (!state.settings.multiTabSync) {
      state.conversation = history.filter(msg => msg.url === state.currentPage.url) || [];
    } else {
      state.conversation = history || [];
    }
    
    // Rebuild context window from conversation
    rebuildContextWindow();
    
    console.log('📚 Conversation history loaded:', state.conversation.length, 'messages');
  } catch (error) {
    console.error('❌ Error loading conversation history:', error);
    state.conversation = [];
  }
}

// Save conversation history to storage
async function saveConversationHistory() {
  try {
    await chrome.storage.local.set({ 
      [CONFIG.STORAGE_KEYS.CONVERSATION_HISTORY]: state.conversation 
    });
    console.log('💾 Conversation history saved');
  } catch (error) {
    console.error('❌ Error saving conversation history:', error);
  }
}

// Rebuild context window from conversation history
function rebuildContextWindow() {
  // Clear context window
  state.contextWindow = [];
  
  // Get the most recent messages up to the context length
  const contextLength = state.settings.contextLength || 10;
  const recentMessages = state.conversation.slice(-contextLength * 2); // Keep pairs of messages
  
  // Add messages to context window
  for (const message of recentMessages) {
    state.contextWindow.push({
      role: message.role,
      content: message.content
    });
  }
}

// Initialize offline cache
async function initializeOfflineCache() {
  if (state.settings.offlineMode === 'never') return;
  
  try {
    const data = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.OFFLINE_CACHE);
    state.offlineCache = data[CONFIG.STORAGE_KEYS.OFFLINE_CACHE] || {};
    console.log('📦 Offline cache initialized');
  } catch (error) {
    console.error('❌ Error initializing offline cache:', error);
    state.offlineCache = {};
  }
}

// Cache response for offline mode
async function cacheResponse(query, response) {
  if (state.settings.offlineMode === 'never') return;
  
  try {
    // Normalize query by removing extra spaces and converting to lowercase
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Add to cache
    state.offlineCache[normalizedQuery] = {
      response,
      timestamp: Date.now()
    };
    
    // Limit cache size (keep most recent 100 items)
    const keys = Object.keys(state.offlineCache);
    if (keys.length > 100) {
      // Sort by timestamp
      keys.sort((a, b) => state.offlineCache[a].timestamp - state.offlineCache[b].timestamp);
      
      // Remove oldest items
      for (let i = 0; i < keys.length - 100; i++) {
        delete state.offlineCache[keys[i]];
      }
    }
    
    // Save to storage
    await chrome.storage.local.set({ 
      [CONFIG.STORAGE_KEYS.OFFLINE_CACHE]: state.offlineCache 
    });
    
    console.log('📦 Response cached for offline use');
  } catch (error) {
    console.error('❌ Error caching response:', error);
  }
}

// Handle offline mode
async function handleOfflineMode(query, loadingId) {
  console.log('🔌 Operating in offline mode');
  
  // Normalize query
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Find best match in cache
  let bestMatch = null;
  let highestScore = 0;
  
  for (const cachedQuery in state.offlineCache) {
    const score = calculateSimilarity(normalizedQuery, cachedQuery);
    
    if (score > highestScore && score > 0.7) { // Threshold for similarity
      highestScore = score;
      bestMatch = cachedQuery;
    }
  }
  
  // Remove loading indicator
  removeLoadingIndicator(loadingId);
  
  // If match found, use cached response
  if (bestMatch) {
    const cachedResponse = state.offlineCache[bestMatch].response;
    
    addMessage('assistant', `(Offline) ${cachedResponse}`);
    
    // Update context window with AI response
    updateContextWindow(`(Offline) ${cachedResponse}`, 'assistant');
  } else {
    // No match found
    addMessage('assistant', '(Offline) I don\'t have a cached response for this query. Please try again when you\'re back online.');
    
    // Update context window with AI response
    updateContextWindow('(Offline) I don\'t have a cached response for this query. Please try again when you\'re back online.', 'assistant');
  }
}

// Calculate similarity between two strings (simple implementation)
function calculateSimilarity(str1, str2) {
  // Convert strings to sets of words
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  // Find intersection
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  
  // Calculate Jaccard similarity
  return intersection.size / (words1.size + words2.size - intersection.size);
}

// Initialize multi-tab sync
function initializeMultiTabSync() {
  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[CONFIG.STORAGE_KEYS.CONTEXT_SYNC]) {
      const newValue = changes[CONFIG.STORAGE_KEYS.CONTEXT_SYNC].newValue;
      
      // Only update if the change was from another tab and is newer
      if (newValue && newValue.timestamp > state.syncTimestamp) {
        console.log('🔄 Syncing conversation from another tab');
        
        // Update conversation and context window
        state.conversation = newValue.conversation || [];
        rebuildContextWindow();
        
        // Refresh chat UI
        refreshChatUI();
      }
    }
  });
}

// Sync conversation to other tabs
async function syncConversation() {
  try {
    // Update timestamp
    state.syncTimestamp = Date.now();
    
    // Save to sync storage
    await chrome.storage.sync.set({
      [CONFIG.STORAGE_KEYS.CONTEXT_SYNC]: {
        conversation: state.conversation,
        timestamp: state.syncTimestamp
      }
    });
    
    console.log('🔄 Conversation synced to other tabs');
  } catch (error) {
    console.error('❌ Error syncing conversation:', error);
  }
}

// Refresh chat UI with current conversation
function refreshChatUI() {
  // Clear chat
  irisChat.innerHTML = '';
  
  // Add messages from conversation
  for (const message of state.conversation) {
    addMessage(message.role, message.content, false);
  }
  
  // Scroll to bottom
  irisChat.scrollTop = irisChat.scrollHeight;
}

// Add message to chat
function addMessage(role, content, saveToHistory = true) {
  const messageContainer = document.createElement('div');
  messageContainer.className = 'iris-message-container';
  
  const message = document.createElement('div');
  message.className = `iris-message iris-${role}-message`;
  
  // Convert markdown to HTML
  const formattedContent = formatMarkdown(content);
  
  message.innerHTML = formattedContent;
  
  messageContainer.appendChild(message);
  irisChat.appendChild(messageContainer);
  
  // Scroll to bottom
  irisChat.scrollTop = irisChat.scrollHeight;
  
  // Save to history if needed
  if (saveToHistory) {
    state.conversation.push({
      role,
      content,
      timestamp: Date.now(),
      url: state.currentPage.url
    });
    
    saveConversationHistory();
  }
}

// Format markdown to HTML
function formatMarkdown(text) {
  // Replace code blocks
  text = text.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
  
  // Replace inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Replace bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Replace italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Replace headers
  text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Replace links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Replace lists
  text = text.replace(/^\s*[\-\*]\s+(.*)/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Replace numbered lists
  text = text.replace(/^\s*\d+\.\s+(.*)/gm, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
  
  // Replace paragraphs
  text = text.replace(/^(?!<[hou]).+/gm, '<p>$&</p>');
  
  // Replace newlines
  text = text.replace(/\n/g, '');
  
  return text;
}

// Add loading indicator
function addLoadingIndicator() {
  const loadingId = 'iris-loading-' + Date.now();
  
  const messageContainer = document.createElement('div');
  messageContainer.className = 'iris-message-container';
  messageContainer.id = loadingId;
  
  const message = document.createElement('div');
  message.className = 'iris-message iris-assistant-message';
  
  const dots = document.createElement('div');
  dots.className = 'iris-loading-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';
  
  message.appendChild(dots);
  messageContainer.appendChild(message);
  irisChat.appendChild(messageContainer);
  
  // Add CSS for loading dots
  const style = document.createElement('style');
  style.textContent = `
    .iris-loading-dots {
      display: flex;
      gap: 4px;
    }
    
    .iris-loading-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      
      opacity: 0.6;
      animation: iris-loading-dots 1.4s infinite ease-in-out both;
    }
    
    .iris-loading-dots span:nth-child(1) {
      animation-delay: -0.32s;
    }
    
    .iris-loading-dots span:nth-child(2) {
      animation-delay: -0.16s;
    }
    
    @keyframes iris-loading-dots {
      0%, 80%, 100% {
        transform: scale(0);
      }
      40% {
        transform: scale(1);
      }
    }
  `;
  
  document.head.appendChild(style);
  
  // Scroll to bottom
  irisChat.scrollTop = irisChat.scrollHeight;
  
  return loadingId;
}

// Remove loading indicator
function removeLoadingIndicator(loadingId) {
  if (loadingId) {
    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) {
      loadingElement.remove();
    }
  } else {
    // If no ID provided, remove all loading indicators
    const loadingElements = document.querySelectorAll('[id^="iris-loading-"]');
    loadingElements.forEach(el => el.remove());
  }
}

// Show error message
function showError(message) {
  const errorElement = document.createElement('div');
  errorElement.className = 'iris-error-message';
  errorElement.textContent = message;
  
  irisChat.appendChild(errorElement);
  
  // Scroll to bottom
  irisChat.scrollTop = irisChat.scrollHeight;
  
  // Remove after 5 seconds
  setTimeout(() => {
    errorElement.remove();
  }, 5000);
}

// Open settings panel
function openSettings() {
  // Create settings panel if it doesn't exist
  if (!document.getElementById('iris-settings-panel')) {
    createSettingsPanel();
  }
  
  // Show settings panel
  const settingsPanel = document.getElementById('iris-settings-panel');
  settingsPanel.style.display = 'block';
}

// Create settings panel
function createSettingsPanel() {
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'iris-settings-panel';
  settingsPanel.className = `iris-settings-panel ${state.settings.theme === 'dark' || 
    (state.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 
    'iris-dark-theme' : 'iris-light-theme'}`;
  settingsPanel.style.position = 'absolute';
  settingsPanel.style.top = '0';
  settingsPanel.style.left = '0';
  settingsPanel.style.width = '100%';
  settingsPanel.style.height = '100%';
  settingsPanel.style.backgroundColor = 'var(--iris-bg-color)';
  settingsPanel.style.zIndex = '10';
  settingsPanel.style.padding = '16px';
  settingsPanel.style.overflowY = 'auto';
  settingsPanel.style.display = 'none';
  
  // Create settings header
  const settingsHeader = document.createElement('div');
  settingsHeader.className = 'iris-settings-header';
  settingsHeader.style.display = 'flex';
  settingsHeader.style.justifyContent = 'space-between';
  settingsHeader.style.alignItems = 'center';
  settingsHeader.style.marginBottom = '16px';
  
  const settingsTitle = document.createElement('h2');
  settingsTitle.textContent = 'Settings';
  settingsTitle.style.margin = '0';
  settingsTitle.style.fontSize = '18px';
  settingsTitle.style.fontWeight = '600';
  
  const closeSettings = document.createElement('button');
  closeSettings.className = 'iris-button';
  closeSettings.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  closeSettings.style.background = 'none';
  closeSettings.style.border = 'none';
  closeSettings.style.cursor = 'pointer';
  closeSettings.style.padding = '4px';
  closeSettings.style.borderRadius = '4px';
  
  settingsHeader.appendChild(settingsTitle);
  settingsHeader.appendChild(closeSettings);
  
  // Create settings form
  const settingsForm = document.createElement('div');
  settingsForm.className = 'iris-settings-form';
  
  // Create settings sections
  const sections = [
    {
      title: 'General',
      settings: [
        {
          type: 'select',
          id: 'theme',
          label: 'Theme',
          options: [
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' }
          ],
          value: state.settings.theme
        },
        {
          type: 'select',
          id: 'position',
          label: 'Position',
          options: [
            { value: 'left', label: 'Left' },
            { value: 'right', label: 'Right' }
          ],
          value: state.settings.position
        },
        {
          type: 'select',
          id: 'fontSize',
          label: 'Font Size',
          options: [
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' }
          ],
          value: state.settings.fontSize
        },
        {
          type: 'checkbox',
          id: 'quickActions',
          label: 'Show Quick Actions',
          value: state.settings.quickActions
        }
      ]
    },
    {
      title: 'AI Settings',
      settings: [
        {
          type: 'select',
          id: 'apiProvider',
          label: 'AI Provider',
          options: [
            { value: 'gemini', label: 'Google Gemini' },
            { value: 'openai', label: 'OpenAI' }
          ],
          value: state.settings.apiProvider
        },
        {
          type: 'select',
          id: 'intent',
          label: 'Response Style',
          options: [
            { value: 'creative', label: 'Creative' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'precise', label: 'Precise' }
          ],
          value: state.settings.intent
        },
        {
          type: 'select',
          id: 'contextLength',
          label: 'Context Length',
          options: [
            { value: '5', label: '5 messages' },
            { value: '10', label: '10 messages' },
            { value: '20', label: '20 messages' }
          ],
          value: state.settings.contextLength.toString()
        }
      ]
    },
    {
      title: 'Privacy & Data',
      settings: [
        {
          type: 'select',
          id: 'privacyLevel',
          label: 'Privacy Level',
          options: [
            { value: 'minimal', label: 'Minimal (URL & Title only)' },
            { value: 'balanced', label: 'Balanced (Main content)' },
            { value: 'full', label: 'Full (All visible content)' }
          ],
          value: state.settings.privacyLevel
        },
        {
          type: 'select',
          id: 'offlineMode',
          label: 'Offline Mode',
          options: [
            { value: 'auto', label: 'Auto (When offline)' },
            { value: 'always', label: 'Always' },
            { value: 'never', label: 'Never' }
          ],
          value: state.settings.offlineMode
        },
        {
          type: 'checkbox',
          id: 'multiTabSync',
          label: 'Sync Across Tabs',
          value: state.settings.multiTabSync
        }
      ]
    },
    {
      title: 'Advanced',
      settings: [
        {
          type: 'select',
          id: 'proxyUrl',
          label: 'Proxy Server',
          options: [
            { value: 'auto', label: 'Production (Railway)' },
            { value: 'local', label: 'Local (localhost:3000)' },
            { value: 'custom', label: 'Custom URL' }
          ],
          value: state.settings.proxyUrl
        },
        {
          type: 'text',
          id: 'customProxyUrl',
          label: 'Custom Proxy URL',
          value: state.settings.proxyUrl !== 'auto' && state.settings.proxyUrl !== 'local' ? state.settings.proxyUrl : '',
          condition: 'proxyUrl',
          conditionValue: 'custom'
        },
        {
          type: 'checkbox',
          id: 'debugMode',
          label: 'Debug Mode',
          value: state.settings.debugMode
        }
      ]
    }
  ];
  
  // Create settings sections
  sections.forEach(section => {
    const sectionElement = document.createElement('div');
    sectionElement.className = 'iris-settings-section';
    sectionElement.style.marginBottom = '24px';
    
    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = section.title;
    sectionTitle.style.fontSize = '16px';
    sectionTitle.style.fontWeight = '600';
    sectionTitle.style.marginBottom = '12px';
    
    sectionElement.appendChild(sectionTitle);
    
    // Create settings
    section.settings.forEach(setting => {
      const settingContainer = document.createElement('div');
      settingContainer.className = 'iris-setting';
      settingContainer.style.marginBottom = '16px';
      
      if (setting.condition) {
        settingContainer.dataset.condition = setting.condition;
        settingContainer.dataset.conditionValue = setting.conditionValue;
        
        // Hide if condition not met
        if (state.settings[setting.condition] !== setting.conditionValue) {
          settingContainer.style.display = 'none';
        }
      }
      
      const label = document.createElement('label');
      label.textContent = setting.label;
      label.htmlFor = `iris-setting-${setting.id}`;
      label.style.display = 'block';
      label.style.marginBottom = '4px';
      label.style.fontSize = '14px';
      
      settingContainer.appendChild(label);
      
      let input;
      
      switch (setting.type) {
        case 'select':
          input = document.createElement('select');
          input.id = `iris-setting-${setting.id}`;
          input.className = 'iris-select';
          input.style.width = '100%';
          input.style.padding = '8px';
          input.style.borderRadius = '4px';
          input.style.border = '1px solid var(--iris-border-color)';
          input.style.backgroundColor = 'var(--iris-bg-color)';
          input.style.color = 'var(--iris-text-color)';
          
          setting.options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            optionElement.selected = option.value === setting.value;
            input.appendChild(optionElement);
          });
          
          input.addEventListener('change', function() {
            state.settings[setting.id] = this.value;
            
            // Handle conditional settings
            document.querySelectorAll(`[data-condition="${setting.id}"]`).forEach(el => {
              if (el.dataset.conditionValue === this.value) {
                el.style.display = 'block';
              } else {
                el.style.display = 'none';
              }
            });
            
            // Special handling for certain settings
            if (setting.id === 'theme') {
              updateTheme();
            } else if (setting.id === 'position') {
              updatePosition();
            } else if (setting.id === 'fontSize') {
              updateFontSize();
            } else if (setting.id === 'quickActions') {
              irisQuickActions.style.display = this.value ? 'flex' : 'none';
            }
            
            saveSettings();
          });
          break;
          
        case 'checkbox':
          const checkboxContainer = document.createElement('div');
          checkboxContainer.style.display = 'flex';
          checkboxContainer.style.alignItems = 'center';
          
          input = document.createElement('input');
          input.type = 'checkbox';
          input.id = `iris-setting-${setting.id}`;
          input.className = 'iris-checkbox';
          input.checked = setting.value;
          input.style.marginRight = '8px';
          
          const checkboxLabel = document.createElement('span');
          checkboxLabel.textContent = setting.label;
          
          checkboxContainer.appendChild(input);
          checkboxContainer.appendChild(checkboxLabel);
          
          // Replace the label with the checkbox container
          settingContainer.removeChild(label);
          settingContainer.appendChild(checkboxContainer);
          
          input.addEventListener('change', function() {
            state.settings[setting.id] = this.checked;
            
            // Special handling for certain settings
            if (setting.id === 'quickActions') {
              irisQuickActions.style.display = this.checked ? 'flex' : 'none';
            } else if (setting.id === 'multiTabSync') {
              if (this.checked) {
                initializeMultiTabSync();
              }
            }
            
            saveSettings();
          });
          break;
          
        case 'text':
          input = document.createElement('input');
          input.type = 'text';
          input.id = `iris-setting-${setting.id}`;
          input.className = 'iris-text-input';
          input.value = setting.value;
          input.style.width = '100%';
          input.style.padding = '8px';
          input.style.borderRadius = '4px';
          input.style.border = '1px solid var(--iris-border-color)';
          input.style.backgroundColor = 'var(--iris-bg-color)';
          input.style.color = 'var(--iris-text-color)';
          
          input.addEventListener('change', function() {
            if (setting.id === 'customProxyUrl') {
              state.settings.proxyUrl = this.value;
            } else {
              state.settings[setting.id] = this.value;
            }
            
            saveSettings();
          });
          break;
      }
      
      if (input && setting.type !== 'checkbox') {
        settingContainer.appendChild(input);
      }
      
      sectionElement.appendChild(settingContainer);
    });
    
    settingsForm.appendChild(sectionElement);
  });
  
  // Create actions section
  const actionsSection = document.createElement('div');
  actionsSection.className = 'iris-settings-actions';
  actionsSection.style.marginTop = '24px';
  actionsSection.style.display = 'flex';
  actionsSection.style.gap = '8px';
  
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset to Defaults';
  resetButton.className = 'iris-button';
  resetButton.style.padding = '8px 16px';
  resetButton.style.borderRadius = '4px';
  resetButton.style.border = '1px solid var(--iris-border-color)';
  resetButton.style.backgroundColor = 'transparent';
  resetButton.style.color = 'var(--iris-text-color)';
  resetButton.style.cursor = 'pointer';
  
  const clearHistoryButton = document.createElement('button');
  clearHistoryButton.textContent = 'Clear History';
  clearHistoryButton.className = 'iris-button';
  clearHistoryButton.style.padding = '8px 16px';
  clearHistoryButton.style.borderRadius = '4px';
  clearHistoryButton.style.border = '1px solid var(--iris-border-color)';
  clearHistoryButton.style.backgroundColor = 'transparent';
  clearHistoryButton.style.color = 'var(--iris-text-color)';
  clearHistoryButton.style.cursor = 'pointer';
  
  actionsSection.appendChild(resetButton);
  actionsSection.appendChild(clearHistoryButton);
  
  // Add event listeners
  resetButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      state.settings = { ...CONFIG.DEFAULT_SETTINGS };
      saveSettings();
      settingsPanel.remove();
      createSettingsPanel();
      updateTheme();
      updatePosition();
      updateFontSize();
      irisQuickActions.style.display = state.settings.quickActions ? 'flex' : 'none';
    }
  });
  
  clearHistoryButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all conversation history?')) {
      state.conversation = [];
      state.contextWindow = [];
      saveConversationHistory();
      refreshChatUI();
      addMessage('assistant', 'Conversation history has been cleared.');
    }
  });
  
  closeSettings.addEventListener('click', function() {
    settingsPanel.style.display = 'none';
  });
  
  // Add elements to panel
  settingsPanel.appendChild(settingsHeader);
  settingsPanel.appendChild(settingsForm);
  settingsPanel.appendChild(actionsSection);
  
  // Add panel to container
  irisContainer.appendChild(settingsPanel);
}

// Update theme
function updateTheme() {
  const isDark = state.settings.theme === 'dark' || 
    (state.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  irisContainer.className = `iris-container ${isDark ? 'iris-dark-theme' : 'iris-light-theme'}`;
  
  const settingsPanel = document.getElementById('iris-settings-panel');
  if (settingsPanel) {
    settingsPanel.className = `iris-settings-panel ${isDark ? 'iris-dark-theme' : 'iris-light-theme'}`;
  }
}

// Update position
function updatePosition() {
  if (state.settings.position === 'left') {
    irisContainer.style.left = '20px';
    irisContainer.style.right = 'auto';
  } else {
    irisContainer.style.right = '20px';
    irisContainer.style.left = 'auto';
  }
}

// Update font size
function updateFontSize() {
  let fontSize;
  
  switch (state.settings.fontSize) {
    case 'small':
      fontSize = '12px';
      break;
    case 'medium':
      fontSize = '14px';
      break;
    case 'large':
      fontSize = '16px';
      break;
    default:
      fontSize = '14px';
  }
  
  irisContainer.style.fontSize = fontSize;
}

// Toggle Iris visibility
function toggleIris() {
  if (!state.isInitialized) {
    initializeIris();
  }
  
  state.isVisible = !state.isVisible;
  irisContainer.style.display = state.isVisible ? 'block' : 'none';
  
  // Update theme in case system preference changed
  if (state.isVisible && state.settings.theme === 'system') {
    updateTheme();
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleIris') {
    toggleIris();
    sendResponse({ success: true });
  }
});

// Initialize on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize immediately, wait for user action
    console.log('🌟 Iris AI Assistant ready');
  });
} else {
  // Don't initialize immediately, wait for user action
  console.log('🌟 Iris AI Assistant ready');
}

})();
