// Iris AI Assistant - Background Service Worker
console.log('🚀 Iris AI Assistant background service worker loaded');

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
    
    // Update tab state
    tabStates[tab.id] = tabStates[tab.id] || { isVisible: false };
    tabStates[tab.id].isVisible = !tabStates[tab.id].isVisible;
    
    console.log('✅ Toggle message sent to tab:', tab.id);
  } catch (error) {
    console.error('❌ Error toggling Iris:', error);
    
    // Handle common errors
    if (error.message.includes('Cannot access contents of url')) {
      // Chrome Web Store, Settings pages, etc.
      showNotification('Iris AI Assistant', 'Iris cannot be used on this page due to Chrome restrictions.');
    } else if (error.message.includes('No frame with URL')) {
      // Page not fully loaded
      showNotification('Iris AI Assistant', 'Please wait for the page to fully load before using Iris.');
    } else {
      // Other errors
      showNotification('Iris AI Assistant', 'An error occurred. Please try again or reload the page.');
    }
  }
});

// Listen for tab updates to reset state when navigating
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tabStates[tabId]) {
    // Reset tab state when navigating to a new page
    tabStates[tabId].isVisible = false;
  }
});

// Listen for tab removal to clean up state
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabStates[tabId]) {
    delete tabStates[tabId];
  }
});

// Show notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message
  });
}

// Update extension icon based on subscription tier
async function updateExtensionIcon() {
  try {
    // Get license info from storage
    const data = await chrome.storage.sync.get(['iris_license_key', 'iris_tier']);
    const tier = data.iris_tier || 'free';
    
    // Set icon based on tier
    if (tier === 'business') {
      // Business tier uses skull icon
      chrome.action.setIcon({
        path: {
          "16": "icons/skullicon16.png",
          "48": "icons/skullicon48.png",
          "128": "icons/skullicon128.png"
        }
      });
    } else {
      // Free and Pro tiers use regular icon
      chrome.action.setIcon({
        path: {
          "16": "icons/icon16.png",
          "48": "icons/icon48.png",
          "128": "icons/icon128.png"
        }
      });
    }
  } catch (error) {
    console.error('Error updating extension icon:', error);
  }
}

// Call when extension is loaded
chrome.runtime.onStartup.addListener(() => {
  updateExtensionIcon();
});

// Call when extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  updateExtensionIcon();
  
  if (details.reason === 'install') {
    // First installation
    console.log('🎉 Iris AI Assistant installed');
    
    // Open welcome page
    chrome.tabs.create({
      url: 'https://github.com/Revenant-Systems-LLC/Iris-AI-Assistant/blob/main/README.md'
    });
  } else if (details.reason === 'update') {
    // Extension updated
    console.log('🔄 Iris AI Assistant updated to version', chrome.runtime.getManifest().version);
    
    // Show update notification
    showNotification(
      'Iris AI Assistant Updated',
      `Updated to version ${chrome.runtime.getManifest().version}. Click for details.`
    );
  }
});

// Handle offline mode
chrome.storage.sync.get('iris_settings', (data) => {
  const settings = data.iris_settings || {};
  
  if (settings.offlineMode === 'auto' || settings.offlineMode === 'always') {
    // Listen for online/offline events
    self.addEventListener('online', () => {
      console.log('🌐 Browser is online');
      if (settings.notifications) {
        showNotification('Iris AI Assistant', 'You are back online. Full AI capabilities restored.');
      }
    });
    
    self.addEventListener('offline', () => {
      console.log('📴 Browser is offline');
      if (settings.notifications) {
        showNotification('Iris AI Assistant', 'You are offline. Iris will use cached responses.');
      }
    });
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open GitHub page when update notification is clicked
  chrome.tabs.create({
    url: 'https://github.com/Revenant-Systems-LLC/Iris-AI-Assistant/blob/main/README.md'
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateTier') {
    // Update tier in storage
    chrome.storage.sync.set({ 'iris_tier': message.tier });
    // Update icon
    updateExtensionIcon();
    sendResponse({ success: true });
  }
  
  if (message.action === 'getTabId') {
    // Send tab ID to content script
    sendResponse({ tabId: sender.tab.id });
  }
  
  // Always return true for async response
  return true;
});
