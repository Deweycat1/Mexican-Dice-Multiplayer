import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const diceMathMatches = await kv.get<number>('stats:player:diceMathMatches');
    const diceMathTransitions = await kv.get<number>('stats:player:diceMathTransitions');
    const lastRoll = await kv.get<string>('stats:player:lastRoll');
    const totalRolls = await kv.get<number>('rollStats:total');

    return res.status(200).json({
      diceMathMatches: diceMathMatches ?? 0,
      diceMathTransitions: diceMathTransitions ?? 0,
      lastRoll: lastRoll ?? null,
      totalRolls: totalRolls ?? 0,
      explanation: {
        issue: diceMathTransitions === null || diceMathTransitions === 0 
          ? 'Transitions counter is zero - consecutive rolls not being tracked'
          : 'Transitions are being tracked',
        expected: `With ${totalRolls ?? 0} total rolls, should have approximately ${Math.max(0, (totalRolls ?? 0) - 1)} transitions`,
      }
    });
  } catch (err) {
    console.error('debug-dice-math error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
