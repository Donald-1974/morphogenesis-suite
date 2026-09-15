export const MORPHOLOGIES = [
  {
    id: "protoplast",
    label: "Protoplast",
    blurb: "Spherical cell. Uniform turgor, incompressible interior.",
  },
  {
    id: "budding",
    label: "Budding",
    blurb: "Localized turgor on one flank. Yeast-like outgrowth.",
  },
  {
    id: "fission",
    label: "Fission",
    blurb: "Equatorial constriction, polar expansion. Cytokinesis.",
  },
  {
    id: "polar",
    label: "Polar",
    blurb: "Tip growth. Turgor concentrated on the +Y cap.",
  },
  {
    id: "blastula",
    label: "Blastula",
    blurb: "Hollow shell. Cortex under turgor, empty lumen.",
  },
  {
    id: "dual",
    label: "Dual",
    blurb: "Two approaching masses. Collision then projection.",
  },
] as const;

export type Morphology = (typeof MORPHOLOGIES)[number]["id"];

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function fillBall(
  pos: Float32Array,
  vel: Float32Array,
  start: number,
  count: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  rng: () => number,
  vx = 0,
  vy = 0,
  vz = 0,
  inner = 0,
) {
  let written = 0;
  let guard = 0;
  const r2 = radius * radius;
  const i2 = inner * inner;
  while (written < count && guard < count * 40) {
    guard += 1;
    const x = (rng() * 2 - 1) * radius;
    const y = (rng() * 2 - 1) * radius;
    const z = (rng() * 2 - 1) * radius;
    const d2 = x * x + y * y + z * z;
    if (d2 > r2 || d2 < i2) continue;
    const i = start + written;
    pos[i * 3] = cx + x;
    pos[i * 3 + 1] = cy + y;
    pos[i * 3 + 2] = cz + z;
    vel[i * 3] = vx + (rng() - 0.5) * 0.02;
    vel[i * 3 + 1] = vy + (rng() - 0.5) * 0.02;
    vel[i * 3 + 2] = vz + (rng() - 0.5) * 0.02;
    written += 1;
  }
  while (written < count) {
    const u = rng() * Math.PI * 2;
    const v = Math.acos(rng() * 2 - 1);
    const rr = inner + (radius - inner) * Math.cbrt(rng());
    const i = start + written;
    pos[i * 3] = cx + rr * Math.sin(v) * Math.cos(u);
    pos[i * 3 + 1] = cy + rr * Math.cos(v);
    pos[i * 3 + 2] = cz + rr * Math.sin(v) * Math.sin(u);
    vel[i * 3] = vx;
    vel[i * 3 + 1] = vy;
    vel[i * 3 + 2] = vz;
    written += 1;
  }
}

function fillEllipsoid(
  pos: Float32Array,
  vel: Float32Array,
  count: number,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  rng: () => number,
) {
  let written = 0;
  let guard = 0;
  while (written < count && guard < count * 40) {
    guard += 1;
    const x = (rng() * 2 - 1) * rx;
    const y = (rng() * 2 - 1) * ry;
    const z = (rng() * 2 - 1) * rz;
    if ((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz) > 1) {
      continue;
    }
    pos[written * 3] = cx + x;
    pos[written * 3 + 1] = cy + y;
    pos[written * 3 + 2] = cz + z;
    vel[written * 3] = (rng() - 0.5) * 0.02;
    vel[written * 3 + 1] = (rng() - 0.5) * 0.02;
    vel[written * 3 + 2] = (rng() - 0.5) * 0.02;
    written += 1;
  }
  while (written < count) {
    const u = rng() * Math.PI * 2;
    const v = Math.acos(rng() * 2 - 1);
    pos[written * 3] = cx + rx * Math.sin(v) * Math.cos(u) * 0.92;
    pos[written * 3 + 1] = cy + ry * Math.cos(v) * 0.92;
    pos[written * 3 + 2] = cz + rz * Math.sin(v) * Math.sin(u) * 0.92;
    vel[written * 3] = 0;
    vel[written * 3 + 1] = 0;
    vel[written * 3 + 2] = 0;
    written += 1;
  }
}

export function seedParticles(
  kind: Morphology,
  pos: Float32Array,
  vel: Float32Array,
  count: number,
) {
  const rng = makeRng(17 + kind.length * 97);
  vel.fill(0);
  switch (kind) {
    case "protoplast":
      fillBall(pos, vel, 0, count, 0.5, 0.5, 0.5, 0.22, rng);
      break;
    case "budding":
      fillBall(pos, vel, 0, count, 0.5, 0.5, 0.5, 0.2, rng);
      break;
    case "fission":
      fillEllipsoid(pos, vel, count, 0.5, 0.5, 0.5, 0.28, 0.16, 0.16, rng);
      break;
    case "polar":
      fillBall(pos, vel, 0, count, 0.5, 0.46, 0.5, 0.18, rng);
      break;
    case "blastula":
      fillBall(pos, vel, 0, count, 0.5, 0.5, 0.5, 0.24, rng, 0, 0, 0, 0.175);
      break;
    case "dual": {
      const half = Math.floor(count / 2);
      fillBall(pos, vel, 0, half, 0.32, 0.5, 0.5, 0.14, rng, 0.22, 0, 0);
      fillBall(
        pos,
        vel,
        half,
        count - half,
        0.68,
        0.5,
        0.5,
        0.14,
        rng,
        -0.22,
        0,
        0,
      );
      break;
    }
  }
}

function nodeCoord(i: number, n: number) {
  return n <= 1 ? 0.5 : i / (n - 1);
}

export function seedGrowth(
  kind: Morphology,
  growth: Float32Array,
  nx: number,
  ny: number,
  nz: number,
) {
  growth.fill(0);
  let n = 0;
  for (let k = 0; k < nz; k++) {
    const z = nodeCoord(k, nz);
    for (let j = 0; j < ny; j++) {
      const y = nodeCoord(j, ny);
      for (let i = 0; i < nx; i++) {
        const x = nodeCoord(i, nx);
        let g = 0;
        if (kind === "protoplast") {
          const dx = x - 0.5;
          const dy = y - 0.5;
          const dz = z - 0.5;
          const r2 = dx * dx + dy * dy + dz * dz;
          g = r2 < 0.08 ? 0.12 : 0;
        } else if (kind === "budding") {
          const dx = x - 0.66;
          const dy = y - 0.56;
          const dz = z - 0.5;
          g = 1.7 * Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * 0.055 * 0.055));
        } else if (kind === "fission") {
          const band = Math.exp(-((x - 0.5) * (x - 0.5)) / (2 * 0.042 * 0.042));
          const poles = Math.max(0, Math.abs(x - 0.5) - 0.1) * 4;
          g = -1.35 * band + 0.55 * Math.min(1, poles);
        } else if (kind === "polar") {
          const dx = x - 0.5;
          const dy = y - 0.72;
          const dz = z - 0.5;
          g = 1.85 * Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * 0.07 * 0.07));
        } else if (kind === "blastula") {
          const dx = x - 0.5;
          const dy = y - 0.5;
          const dz = z - 0.5;
          const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
          g = Math.exp(-((r - 0.2) * (r - 0.2)) / (2 * 0.03 * 0.03)) * 0.7;
        } else {
          g = 0.18;
        }
        growth[n++] = g;
      }
    }
  }
}
