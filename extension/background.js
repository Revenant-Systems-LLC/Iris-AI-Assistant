// Iris AI Assistant - Background Service Worker
console.log('🚀 Iris AI Assistant background service worker loaded');

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
      iris_proxy_url: 'http://localhost:3000/generate-content',
      iris_temperature: 0.7,
      iris_theme: 'dark',
      iris_llm: 'gemini',
      iris_model: 'gemini-1.5-flash'
    });
    
  } else if (details.reason === 'update') {
    console.log('🔄 Iris AI Assistant updated to version:', chrome.runtime.getManifest().version);
  }
});

// Handle storage changes for settings sync
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    console.log('⚙️ Settings updated:', changes);
  }
});
