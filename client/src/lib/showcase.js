// Decorative heatmap levels for marketing visuals. Deterministic so they look the same on every
// visit, and drift upward over time to tell the "getting more consistent" story.
export function showcaseCells(weeks = 16) {
  const total = 7 * weeks;
  return Array.from({ length: total }, (_, i) => {
    const growth = i / total;
    const wave = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const v = Math.abs(wave) + growth * 0.6 - 0.25;
    return v < 0.35 ? 0 : v < 0.6 ? 1 : v < 0.8 ? 2 : v < 1 ? 3 : 4;
  });
}
