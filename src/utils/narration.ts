export function formatCallBluffMessage(opts: {
  callerName: string;
  defenderName: string;
  defenderToldTruth: boolean;
  penalty?: number;
  useEmDash?: boolean;
}) {
  const {
    callerName,
    defenderName,
    defenderToldTruth,
    penalty = 1,
    useEmDash = false,
  } = opts;

  const dash = useEmDash ? ' — ' : ' - ';
  const lossSuffix = `${penalty > 1 ? `${penalty}` : '1'}`;
  const possessive = defenderName === 'You' ? 'your' : `${defenderName}'s`;
  const prefix = `${callerName} called ${possessive} bluff! `;

  if (defenderToldTruth) {
    return `${prefix}${defenderName} told the truth${dash}${callerName}-${lossSuffix}`;
  }

  return `${prefix}${defenderName} was bluffing${dash}${defenderName}-${lossSuffix}`;
}

export default formatCallBluffMessage;
