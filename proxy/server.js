require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

app.use(cors());
app.use(express.json());

// Health check endpoint for deployment platforms
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    keys: {
      gemini: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY
    }
  });
});

app.post('/generate-content', async (req, res) => {
  const { llm, model, contents, generationConfig } = req.body;
  let apiKey, apiUrl, payload;

  switch (llm) {
    case 'gemini':
      apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: { message: 'Gemini API key missing.' } });
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      payload = { contents, generationConfig };
      break;
    case 'openai':
      apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: { message: 'OpenAI API key missing.' } });
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      payload = {
        model,
        messages: contents.map(c => ({ role: c.role === 'model' ? 'assistant' : c.role, content: c.parts[0].text })),
        temperature: generationConfig.temperature,
        max_tokens: generationConfig.maxOutputTokens
      };
      break;
    default:
      return res.status(400).json({ error: { message: 'Invalid LLM selected.' } });
  }

  try {
    const response = await axios.post(apiUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(llm === 'openai' ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      timeout: 30000 // 30 second timeout
    });

    // Normalize response to Gemini-like format
    let normalized = normalizeResponse(llm, response.data);
    res.json(normalized);
  } catch (error) {
    console.error('LLM API Error:', error.message);
    
    const status = error.response ? error.response.status : 500;
    const message = error.response ? error.response.data.error?.message || error.message : 'Internal error';
    
    if (status === 429) {
      res.status(429).json({ error: { message: 'Rate limit exceeded. Try again later.' } });
    } else if (error.code === 'ECONNABORTED') {
      res.status(408).json({ error: { message: 'Request timeout. Please try again.' } });
    } else {
      res.status(status).json({ error: { message } });
    }
  }
});

// Normalize responses to { candidates: [{ content: { parts: [{ text }] } }] }
function normalizeResponse(llm, data) {
  switch (llm) {
    case 'gemini':
      return data;
    case 'openai':
      return {
        candidates: [{ content: { parts: [{ text: data.choices[0].message.content }] } }]
      };
  }
}

// Export logs endpoint (basic implementation)
app.get('/logs', (req, res) => {
  res.json({ 
    logs: 'Server logs endpoint - implement proper logging as needed',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: { message: 'Internal server error' } });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Endpoint not found' } });
});

try {
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Iris Proxy Server running on http://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
    console.log(`🔑 Keys loaded: Gemini=${!!process.env.GEMINI_API_KEY}, OpenAI=${!!process.env.OPENAI_API_KEY}`);
  });
} catch (err) {
  console.error('❌ Server start failed:', err);
  process.exit(1);
}
