const SUP: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

/**
 * Format a number to 3 significant figures, writing large/small values in
 * scientific notation as "1.36 × 10³".
 */
export function sf3(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  if (x === 0) return "0.00";
  const s = x.toPrecision(3);
  const m = s.match(/^(-?[\d.]+)e([+-]\d+)$/);
  if (!m) return s;
  const exp = String(Number(m[2])).split("").map((c) => SUP[c]).join("");
  return `${m[1]} × 10${exp}`;
}

/** Short tick labels for chart axes (e.g. 1.2k, 3.4M). */
export function tick(x: number): string {
  const ax = Math.abs(x);
  if (ax >= 1e9) return `${+(x / 1e9).toPrecision(3)}G`;
  if (ax >= 1e6) return `${+(x / 1e6).toPrecision(3)}M`;
  if (ax >= 1e4) return `${+(x / 1e3).toPrecision(3)}k`;
  return `${+x.toPrecision(3)}`;
}
