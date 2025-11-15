import {
    compareClaims,
    enumerateClaims,
    isMexican,
    meetsOrBeats,
} from '../engine/mexican';

export function buildClaimOptions(previousClaim: number | null, playerRoll?: number | null): number[] {
  const all = enumerateClaims().filter((v) => v !== 41);

  // Ensure 21 and 31 are present in results
  const includeSpecial = (list: number[]) => {
    const withSpecial = [...list];
    if (!withSpecial.includes(21)) withSpecial.push(21);
    if (!withSpecial.includes(31)) withSpecial.push(31);
    return withSpecial;
  };

  // If no previous claim, everything (except 41) is available
  if (previousClaim == null) {
    return Array.from(all).sort((a, b) => compareClaims(a, b));
  }

  // If previous was Mexican, lockdown: only 21/31 (41 excluded globally)
  if (isMexican(previousClaim)) {
    return includeSpecial([]).sort((a, b) => compareClaims(a, b));
  }

  // If we don't know the player's roll, offer any claim that beats the previous (plus reverses)
  // If we DO know the player's roll, the legal options are still anything that
  // meets or beats the previous claim; the player may bluff with values below
  // their actual roll. We simply ensure 41 is excluded and 21/31 are included.
  const opts = all.filter((v) => meetsOrBeats(v, previousClaim));
  return includeSpecial(opts).sort((a, b) => compareClaims(a, b));
}
