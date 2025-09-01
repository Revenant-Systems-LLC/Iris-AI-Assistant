// ==UserScript==
// @name         Iris - Gemini Web Viewer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  A conversational assistant (Iris) that uses Google's Gemini API to answer questions about any webpage.
// @author       David Fisher (Revenant Systems LLC) & Iris
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      localhost
// @connect      generativelanguage.googleapis.com
// ==/UserScript==

(function() {
    'use strict';

    // Configurable settings (can be overridden in UI)
    let PROXY_API_URL = 'http://localhost:3000/generate-content';
    let temperature = 0.7;

    // --- State Management ---
    let chatHistory = []; // Holds the conversational memory

    // --- Simple Markdown Parser (Embedded) ---
    function simpleMarkdownToHtml(markdown) {
        let html = markdown;
        // Code blocks (triple backticks)
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre class="gemini-code-block"><code class="language-${lang || 'plaintext'}">${escapedCode}</code></pre>`;
        });
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>'); // Inline code
        // Bold (**text** or __text__)
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
        // Italic (*text* or _text_)
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/_(.*?)_/g, '<em>$1</em>');
        // Headings (#, ##, ###)
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        // Unordered lists (- item or * item)
        html = html.replace(/^(?:[-*]\s+(.*(?:\n\s{2}.*)*))+/gm, (match) => {
            const items = match.split('\n').filter(line => line.match(/^[-\*]\s+/)).map(line => `<li>${line.replace(/^[-\*]\s+/, '')}</li>`).join('');
            return `<ul>${items}</ul>`;
        });
        // Ordered lists (1. item)
        html = html.replace(/^(?:\d+\.\s+(.*(?:\n\s{2}.*)*))+/gm, (match) => {
            const items = match.split('\n').filter(line => line.match(/^\d+\.\s+/)).map(line => `<li>${line.replace(/^\d+\.\s+/, '')}</li>`).join('');
            return `<ol>${items}</ol>`;
        });
        // Paragraphs (add <br> for newlines)
        html = html.split('\n').map(line => line.trim() === '' ? '<br>' : line).join('<br>');
        return html;
    }

    // --- UI Elements Creation ---
    let chatContainer = document.createElement('div');
    chatContainer.id = 'gemini-chat-container';
    chatContainer.style.display = 'none'; // Hidden by default
    chatContainer.innerHTML = `
        <div id="gemini-chat-header" class="gemini-chat-draggable">
            Iris Assistant
            <div class="header-buttons">
                <button id="gemini-chat-settings-btn" title="Settings">⚙️</button>
                <button id="gemini-chat-clear-btn" title="Clear Chat History">Clear</button>
                <button id="gemini-chat-close-btn">&times;</button>
            </div>
        </div>
        <div id="gemini-chat-messages"></div>
        <div id="gemini-chat-input-area">
            <div class="gemini-model-selector-container">
                <label for="gemini-model-select">Model:</label>
                <select id="gemini-model-select">
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-pro">Gemini Pro (Legacy)</option>
                </select>
            </div>
            <textarea id="gemini-chat-input" placeholder="Ask about the page or selected text..." rows="3"></textarea>
            <button id="gemini-chat-send-btn">Send</button>
        </div>
        <div id="gemini-settings-modal" style="display: none;">
            <div class="settings-content">
                <h3>Settings</h3>
                <label for="temperature-slider">Temperature: <span id="temperature-value">${temperature}</span></label>
                <input type="range" id="temperature-slider" min="0" max="1" step="0.1" value="${temperature}">
                <label for="proxy-url-input">Proxy URL:</label>
                <input type="text" id="proxy-url-input" value="${PROXY_API_URL}">
                <button id="save-settings-btn">Save</button>
                <button id="close-settings-btn">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(chatContainer);

    let toggleButton = document.createElement('button');
    toggleButton.id = 'gemini-toggle-button';
    toggleButton.innerHTML = '✧';
    document.body.appendChild(toggleButton);

    // --- Styling for the UI Elements (Updated for settings modal and copy button) ---
    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
        #gemini-toggle-button {
            position: fixed; bottom: 15px; right: 15px; width: 40px; height: 40px;
            background-color: #202124; color: #00BCD4; border: none; border-radius: 50%;
            font-size: 30px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.4);
            z-index: 9999; display: flex; align-items: center; justify-content: center;
            transition: background-color 0.3s ease;
        }
        #gemini-toggle-button:hover { background-color: #303134; }
        #gemini-chat-container {
            position: fixed; bottom: 60px; right: 15px; width: 350px; min-width: 300px;
            max-height: 450px; min-height: 200px; background-color: #202124;
            border: 1px solid #444444; border-radius: 12px; box-shadow: 0 6px 12px rgba(0,0,0,0.4);
            z-index: 9998; display: flex; flex-direction: column; font-family: 'Inter', sans-serif;
            overflow: hidden; font-size: 13px; color: #FFFFFF;
        }
        .gemini-chat-draggable { cursor: grab; }
        #gemini-chat-header {
            background-color: #303134; padding: 10px 15px; border-bottom: 1px solid #444444;
            display: flex; justify-content: space-between; align-items: center; font-weight: bold;
            color: #FFFFFF; border-top-left-radius: 12px; border-top-right-radius: 12px;
            font-size: 14px; flex-shrink: 0;
        }
        .header-buttons { display: flex; gap: 8px; }
        #gemini-chat-settings-btn, #gemini-chat-close-btn, #gemini-chat-clear-btn {
            background: none; border: none; font-size: 20px; color: #FFFFFF;
            cursor: pointer; line-height: 1; padding: 0 5px; transition: color 0.2s ease;
        }
        #gemini-chat-settings-btn { font-size: 16px; }
        #gemini-chat-clear-btn { font-size: 12px; font-weight: normal; }
        #gemini-chat-close-btn:hover, #gemini-chat-clear-btn:hover, #gemini-chat-settings-btn:hover { color: #00BCD4; }
        #gemini-chat-messages {
            flex-grow: 1; padding: 15px; overflow-y: auto; background-color: #202124;
            font-size: 13px; line-height: 1.5;
        }
        .gemini-message {
            margin-bottom: 10px; padding: 8px 12px; border-radius: 8px;
            max-width: 90%; word-wrap: break-word; word-break: break-word; color: #FFFFFF;
            position: relative;
        }
        .gemini-message.user {
            background-color: #404144; align-self: flex-end; margin-left: auto; text-align: right;
        }
        .gemini-message.gemini {
            background-color: #303134; align-self: flex-start; margin-right: auto;
        }
        .gemini-message.gemini strong { color: #00BCD4; }
        .gemini-message.gemini em { color: #BBBBBB; }
        .gemini-message.gemini pre.gemini-code-block {
            background-color: #1a1a1a; padding: 8px; border-radius: 6px;
            overflow-x: auto; margin-top: 8px; margin-bottom: 8px;
        }
        .gemini-message.gemini code {
            font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace; font-size: 0.9em; color: #FFD700;
        }
        .gemini-message.gemini ul, .gemini-message.gemini ol {
            padding-left: 20px; margin-top: 8px; margin-bottom: 8px;
        }
        .gemini-message.gemini li { margin-bottom: 4px; }
        .gemini-message.gemini h1, .gemini-message.gemini h2, .gemini-message.gemini h3 {
            font-size: 1.2em; margin-top: 10px; margin-bottom: 5px; color: #00BCD4;
        }
        .gemini-copy-btn {
            position: absolute; top: 5px; right: 5px; background: none; border: none; color: #BBBBBB;
            cursor: pointer; font-size: 12px; opacity: 0.7; transition: opacity 0.2s;
        }
        .gemini-copy-btn:hover { opacity: 1; color: #00BCD4; }
        .gemini-loading-indicator {
            text-align: center; font-style: italic; color: #BBBBBB; margin-top: 10px; font-size: 12px;
        }
        .gemini-loading-indicator::before {
            content: ''; display: inline-block; width: 16px; height: 16px;
            border: 2px solid #00BCD4; border-top-color: transparent; border-radius: 50%;
            animation: spin 1s linear infinite; margin-right: 8px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        #gemini-chat-input-area {
            display: flex; flex-direction: column; border-top: 1px solid #444444; padding: 10px;
            background-color: #303134; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;
            flex-shrink: 0;
        }
        .gemini-model-selector-container {
            display: flex; align-items: center; margin-bottom: 10px; color: #FFFFFF; font-size: 12px;
        }
        #gemini-model-select {
            flex-grow: 1; padding: 6px 8px; border: 1px solid #555555; border-radius: 8px;
            background-color: #303134; color: #FFFFFF; font-size: 12px; margin-left: 8px;
            appearance: none; -webkit-appearance: none; -moz-appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg fill="%23FFFFFF" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/><path d="M0 0h24v24H0z" fill="none"/></svg>');
            background-repeat: no-repeat; background-position: right 8px center; background-size: 16px; cursor: pointer;
        }
        #gemini-model-select option { background-color: #303134; color: #FFFFFF; }
        #gemini-chat-input {
            width: 100%; border: 1px solid #555555; border-radius: 8px; padding: 8px;
            font-size: 13px; resize: vertical; min-height: 40px; max-height: 120px;
            margin-bottom: 10px; font-family: 'Inter', sans-serif; background-color: #303134; color: #FFFFFF;
        }
        #gemini-chat-input::placeholder { color: #BBBBBB; opacity: 1; }
        #gemini-chat-send-btn {
            width: 100%; background-color: #00BCD4; color: #202124; border: none;
            border-radius: 8px; padding: 8px 15px; cursor: pointer; font-size: 14px;
            font-weight: bold; transition: background-color 0.3s ease;
        }
        #gemini-chat-send-btn:hover { background-color: #00A3B0; }
        #gemini-settings-modal {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center; z-index: 10000;
        }
        .settings-content {
            background: #303134; padding: 20px; border-radius: 12px; width: 80%; max-width: 300px;
            color: #FFFFFF;
        }
        .settings-content label { display: block; margin-bottom: 10px; }
        .settings-content input[type="range"] { width: 100%; }
        .settings-content input[type="text"] { width: 100%; padding: 8px; border: 1px solid #555; background: #202124; color: #FFF; }
        .settings-content button { margin-top: 10px; padding: 8px; background: #00BCD4; border: none; color: #202124; cursor: pointer; }
        .settings-content button:hover { background: #00A3B0; }
    `);

    // --- Event Listeners & UI Logic ---
    const chatInput = document.getElementById('gemini-chat-input');
    const chatSendBtn = document.getElementById('gemini-chat-send-btn');
    const chatMessages = document.getElementById('gemini-chat-messages');
    const modelSelect = document.getElementById('gemini-model-select');
    const settingsModal = document.getElementById('gemini-settings-modal');
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    const proxyUrlInput = document.getElementById('proxy-url-input');

    toggleButton.addEventListener('click', () => {
        const isHidden = chatContainer.style.display === 'none';
        chatContainer.style.display = isHidden ? 'flex' : 'none';
        if (isHidden) chatInput.focus();
    });

    document.getElementById('gemini-chat-close-btn').addEventListener('click', () => {
        chatContainer.style.display = 'none';
    });

    document.getElementById('gemini-chat-clear-btn').addEventListener('click', () => {
        chatMessages.innerHTML = ''; // Clear visual messages
        chatHistory = []; // Clear conversational memory
    });

    document.getElementById('gemini-chat-settings-btn').addEventListener('click', () => {
        settingsModal.style.display = 'flex';
    });

    document.getElementById('close-settings-btn').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    document.getElementById('save-settings-btn').addEventListener('click', () => {
        temperature = parseFloat(temperatureSlider.value);
        PROXY_API_URL = proxyUrlInput.value.trim();
        settingsModal.style.display = 'none';
    });

    temperatureSlider.addEventListener('input', () => {
        temperatureValue.textContent = temperatureSlider.value;
    });

    chatSendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // --- Drag and Drop Logic (Improved bounds checking) ---
    const chatHeader = document.getElementById('gemini-chat-header');
    let isDragging = false, offsetX, offsetY;
    chatHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - chatContainer.getBoundingClientRect().left;
        offsetY = e.clientY - chatContainer.getBoundingClientRect().top;
        chatContainer.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        const rect = chatContainer.getBoundingClientRect();
        const bounds = { w: window.innerWidth, h: window.innerHeight };
        newX = Math.max(0, Math.min(newX, bounds.w - rect.width));
        newY = Math.max(0, Math.min(newY, bounds.h - rect.height));
        chatContainer.style.left = `${newX}px`;
        chatContainer.style.top = `${newY}px`;
        chatContainer.style.right = 'auto';
        chatContainer.style.bottom = 'auto';
    });
    document.addEventListener('mouseup', () => {
        isDragging = false;
        chatContainer.style.cursor = 'default';
    });

    // --- Core Logic ---

    /**
     * Tries to find the main content of the page, falling back to the body. Ignores scripts/styles.
     */
    function getSmarterPageContent() {
        const selectors = 'main, article, [role="main"], #main, #content, .post-content, .entry-content';
        let mainEl = document.querySelector(selectors) || document.body;
        // Clone to remove unwanted elements
        const clone = mainEl.cloneNode(true);
        clone.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
        let text = clone.innerText.trim().replace(/\s+/g, ' ');
        return text;
    }

    /**
     * Intelligently truncates text by paragraphs to fit token limits.
     */
    function truncateContext(text, maxLength = 15000) {
        if (text.length <= maxLength) return text;
        const paragraphs = text.split('\n\n');
        let truncated = '';
        for (let p of paragraphs) {
            if (truncated.length + p.length + 2 > maxLength) break;
            truncated += p + '\n\n';
        }
        return truncated.trim() + '\n... [Content Truncated - Page too long for full context]';
    }

    /**
     * Displays a message in the chat UI with copy button.
     * @param {string} sender - 'user' or 'gemini'
     * @param {string} text - The message content
     */
    function displayMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('gemini-message', sender);
        messageDiv.innerHTML = sender === 'gemini' ? simpleMarkdownToHtml(text) : text;
        if (sender === 'gemini') {
            const copyBtn = document.createElement('button');
            copyBtn.classList.add('gemini-copy-btn');
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copy Response';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.innerHTML = '✅';
                    setTimeout(() => copyBtn.innerHTML = '📋', 2000);
                });
            });
            messageDiv.appendChild(copyBtn);
        }
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Manages the loading indicator in the chat UI.
     */
    function toggleLoadingIndicator(show) {
        let indicator = document.getElementById('gemini-loading-indicator');
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'gemini-loading-indicator';
                indicator.classList.add('gemini-message', 'gemini', 'gemini-loading-indicator');
                indicator.textContent = 'Iris is thinking...';
                chatMessages.appendChild(indicator);
            }
        } else if (indicator) {
            indicator.remove();
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Main function to handle sending messages to the proxy and receiving responses.
     */
    async function sendMessage() {
        const userQuestion = chatInput.value.trim();
        if (!userQuestion) return;

        displayMessage('user', userQuestion);
        chatInput.value = '';
        toggleLoadingIndicator(true);

        // **1. Get Context:** Prioritize selected text, otherwise use smart page content.
        let contextText;
        const selectedText = window.getSelection().toString().trim();
        if (selectedText) {
            contextText = `The user has highlighted the following text on the page:\n---\n${selectedText}`;
        } else {
            contextText = `Here is the primary content of the webpage:\n---\n${getSmarterPageContent()}`;
        }

        // Truncate context intelligently
        contextText = truncateContext(contextText);

        // **2. Construct Conversational Payload**
        // The very first message provides the page context. Subsequent messages are conversational.
        if (chatHistory.length === 0) {
            chatHistory.push(
                { role: "user", parts: [{ text: `You are Iris, a helpful webpage assistant. Here is the context from the page at ${window.location.href}. ${contextText}` }] },
                { role: "model", parts: [{ text: "Understood. I have the context. How can I help you?" }] }
            );
        }
        chatHistory.push({ role: "user", parts: [{ text: userQuestion }] });

        const payload = {
            model: modelSelect.value,
            contents: chatHistory,
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: 1024,
            }
        };

        // **3. Make API Call via Proxy**
        GM_xmlhttpRequest({
            method: 'POST',
            url: PROXY_API_URL,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload),
            onload: function(response) {
                toggleLoadingIndicator(false);
                try {
                    if (response.status >= 200 && response.status < 300) {
                        const result = JSON.parse(response.responseText);
                        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
                            const modelResponse = result.candidates[0].content.parts[0].text;
                            displayMessage('gemini', modelResponse);
                            // Add model's response to history for the next turn
                            chatHistory.push({ role: "model", parts: [{ text: modelResponse }] });
                        } else {
                            displayMessage('gemini', 'Unexpected response format from API.');
                        }
                    } else {
                        const errorData = JSON.parse(response.responseText);
                        const errorMessage = `Proxy Error ${response.status}: ${errorData.error.message || response.statusText}`;
                        displayMessage('gemini', errorMessage);
                    }
                } catch (e) {
                    displayMessage('gemini', `Error parsing response from proxy. See console for details.`);
                    console.error("Parse Error:", e, "Response:", response.responseText);
                }
            },
            onerror: function(error) {
                toggleLoadingIndicator(false);
                displayMessage('gemini', `Network error connecting to proxy at ${PROXY_API_URL}. Is it running?`);
                console.error("GM_xmlhttpRequest Error:", error);
            }
        });
    }
})();
