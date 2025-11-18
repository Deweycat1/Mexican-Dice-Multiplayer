import {
    compareClaims,
    enumerateClaims,
    isMexican,
    meetsOrBeats,
} from '../engine/mexican';

export function buildClaimOptions(previousClaim: number | null, playerRoll?: number | null): number[] {
  // Include all enumerated claims (41 is valid in rule-checking contexts)
  const all = enumerateClaims();

  // Ensure special claims (21, 31, 41) are present in results
  const includeSpecial = (list: number[]) => {
    const withSpecial = [...list];
    if (!withSpecial.includes(21)) withSpecial.push(21);
    if (!withSpecial.includes(31)) withSpecial.push(31);
    if (!withSpecial.includes(41)) withSpecial.push(41);
    return withSpecial;
  };

  // If no previous claim, everything (except 41) is available
  if (previousClaim == null) {
    return Array.from(all).sort((a, b) => compareClaims(a, b));
  }

  // If previous was Mexican, lockdown: only 21/31/41 are legal
  if (isMexican(previousClaim)) {
    return includeSpecial([]).sort((a, b) => compareClaims(a, b));
  }

  // Offer any claim that meets or beats the previous (plus always-claimable specials)
  const opts = all.filter((v) => meetsOrBeats(v, previousClaim));
  return includeSpecial(opts).sort((a, b) => compareClaims(a, b));
}
