/** Void → steel → frost → copper → ember. Data colormap, not UI chrome. */
const STOPS: readonly [number, number, number, number][] = [
  [0, 0.04, 0.06, 0.1],
  [0.28, 0.28, 0.42, 0.55],
  [0.5, 0.78, 0.86, 0.9],
  [0.74, 0.82, 0.46, 0.3],
  [1, 0.94, 0.78, 0.58],
];

export function sampleColormap(t: number, out: { r: number; g: number; b: number }) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  let i = 0;
  while (i < STOPS.length - 2 && x > STOPS[i + 1]![0]) i += 1;
  const a = STOPS[i]!;
  const b = STOPS[i + 1]!;
  const span = b[0] - a[0] || 1;
  const u = (x - a[0]) / span;
  out.r = a[1] + (b[1] - a[1]) * u;
  out.g = a[2] + (b[2] - a[2]) * u;
  out.b = a[3] + (b[3] - a[3]) * u;
}

export function packRgb(t: number): [number, number, number] {
  const c = { r: 0, g: 0, b: 0 };
  sampleColormap(t, c);
  return [
    Math.round(c.r * 255),
    Math.round(c.g * 255),
    Math.round(c.b * 255),
  ];
}
