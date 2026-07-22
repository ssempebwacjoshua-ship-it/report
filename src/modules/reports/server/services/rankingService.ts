export type Rankable = { id: string; score: number | null };

export function rankByScore(items: Rankable[]): Map<string, number | null> {
  const ranked = items
    .filter((item): item is { id: string; score: number } => item.score != null)
    .sort((a, b) => b.score - a.score);

  const positions = new Map<string, number | null>();
  let lastScore: number | null = null;
  let lastPosition = 0;

  ranked.forEach((item, index) => {
    if (lastScore == null || item.score !== lastScore) {
      lastPosition = index + 1;
      lastScore = item.score;
    }
    positions.set(item.id, lastPosition);
  });

  items.forEach((item) => {
    if (!positions.has(item.id)) positions.set(item.id, null);
  });

  return positions;
}

