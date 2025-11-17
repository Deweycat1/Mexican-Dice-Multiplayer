import { kv } from '@vercel/kv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// All possible normalized roll codes (high die first)
const ALL_ROLL_CODES = [
  '21', '31', '32', '41', '42', '43',
  '51', '52', '53', '54',
  '61', '62', '63', '64', '65',
  '11', '22', '33', '44', '55', '66'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      // Record a Quick Play game outcome
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { winner, winningClaim, losingClaim } = body;

      if (!winner || (winner !== 'player' && winner !== 'cpu')) {
        return res.status(400).json({ error: 'Invalid winner' });
      }

      const updates: Record<string, number> = {};

      // Increment winning claim counter
      if (winningClaim && typeof winningClaim === 'string' && winningClaim.length >= 2) {
        const key = `stats:winningClaims:${winningClaim}`;
        await kv.incr(key);
        const count = await kv.get<number>(key) ?? 0;
        updates.winning = count;
      }

      // Increment losing claim counter
      if (losingClaim && typeof losingClaim === 'string' && losingClaim.length >= 2) {
        const key = `stats:losingClaims:${losingClaim}`;
        await kv.incr(key);
        const count = await kv.get<number>(key) ?? 0;
        updates.losing = count;
      }

      return res.status(200).json({ ok: true, updates });
    }

    if (req.method === 'GET') {
      // Return aggregated winning/losing claim stats
      const winning: Record<string, number> = {};
      const losing: Record<string, number> = {};

      // Fetch all winning claim counts
      for (const code of ALL_ROLL_CODES) {
        const winCount = await kv.get<number>(`stats:winningClaims:${code}`) ?? 0;
        winning[code] = winCount;
      }

      // Fetch all losing claim counts
      for (const code of ALL_ROLL_CODES) {
        const loseCount = await kv.get<number>(`stats:losingClaims:${code}`) ?? 0;
        losing[code] = loseCount;
      }

      return res.status(200).json({ winning, losing });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in claim-outcome-stats:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
