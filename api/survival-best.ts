// api/survival-best.ts
import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GLOBAL_KEY = 'survival:globalBest';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const best = (await kv.get<number>(GLOBAL_KEY)) ?? 0;
      return res.status(200).json({ best });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
      const { streak } = body || {};

      if (typeof streak !== 'number' || streak < 0) {
        return res.status(400).json({ error: 'streak must be a non-negative number' });
      }

      const current = (await kv.get<number>(GLOBAL_KEY)) ?? 0;

      if (streak > current) {
        await kv.set(GLOBAL_KEY, streak);
        return res.status(200).json({ best: streak, updated: true });
      }

      return res.status(200).json({ best: current, updated: false });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  } catch (err) {
    console.error('survival-best error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
