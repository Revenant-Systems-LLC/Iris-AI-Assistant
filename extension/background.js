// Iris AI Assistant - Background Service Worker
console.log('🚀 Iris AI Assistant background service worker loaded');

// Configuration
const VERIFICATION_URL = 'http://localhost:4000/verify-license'; // In production, change to your deployed sub server URL

// Global state
let tabStates = {};

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('📌 Extension icon clicked for tab:', tab.id);
    
    // Inject the content script if not already present
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    
    // Send toggle message to content script
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleIris' });
    
    // Track tab state
    tabStates[tab.id] = tabStates[tab.id] || { active: true };
    tabStates[tab.id].active = !tabStates[tab.id].active;
    
  } catch (error) {
    console.error('❌ Error toggling Iris:', error);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Iris Error',
      message: 'Could not activate Iris on this page. Try refreshing and clicking again.'
    });
  }
});

// Handle installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🎉 Iris AI Assistant installed successfully');
    
    // Set default settings
    chrome.storage.sync.set({
      iris_proxy_url: 'https://iris-proxy-production.up.railway.app/generate-content',
      iris_license_key: null,
      iris_license_tier: 'free',
      iris_license_last_check: 0,
      iris_intent: 'balanced',
      iris_theme: 'dark',
      iris_llm: 'gemini',
      iris_model: 'gemini-1.5-flash',
      iris_privacy_level: 'standard',
      iris_daily_query_count: 0,
      iris_last_query_reset: Date.now()
    });
    
    // Show welcome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Welcome to Iris AI Assistant',
      message: 'Click the Iris icon on any webpage to start a conversation with AI.'
    });
    
    // Open onboarding page
    chrome.tabs.create({
      url: 'https://github.com/Revenant-Systems-LLC/Iris-AI-Assistant'
    });
    
  } else if (details.reason === 'update') {
    console.log('🔄 Iris AI Assistant updated to version:', chrome.runtime.getManifest().version);
    
    // Show update notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Iris AI Assistant Updated',
      message: `Updated to version ${chrome.runtime.getManifest().version} with new features and improvements.`
    });
  }

  // Set up a recurring alarm to verify the license daily
  chrome.alarms.get('licenseCheck', alarm => {
    if (!alarm) {
      chrome.alarms.create('licenseCheck', { periodInMinutes: 1440 }); // 1440 minutes = 24 hours
    }
  });
});

// Handle tab removal to clean up state
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStates[tabId]) {
    delete tabStates[tabId];
  }
});

// Handle storage changes for settings sync
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    // If the license key changes, re-verify it immediately.
    if (changes.iris_license_key) {
      verifyLicense(changes.iris_license_key.newValue);
    }
    if (changes.iris_license_tier) {
      updateExtensionIcon(changes.iris_license_tier.newValue);
    }
    console.log('⚙️ Settings updated:', changes);
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle multi-tab sync
  if (request.action === 'syncChatHistory') {
    // Broadcast to all tabs except sender
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id !== sender.tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateChatHistory',
            chatHistory: request.chatHistory
          }).catch(() => {
            // Ignore errors for tabs where content script isn't loaded
          });
        }
      });
    });
    sendResponse({ success: true });
    return true; // Keep message channel open for async response
  }
  
  // Handle offline queue
  if (request.action === 'addToOfflineQueue') {
    // Store in tab state
    if (!tabStates[sender.tab.id]) {
      tabStates[sender.tab.id] = {};
    }
    
    if (!tabStates[sender.tab.id].offlineQueue) {
      tabStates[sender.tab.id].offlineQueue = [];
    }
    
    tabStates[sender.tab.id].offlineQueue.push(request.message);
    sendResponse({ success: true });
    return true;
  }
  
  // Handle getting offline queue
  if (request.action === 'getOfflineQueue') {
    const queue = tabStates[sender.tab.id]?.offlineQueue || [];
    // Clear queue after sending
    if (tabStates[sender.tab.id]?.offlineQueue) {
      tabStates[sender.tab.id].offlineQueue = [];
    }
    sendResponse({ queue });
    return true;
  }
});

// Listen for network status changes
self.addEventListener('online', () => {
  console.log('🌐 Browser is online');
  
  // Notify all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'networkStatusChange', isOnline: true })
        .catch(() => {
          // Ignore errors for tabs where content script isn't loaded
        });
    });
  });
});

self.addEventListener('offline', () => {
  console.log('📴 Browser is offline');
  
  // Notify all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'networkStatusChange', isOnline: false })
        .catch(() => {
          // Ignore errors for tabs where content script isn't loaded
        });
    });
  });
});

/**
 * Verifies the license key with the subscription server.
 * @param {string} licenseKey - The license key to verify.
 */
async function verifyLicense(licenseKey) {
  if (!licenseKey) {
    await chrome.storage.sync.set({ iris_license_tier: 'free' });
    updateExtensionIcon('free');
    return;
  }

  try {
    const response = await fetch(VERIFICATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey })
    });

    const data = await response.json();
    const tier = data.valid ? data.tier : 'free';

    await chrome.storage.sync.set({
      iris_license_tier: tier,
      iris_license_last_check: Date.now()
    });
    updateExtensionIcon(tier);
    console.log(`🔑 License verified. Tier: ${tier}`);

  } catch (error) {
    console.error('❌ License verification failed:', error);
    // If verification fails, default to free but don't remove the key.
    // This allows for offline grace periods.
  }
}

/**
 * Updates the extension icon based on the user's subscription tier.
 * @param {string} tier - The user's current tier ('free', 'pro', 'revenant').
 */
function updateExtensionIcon(tier) {
  const iconPath = tier === 'revenant' ? 'icons/skullicon' : 'icons/icon';
  chrome.action.setIcon({
    path: {
      "16": `${iconPath}16.png`,
      "48": `${iconPath}48.png`,
      "128": `${iconPath}128.png`
    }
  });
}

// Listener for the daily license check alarm.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'licenseCheck') {
    const { iris_license_key } = await chrome.storage.sync.get('iris_license_key');
    if (iris_license_key) {
      verifyLicense(iris_license_key);
    }
  }
});
