function kFactor(elo: number): number {
  return elo >= 2400 ? 16 : 32;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function calculateNewRating(rating: number, score: number, opponentRating: number): number {
  const k = kFactor(rating);
  const expected = expectedScore(rating, opponentRating);
  return Math.round(rating + k * (score - expected));
}

// Returns { whiteElo, blackElo, eloChange } for a game result
export function calculateEloChange(
  whiteElo: number,
  blackElo: number,
  result: 'white' | 'black' | 'draw'
): { newWhiteElo: number; newBlackElo: number; eloChange: number } {
  const whiteScore = result === 'white' ? 1 : result === 'draw' ? 0.5 : 0;
  const blackScore = 1 - whiteScore;

  const newWhiteElo = calculateNewRating(whiteElo, whiteScore, blackElo);
  const newBlackElo = calculateNewRating(blackElo, blackScore, whiteElo);

  const eloChange = Math.abs(newWhiteElo - whiteElo);
  return { newWhiteElo, newBlackElo, eloChange };
}
