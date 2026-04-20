require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const path    = require('path');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// ── Claude API proxy ──────────────────────────────────────────────────────────
// The browser calls /api/claude — this server forwards to Anthropic with the real key.
// The API key never touches the browser.
app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY || 'const apiKey = process.env.ANTHROPIC_API_KEY';

  if (!apiKey || apiKey === 'your-key-here') {
    return res.status(401).json({
      error: 'ANTHROPIC_API_KEY not set. Add it to your .env file.'
    });
  }

  const payload = JSON.stringify(req.body);

  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers:  {
      'Content-Type':      'application/json',
      'Content-Length':    Buffer.byteLength(payload),
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    }
  };

  const proxyReq = https.request(options, proxyRes => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      res.status(proxyRes.statusCode).set('Content-Type', 'application/json').send(data);
    });
  });

  proxyReq.on('error', err => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy request failed: ' + err.message });
  });

  proxyReq.write(payload);
  proxyReq.end();
});

// ── Serve the demo for any other route ───────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  LexAI Demo running at http://localhost:${PORT}\n`);
});
