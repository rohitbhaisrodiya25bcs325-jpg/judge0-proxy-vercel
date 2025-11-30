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
  // Vercel may already provide req.body as object. If not, read raw body.
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
  // Always set CORS headers
  setCors(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    // short-circuit preflight
    return res.status(204).end();
  }

  const JUDGE0_BASE = process.env.JUDGE0_BASE || 'https://judge0-ce.p.rapidapi.com';
  const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';
  const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

  if (!JUDGE0_API_KEY) {
    // ensure CORS headers are present on error too
    setCors(res);
    return res.status(500).json({ error: "Missing JUDGE0_API_KEY in Vercel environment." });
  }

  try {
    const pathname = (req.url || '').split('?')[0]; // `/submissions` or `/submissions/<token>`

    // POST /submissions -> create a submission
    if (req.method === 'POST' && pathname.endsWith('/submissions')) {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (err) {
        setCors(res);
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      const url = `${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`;
      const headers = {
        'Content-Type': 'application/json',
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'X-RapidAPI-Key': JUDGE0_API_KEY
      };

      const upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const json = await upstream.json().catch(() => null);
      setCors(res);
      // forward upstream status + body
      return res.status(upstream.status).json(json ?? { message: 'No JSON response from Judge0' });
    }

    // GET /submissions/:token -> fetch result
    if (req.method === 'GET' && pathname.match(/^\/submissions\/.+/)) {
      const token = pathname.split('/').pop();
      const url = `${JUDGE0_BASE}/submissions/${encodeURIComponent(token)}?base64_encoded=false`;
      const headers = {
        'Content-Type': 'application/json',
        'X-RapidAPI-Host': RAPIDAPI_HOST,
        'X-RapidAPI-Key': JUDGE0_API_KEY
      };

      const upstream = await fetch(url, { method: 'GET', headers });
      const json = await upstream.json().catch(() => null);
      setCors(res);
      return res.status(upstream.status).json(json ?? { message: 'No JSON response from Judge0' });
    }

    // Unknown path
    setCors(res);
    return res.status(404).json({ error: 'Not found' });

  } catch (err) {
    // Ensure CORS headers present on error response
    setCors(res);
    // Log error server-side (visible in Vercel logs)
    console.error('judge0-proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
