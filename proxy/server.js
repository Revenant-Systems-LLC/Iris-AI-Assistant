const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Content generation endpoint
app.post('/generate-content', async (req, res) => {
  try {
    const { provider, model, temperature, messages, pageContext, privacyLevel } = req.body;
    
    // Validate request
    if (!provider || !model || !messages) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Prepare system message with page context
    const systemMessage = createSystemMessage(pageContext, privacyLevel);
    
    // Prepare messages array with system message
    const formattedMessages = [
      { role: 'system', content: systemMessage },
      ...messages
    ];
    
    let content;
    
    // Generate content based on provider
    switch (provider) {
      case 'gemini':
        content = await generateWithGemini(model, formattedMessages, temperature);
        break;
      case 'openai':
        content = await generateWithOpenAI(model, formattedMessages, temperature);
        break;
      case 'ninjatech':
        content = await generateWithNinjaTech(model, formattedMessages, temperature);
        break;
      default:
        return res.status(400).json({ error: 'Invalid provider' });
    }
    
    res.json({ content });
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create system message with page context
function createSystemMessage(pageContext, privacyLevel) {
  if (!pageContext) {
    return 'You are Iris, an AI web assistant. Help the user with their questions.';
  }
  
  const { url, title, content, metadata } = pageContext;
  
  let systemMessage = `You are Iris, an AI web assistant. You are currently helping the user with the webpage titled "${title}" at URL "${url}".`;
  
  // Add metadata if available
  if (metadata) {
    if (metadata.description) {
      systemMessage += `\n\nPage description: ${metadata.description}`;
    }
    
    if (metadata.keywords) {
      systemMessage += `\n\nKeywords: ${metadata.keywords}`;
    }
    
    if (metadata.author) {
      systemMessage += `\n\nAuthor: ${metadata.author}`;
    }
    
    if (metadata.publishedDate) {
      systemMessage += `\n\nPublished date: ${metadata.publishedDate}`;
    }
  }
  
  // Add page content based on privacy level
  if (privacyLevel === 'minimal') {
    systemMessage += '\n\nThe user has enabled minimal privacy mode, so you only have access to the page URL and title.';
  } else if (content) {
    systemMessage += `\n\nHere is the content of the page:\n\n${content}`;
  }
  
  systemMessage += '\n\nProvide helpful, accurate, and concise responses based on this context.';
  
  return systemMessage;
}

// Gemini API handler
async function generateWithGemini(model, messages, temperature) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  
  // Convert messages to Gemini format
  const geminiMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: [{ text: msg.content }]
  }));
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: geminiMessages,
      generationConfig: {
        temperature: temperature || 0.7
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error calling Gemini API');
  }
  
  const data = await response.json();
  
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No response from Gemini API');
  }
  
  return data.candidates[0].content.parts[0].text;
}

// OpenAI API handler
async function generateWithOpenAI(model, messages, temperature) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature || 0.7
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error calling OpenAI API');
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// NinjaTech AI API handler
async function generateWithNinjaTech(model, messages, temperature) {
  const apiKey = process.env.NINJATECH_API_KEY;
  if (!apiKey) {
    throw new Error('NinjaTech API key not configured');
  }
  
  const response = await fetch('https://api.ninjatech.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      temperature: temperature || 0.7
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error calling NinjaTech API');
  }
  
  const data = await response.json();
  return data.choices[0].message.content;
}

// Start server
app.listen(port, () => {
  console.log(`Iris proxy server running on port ${port}`);
});
