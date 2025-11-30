// api/judge0-proxy.js
const fetch = require('node-fetch');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function setCors(res) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (err) { return reject(new Error('Invalid JSON body')); }
    });
    req.on('error', err => reject(err));
  });
}

module.exports = async (req, res) => {
  // Always set CORS
  setCors(res);

  // OPTIONS / preflight
  if (req.method === 'OPTIONS') return res.status(204).end();

  const JUDGE0_BASE = process.env.JUDGE0_BASE || 'https://judge0-ce.p.rapidapi.com';
  const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';
  const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

  if (!JUDGE0_API_KEY) {
    setCors(res);
    return res.status(500).json({ error: "Missing JUDGE0_API_KEY in Vercel environment." });
  }

  try {
    // Accept POST at function root to create a submission
    // (client will POST to https://.../api/judge0-proxy with payload)
    if (req.method === 'POST') {
      let body;
      try { body = await readJsonBody(req); }
      catch (err) {
        setCors(res);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      const url = `${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`;
      const headers = {
        'Content-Type': 'application/json',
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'X-RapidAPI-Key': JUDGE0_API_KEY
      };

      const upstream = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const json = await upstream.json().catch(() => null);
      setCors(res);
      return res.status(upstream.status).json(json ?? { message: 'No JSON response from Judge0' });
    }

    // Accept GET at function root to fetch result by token query (?token=...)
    // or accept GET /<token> if routing provides it.
    if (req.method === 'GET') {
      // prefer query param token
      const urlObj = new URL(req.url, 'https://example'); // base required for URL parsing
      const tokenQ = urlObj.searchParams.get('token');

      let token = tokenQ;
      // fallback: if path contains token like /submissions/<token> or /<token>
      const p = (req.url || '').split('?')[0];
      const m = p.match(/\/?submissions\/(.+)$/) || p.match(/^\/([^/]+)$/);
      if (!token && m) token = m[1];

      if (!token) {
        setCors(res);
        return res.status(400).json({ error: 'Missing token. Provide ?token=<token> to fetch result.' });
      }

      const resultUrl = `${JUDGE0_BASE}/submissions/${encodeURIComponent(token)}?base64_encoded=false`;
      const headers = {
        'Content-Type': 'application/json',
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'X-RapidAPI-Key': JUDGE0_API_KEY
      };

      const upstream = await fetch(resultUrl, { method: 'GET', headers });
      const json = await upstream.json().catch(() => null);
      setCors(res);
      return res.status(upstream.status).json(json ?? { message: 'No JSON response from Judge0' });
    }

    // fallback
    setCors(res);
    return res.status(404).json({ error: 'Not found' });

  } catch (err) {
    setCors(res);
    console.error('judge0-proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
