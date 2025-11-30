const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }

  const JUDGE0_BASE = process.env.JUDGE0_BASE || 'https://judge0-ce.p.rapidapi.com';
  const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';
  const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

  if (!JUDGE0_API_KEY) {
    return res.status(500).json({ error: "Missing JUDGE0_API_KEY in Vercel environment." });
  }

  try {
    if (req.method === 'POST' && req.url.endsWith('/submissions')) {
      const body = req.body || {};
      const url = `${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`;
      const headers = {
        "Content-Type": "application/json",
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "X-RapidAPI-Key": JUDGE0_API_KEY
      };
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const json = await r.json();
      return res.status(r.status).json(json);
    }

    if (req.method === 'GET' && req.url.match(/\/submissions\/.+/)) {
      const token = req.url.split('/').pop();
      const url = `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false`;
      const headers = {
        "Content-Type": "application/json",
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "X-RapidAPI-Key": JUDGE0_API_KEY
      };
      const r = await fetch(url, { method: "GET", headers });
      const json = await r.json();
      return res.status(r.status).json(json);
    }

    return res.status(404).json({ error: "Not found." });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
