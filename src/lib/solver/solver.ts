import { seedGrowth, seedParticles, type Morphology } from "./seeds";

export type ColorMode = "pressure" | "speed" | "density" | "growth";

export type SolverParams = {
  turgor: number;
  viscosity: number;
  cohesion: number;
  flipRatio: number;
  poissonIters: number;
};

export type TickStats = {
  tick: number;
  particleCount: number;
  lagrangianMass: number;
  eulerianMass: number;
  massDrift: number;
  maxDiv: number;
  poissonResidual: number;
  kinetic: number;
  pressureMin: number;
  pressureMax: number;
  maxSpeed: number;
  dtMs: number;
  conserved: boolean;
  neckDensity: number;
  cutActive: boolean;
};

export type ProbeSample = {
  x: number;
  y: number;
  z: number;
  pressure: number;
  density: number;
  growth: number;
  speed: number;
};

export type HistorySample = {
  tick: number;
  residual: number;
  maxDiv: number;
  kinetic: number;
  massDrift: number;
  neck: number;
};

export type SolverSnapshot = {
  positions: Float32Array;
  velocities: Float32Array;
  growth: Float32Array;
  pressure: Float32Array;
  macUx: Float32Array;
  macUy: Float32Array;
  macUz: Float32Array;
  tick: number;
  restDensity: number;
  cutTicks: number;
  cutAxis: number;
  cutOrigin: number;
  cutWidth: number;
  lastNeck: number;
  lastResidual: number;
  lastKinetic: number;
  lastMaxDiv: number;
  lastEulerianMass: number;
  lastPressureMin: number;
  lastPressureMax: number;
  lastMaxSpeed: number;
  lastMassDrift: number;
};

function quality() {
  if (typeof window === "undefined") {
    return { nx: 16, particles: 1600 };
  }
  const w = window.innerWidth;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (w < 520) return { nx: 12, particles: 900 };
  if (w * dpr > 1700) return { nx: 18, particles: 2400 };
  return { nx: 16, particles: 1700 };
}

/**
 * Browser port of MorphogenesisTriCoupledSolver.
 *
 * Layout matches the source sketch: collocated MAC velocity on a node grid
 * (nx, ny, nz, 3), Lagrangian SPH particles, Poisson turgor projection.
 * P2G / Poisson / G2P were stubs in the original — they are implemented here.
 */
export class MorphogenesisTriCoupledSolver {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly nCells: number;
  readonly nParticles: number;
  readonly dx: number;
  readonly invariantMass = 1;
  totalInitialMass: number;

  /** Lagrangian SPH */
  readonly sphPositions: Float32Array;
  readonly sphVelocities: Float32Array;

  /** Eulerian MAC (collocated, matching grid_res + (3,)) */
  readonly pressure: Float32Array;
  readonly macUx: Float32Array;
  readonly macUy: Float32Array;
  readonly macUz: Float32Array;

  readonly mass: Float32Array;
  readonly growth: Float32Array;
  readonly rhs: Float32Array;
  readonly div: Float32Array;
  readonly pNew: Float32Array;
  readonly uxOld: Float32Array;
  readonly uyOld: Float32Array;
  readonly uzOld: Float32Array;
  readonly dGx: Float32Array;
  readonly dGy: Float32Array;
  readonly dGz: Float32Array;

  restDensity = 1;
  tickCount = 0;
  lastDtMs = 0;
  lastMaxDiv = 0;
  lastResidual = 0;
  lastEulerianMass = 0;
  lastKinetic = 0;
  lastPressureMin = 0;
  lastPressureMax = 0;
  lastMaxSpeed = 0;
  lastMassDrift = 0;
  lastNeck = 0;
  cutAxis = 0;
  cutOrigin = 0.5;
  cutWidth = 0.06;
  cutTicks = 0;

  constructor(gridRes?: [number, number, number], maxParticles?: number) {
    const q = quality();
    const nx = gridRes?.[0] ?? q.nx;
    const ny = gridRes?.[1] ?? q.nx;
    const nz = gridRes?.[2] ?? q.nx;
    const nP = maxParticles ?? q.particles;
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    this.nCells = nx * ny * nz;
    this.nParticles = nP;
    this.dx = nx <= 1 ? 1 : 1 / (nx - 1);
    this.sphPositions = new Float32Array(nP * 3);
    this.sphVelocities = new Float32Array(nP * 3);
    this.pressure = new Float32Array(this.nCells);
    this.macUx = new Float32Array(this.nCells);
    this.macUy = new Float32Array(this.nCells);
    this.macUz = new Float32Array(this.nCells);
    this.mass = new Float32Array(this.nCells);
    this.growth = new Float32Array(this.nCells);
    this.rhs = new Float32Array(this.nCells);
    this.div = new Float32Array(this.nCells);
    this.pNew = new Float32Array(this.nCells);
    this.uxOld = new Float32Array(this.nCells);
    this.uyOld = new Float32Array(this.nCells);
    this.uzOld = new Float32Array(this.nCells);
    this.dGx = new Float32Array(this.nCells);
    this.dGy = new Float32Array(this.nCells);
    this.dGz = new Float32Array(this.nCells);
    this.totalInitialMass = nP * this.invariantMass;
  }

  idx(i: number, j: number, k: number) {
    return i + this.nx * (j + this.ny * k);
  }

  reseed(kind: Morphology) {
    seedParticles(kind, this.sphPositions, this.sphVelocities, this.nParticles);
    seedGrowth(kind, this.growth, this.nx, this.ny, this.nz);
    this.pressure.fill(0);
    this.macUx.fill(0);
    this.macUy.fill(0);
    this.macUz.fill(0);
    this.tickCount = 0;
    this.cutTicks = 0;
    this.lastNeck = 0;
    this.totalInitialMass = this.nParticles * this.invariantMass;
    this.mapParticlesToGrid();
    this.calibrateRestDensity();
    this.validateMassConservation();
  }

  calibrateRestDensity() {
    let s = 0;
    let c = 0;
    for (let i = 0; i < this.nCells; i++) {
      const m = this.mass[i]!;
      if (m > 0.08) {
        s += m;
        c += 1;
      }
    }
    this.restDensity = c > 0 ? s / c : 1;
  }

  executePhysicsTick(dt: number, params: SolverParams) {
    const t0 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    this.applyCohesion(dt, params.cohesion);
    this.applyViscosity(params.viscosity);
    this.mapParticlesToGrid();
    this.solvePoissonTensor(dt, params);
    this.mapGridToParticles(params.flipRatio);
    this.integratePositions(dt);
    this.validateMassConservation();
    if (this.cutTicks > 0) this.cutTicks -= 1;
    this.tickCount += 1;
    const t1 =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    this.lastDtMs = t1 - t0;
  }

  /**
   * SPH-like cohesion via the Eulerian density gradient (MAC–SPH bridge).
   * Particles accelerate toward higher density — a cheap surface-tension analogue.
   */
  applyCohesion(dt: number, cohesion: number) {
    const pos = this.sphPositions;
    const vel = this.sphVelocities;
    const n = this.nParticles;
    const cutting = this.cutTicks > 0;
    const ax = this.cutAxis;
    const origin = this.cutOrigin;
    const width = this.cutWidth;
    if (cutting) {
      for (let p = 0; p < n; p++) {
        const coord = pos[p * 3 + ax]!;
        const sep = 0.012 * (this.cutTicks / 96);
        vel[p * 3 + ax] += coord < origin ? -sep : sep;
      }
    }
    if (cohesion <= 0) return;
    this.computeDensityGradient();
    const k = cohesion * dt;
    for (let p = 0; p < n; p++) {
      const x = pos[p * 3]!;
      const y = pos[p * 3 + 1]!;
      const z = pos[p * 3 + 2]!;
      let atten = 1;
      if (cutting) {
        const coord = ax === 0 ? x : ax === 1 ? y : z;
        const d = Math.abs(coord - origin);
        atten = d < width ? 0 : Math.min(1, (d - width) / width);
      }
      if (atten <= 0) continue;
      const gx = this.sampleField(this.dGx, x, y, z);
      const gy = this.sampleField(this.dGy, x, y, z);
      const gz = this.sampleField(this.dGz, x, y, z);
      vel[p * 3] += gx * k * atten;
      vel[p * 3 + 1] += gy * k * atten;
      vel[p * 3 + 2] += gz * k * atten;
    }
  }

  applyViscosity(viscosity: number) {
    if (viscosity <= 0) return;
    const damp = 1 - Math.min(0.6, viscosity);
    const vel = this.sphVelocities;
    for (let i = 0; i < vel.length; i++) vel[i] *= damp;
  }

  /** Transfer Lagrangian SPH momentum onto the Eulerian MAC grid (PIC scatter). */
  mapParticlesToGrid() {
    const { nCells, nParticles, invariantMass } = this;
    const mass = this.mass;
    const ux = this.macUx;
    const uy = this.macUy;
    const uz = this.macUz;
    mass.fill(0);
    ux.fill(0);
    uy.fill(0);
    uz.fill(0);

    const pos = this.sphPositions;
    const vel = this.sphVelocities;
    const nx = this.nx;
    const ny = this.ny;
    const nz = this.nz;

    for (let p = 0; p < nParticles; p++) {
      const [i0, tx, j0, ty, k0, tz] = this.stencil(
        pos[p * 3]!,
        pos[p * 3 + 1]!,
        pos[p * 3 + 2]!,
      );
      const vx = vel[p * 3]!;
      const vy = vel[p * 3 + 1]!;
      const vz = vel[p * 3 + 2]!;
      const i1 = i0 + 1;
      const j1 = j0 + 1;
      const k1 = k0 + 1;
      const w000 = (1 - tx) * (1 - ty) * (1 - tz);
      const w100 = tx * (1 - ty) * (1 - tz);
      const w010 = (1 - tx) * ty * (1 - tz);
      const w110 = tx * ty * (1 - tz);
      const w001 = (1 - tx) * (1 - ty) * tz;
      const w101 = tx * (1 - ty) * tz;
      const w011 = (1 - tx) * ty * tz;
      const w111 = tx * ty * tz;
      this.scatter(i0, j0, k0, w000, invariantMass, vx, vy, vz);
      this.scatter(i1, j0, k0, w100, invariantMass, vx, vy, vz);
      this.scatter(i0, j1, k0, w010, invariantMass, vx, vy, vz);
      this.scatter(i1, j1, k0, w110, invariantMass, vx, vy, vz);
      this.scatter(i0, j0, k1, w001, invariantMass, vx, vy, vz);
      this.scatter(i1, j0, k1, w101, invariantMass, vx, vy, vz);
      this.scatter(i0, j1, k1, w011, invariantMass, vx, vy, vz);
      this.scatter(i1, j1, k1, w111, invariantMass, vx, vy, vz);
    }

    let eul = 0;
    for (let i = 0; i < nCells; i++) {
      const m = mass[i]!;
      eul += m;
      if (m > 1e-8) {
        ux[i] /= m;
        uy[i] /= m;
        uz[i] /= m;
      } else {
        ux[i] = 0;
        uy[i] = 0;
        uz[i] = 0;
      }
    }
    this.lastEulerianMass = eul;
    void nx;
    void ny;
    void nz;
  }

  private scatter(
    i: number,
    j: number,
    k: number,
    w: number,
    m: number,
    vx: number,
    vy: number,
    vz: number,
  ) {
    if (w <= 0) return;
    const id = this.idx(i, j, k);
    const wm = w * m;
    this.mass[id] += wm;
    this.macUx[id] += wm * vx;
    this.macUy[id] += wm * vy;
    this.macUz[id] += wm * vz;
  }

  /**
   * Poisson solve for incompressibility + turgor.
   * ∇²p = ∇·u / dt + κ (ρ − ρ₀(1+g)). Then u ← u − dt ∇p.
   */
  solvePoissonTensor(dt: number, params: SolverParams) {
    const { nx, ny, nz, dx } = this;
    const ux = this.macUx;
    const uy = this.macUy;
    const uz = this.macUz;
    this.uxOld.set(ux);
    this.uyOld.set(uy);
    this.uzOld.set(uz);

    const inv2dx = 1 / (2 * dx);
    const dx2 = dx * dx;
    const rest = this.restDensity;
    const stiff = params.turgor;
    const invDt = 1 / Math.max(dt, 1e-6);

    let maxDiv = 0;
    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const id = this.idx(i, j, k);
          const div =
            (ux[this.idx(i + 1, j, k)]! - ux[this.idx(i - 1, j, k)]!) * inv2dx +
            (uy[this.idx(i, j + 1, k)]! - uy[this.idx(i, j - 1, k)]!) * inv2dx +
            (uz[this.idx(i, j, k + 1)]! - uz[this.idx(i, j, k - 1)]!) * inv2dx;
          this.div[id] = div;
          if (div > maxDiv || -div > maxDiv) maxDiv = Math.abs(div);
          const densErr = this.mass[id]! - rest * (1 + this.growth[id]!);
          this.rhs[id] = div * invDt + stiff * densErr / (rest + 1e-4);
        }
      }
    }
    this.lastMaxDiv = maxDiv;

    const p = this.pressure;
    const pNew = this.pNew;
    const iters = Math.max(4, Math.min(28, params.poissonIters | 0));
    let residual = 0;
    for (let it = 0; it < iters; it++) {
      residual = 0;
      for (let k = 1; k < nz - 1; k++) {
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            const id = this.idx(i, j, k);
            const sum =
              p[this.idx(i - 1, j, k)]! +
              p[this.idx(i + 1, j, k)]! +
              p[this.idx(i, j - 1, k)]! +
              p[this.idx(i, j + 1, k)]! +
              p[this.idx(i, j, k - 1)]! +
              p[this.idx(i, j, k + 1)]!;
            const next = (sum - this.rhs[id]! * dx2) / 6;
            const diff = next - p[id]!;
            if (diff > residual || -diff > residual) residual = Math.abs(diff);
            pNew[id] = next;
          }
        }
      }
      // Dirichlet p=0 on the chamber wall.
      for (let k = 0; k < nz; k++) {
        for (let j = 0; j < ny; j++) {
          pNew[this.idx(0, j, k)] = 0;
          pNew[this.idx(nx - 1, j, k)] = 0;
        }
      }
      for (let k = 0; k < nz; k++) {
        for (let i = 0; i < nx; i++) {
          pNew[this.idx(i, 0, k)] = 0;
          pNew[this.idx(i, ny - 1, k)] = 0;
        }
      }
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          pNew[this.idx(i, j, 0)] = 0;
          pNew[this.idx(i, j, nz - 1)] = 0;
        }
      }
      p.set(pNew);
    }
    this.lastResidual = residual;

    let pMin = Infinity;
    let pMax = -Infinity;
    for (let i = 0; i < this.nCells; i++) {
      const pv = p[i]!;
      if (pv < pMin) pMin = pv;
      if (pv > pMax) pMax = pv;
    }
    this.lastPressureMin = pMin === Infinity ? 0 : pMin;
    this.lastPressureMax = pMax === -Infinity ? 0 : pMax;

    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const id = this.idx(i, j, k);
          ux[id] -=
            dt * (p[this.idx(i + 1, j, k)]! - p[this.idx(i - 1, j, k)]!) * inv2dx;
          uy[id] -=
            dt * (p[this.idx(i, j + 1, k)]! - p[this.idx(i, j - 1, k)]!) * inv2dx;
          uz[id] -=
            dt * (p[this.idx(i, j, k + 1)]! - p[this.idx(i, j, k - 1)]!) * inv2dx;
        }
      }
    }
    this.enforceWallVelocity();
  }

  enforceWallVelocity() {
    const { nx, ny, nz } = this;
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        this.macUx[this.idx(0, j, k)] = 0;
        this.macUx[this.idx(nx - 1, j, k)] = 0;
      }
    }
    for (let k = 0; k < nz; k++) {
      for (let i = 0; i < nx; i++) {
        this.macUy[this.idx(i, 0, k)] = 0;
        this.macUy[this.idx(i, ny - 1, k)] = 0;
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        this.macUz[this.idx(i, j, 0)] = 0;
        this.macUz[this.idx(i, j, nz - 1)] = 0;
      }
    }
  }

  /** FLIP/PIC interpolate divergence-free grid velocity back to particles. */
  mapGridToParticles(flipRatio: number) {
    const pos = this.sphPositions;
    const vel = this.sphVelocities;
    const n = this.nParticles;
    const flip = Math.min(1, Math.max(0, flipRatio));
    const pic = 1 - flip;
    for (let p = 0; p < n; p++) {
      const x = pos[p * 3]!;
      const y = pos[p * 3 + 1]!;
      const z = pos[p * 3 + 2]!;
      const gux = this.sampleField(this.macUx, x, y, z);
      const guy = this.sampleField(this.macUy, x, y, z);
      const guz = this.sampleField(this.macUz, x, y, z);
      const dux = gux - this.sampleField(this.uxOld, x, y, z);
      const duy = guy - this.sampleField(this.uyOld, x, y, z);
      const duz = guz - this.sampleField(this.uzOld, x, y, z);
      const vx = pic * gux + flip * (vel[p * 3]! + dux);
      const vy = pic * guy + flip * (vel[p * 3 + 1]! + duy);
      const vz = pic * guz + flip * (vel[p * 3 + 2]! + duz);
      vel[p * 3] = vx;
      vel[p * 3 + 1] = vy;
      vel[p * 3 + 2] = vz;
    }
  }

  integratePositions(dt: number) {
    const pos = this.sphPositions;
    const vel = this.sphVelocities;
    const n = this.nParticles;
    const lo = this.dx * 1.05;
    const hi = 1 - lo;
    const rest = 0.18;
    const vmax = 0.42 * this.dx / Math.max(dt, 1e-6);
    const vmax2 = vmax * vmax;
    for (let p = 0; p < n; p++) {
      let vx = vel[p * 3]!;
      let vy = vel[p * 3 + 1]!;
      let vz = vel[p * 3 + 2]!;
      const sp2 = vx * vx + vy * vy + vz * vz;
      if (sp2 > vmax2) {
        const s = vmax / Math.sqrt(sp2);
        vx *= s;
        vy *= s;
        vz *= s;
        vel[p * 3] = vx;
        vel[p * 3 + 1] = vy;
        vel[p * 3 + 2] = vz;
      }
      let x = pos[p * 3]! + vx * dt;
      let y = pos[p * 3 + 1]! + vy * dt;
      let z = pos[p * 3 + 2]! + vz * dt;
      if (x < lo) {
        x = lo;
        vel[p * 3] = Math.abs(vx) * rest;
      } else if (x > hi) {
        x = hi;
        vel[p * 3] = -Math.abs(vx) * rest;
      }
      if (y < lo) {
        y = lo;
        vel[p * 3 + 1] = Math.abs(vy) * rest;
      } else if (y > hi) {
        y = hi;
        vel[p * 3 + 1] = -Math.abs(vy) * rest;
      }
      if (z < lo) {
        z = lo;
        vel[p * 3 + 2] = Math.abs(vz) * rest;
      } else if (z > hi) {
        z = hi;
        vel[p * 3 + 2] = -Math.abs(vz) * rest;
      }
      pos[p * 3] = x;
      pos[p * 3 + 1] = y;
      pos[p * 3 + 2] = z;
    }
    let maxSpeed = 0;
    let kinetic = 0;
    for (let p = 0; p < n; p++) {
      const vx = vel[p * 3]!;
      const vy = vel[p * 3 + 1]!;
      const vz = vel[p * 3 + 2]!;
      const sp2 = vx * vx + vy * vy + vz * vz;
      if (sp2 > maxSpeed) maxSpeed = sp2;
      kinetic += 0.5 * this.invariantMass * sp2;
    }
    this.lastMaxSpeed = Math.sqrt(maxSpeed);
    this.lastKinetic = kinetic;
  }

  validateMassConservation() {
    const current = this.nParticles * this.invariantMass;
    const drift = Math.abs(this.totalInitialMass - current);
    const mapped = Math.abs(this.lastEulerianMass - current);
    this.lastMassDrift = Math.max(drift, mapped);
  }

  injectTurgorPulse() {
    const [cx, cy, cz] = this.centerOfMass();
    this.injectAt(cx, cy, cz);
  }

  centerOfMass(): [number, number, number] {
    let cx = 0;
    let cy = 0;
    let cz = 0;
    const n = this.nParticles;
    for (let p = 0; p < n; p++) {
      cx += this.sphPositions[p * 3]!;
      cy += this.sphPositions[p * 3 + 1]!;
      cz += this.sphPositions[p * 3 + 2]!;
    }
    return [cx / n, cy / n, cz / n];
  }

  addGrowth(cx: number, cy: number, cz: number, amp: number, sig: number) {
    const x0 = clamp01(cx);
    const y0 = clamp01(cy);
    const z0 = clamp01(cz);
    const inv = 1 / (2 * sig * sig);
    let t = 0;
    for (let k = 0; k < this.nz; k++) {
      const z = this.nz <= 1 ? 0.5 : k / (this.nz - 1);
      const dz = z - z0;
      for (let j = 0; j < this.ny; j++) {
        const y = this.ny <= 1 ? 0.5 : j / (this.ny - 1);
        const dy = y - y0;
        for (let i = 0; i < this.nx; i++) {
          const x = this.nx <= 1 ? 0.5 : i / (this.nx - 1);
          const d2 = (x - x0) ** 2 + dy * dy + dz * dz;
          let g = this.growth[t]! + amp * Math.exp(-d2 * inv);
          if (g > 3.5) g = 3.5;
          else if (g < -2.5) g = -2.5;
          this.growth[t] = g;
          t += 1;
        }
      }
    }
  }

  paintAt(cx: number, cy: number, cz: number, amp = 0.55, sig = 0.07) {
    this.addGrowth(cx, cy, cz, amp, sig);
  }

  injectAt(cx: number, cy: number, cz: number, amp = 1.15, sig = 0.08) {
    this.addGrowth(cx, cy, cz, amp, sig);
    const x0 = clamp01(cx);
    const y0 = clamp01(cy);
    const z0 = clamp01(cz);
    const vel = this.sphVelocities;
    const pos = this.sphPositions;
    const n = this.nParticles;
    for (let p = 0; p < n; p++) {
      const dx = pos[p * 3]! - x0;
      const dy = pos[p * 3 + 1]! - y0;
      const dz = pos[p * 3 + 2]! - z0;
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
      const kick = 0.16 * Math.exp(-(r * r) / (2 * sig * sig));
      vel[p * 3] += (dx / r) * kick;
      vel[p * 3 + 1] += (dy / r) * kick;
      vel[p * 3 + 2] += (dz / r) * kick;
    }
  }

  capture(): SolverSnapshot {
    return {
      positions: this.sphPositions.slice(),
      velocities: this.sphVelocities.slice(),
      growth: this.growth.slice(),
      pressure: this.pressure.slice(),
      macUx: this.macUx.slice(),
      macUy: this.macUy.slice(),
      macUz: this.macUz.slice(),
      tick: this.tickCount,
      restDensity: this.restDensity,
      cutTicks: this.cutTicks,
      cutAxis: this.cutAxis,
      cutOrigin: this.cutOrigin,
      cutWidth: this.cutWidth,
      lastNeck: this.lastNeck,
      lastResidual: this.lastResidual,
      lastKinetic: this.lastKinetic,
      lastMaxDiv: this.lastMaxDiv,
      lastEulerianMass: this.lastEulerianMass,
      lastPressureMin: this.lastPressureMin,
      lastPressureMax: this.lastPressureMax,
      lastMaxSpeed: this.lastMaxSpeed,
      lastMassDrift: this.lastMassDrift,
    };
  }

  restore(snap: SolverSnapshot) {
    this.sphPositions.set(snap.positions);
    this.sphVelocities.set(snap.velocities);
    this.growth.set(snap.growth);
    this.pressure.set(snap.pressure);
    this.macUx.set(snap.macUx);
    this.macUy.set(snap.macUy);
    this.macUz.set(snap.macUz);
    this.tickCount = snap.tick;
    this.restDensity = snap.restDensity;
    this.cutTicks = snap.cutTicks;
    this.cutAxis = snap.cutAxis;
    this.cutOrigin = snap.cutOrigin;
    this.cutWidth = snap.cutWidth;
    this.lastNeck = snap.lastNeck;
    this.lastResidual = snap.lastResidual;
    this.lastKinetic = snap.lastKinetic;
    this.lastMaxDiv = snap.lastMaxDiv;
    this.lastEulerianMass = snap.lastEulerianMass;
    this.lastPressureMin = snap.lastPressureMin;
    this.lastPressureMax = snap.lastPressureMax;
    this.lastMaxSpeed = snap.lastMaxSpeed;
    this.lastMassDrift = snap.lastMassDrift;
    this.mapParticlesToGrid();
    this.validateMassConservation();
  }

  principalAxis(): 0 | 1 | 2 {
    const [cx, cy, cz] = this.centerOfMass();
    let vx = 0;
    let vy = 0;
    let vz = 0;
    const n = this.nParticles;
    for (let p = 0; p < n; p++) {
      const dx = this.sphPositions[p * 3]! - cx;
      const dy = this.sphPositions[p * 3 + 1]! - cy;
      const dz = this.sphPositions[p * 3 + 2]! - cz;
      vx += dx * dx;
      vy += dy * dy;
      vz += dz * dz;
    }
    if (vx >= vy && vx >= vz) return 0;
    if (vy >= vz) return 1;
    return 2;
  }

  /** Constriction plane through the mass, then opposing kick. N is unchanged. */
  sever(axis?: 0 | 1 | 2) {
    const ax = axis ?? this.principalAxis();
    const com = this.centerOfMass();
    const origin = com[ax]!;
    this.cutAxis = ax;
    this.cutOrigin = origin;
    this.cutWidth = 0.06;
    this.cutTicks = 96;
    const w = this.cutWidth;
    let t = 0;
    for (let k = 0; k < this.nz; k++) {
      const z = this.nz <= 1 ? 0.5 : k / (this.nz - 1);
      for (let j = 0; j < this.ny; j++) {
        const y = this.ny <= 1 ? 0.5 : j / (this.ny - 1);
        for (let i = 0; i < this.nx; i++) {
          const x = this.nx <= 1 ? 0.5 : i / (this.nx - 1);
          const coord = ax === 0 ? x : ax === 1 ? y : z;
          const d = coord - origin;
          this.growth[t] -= 2.1 * Math.exp(-(d * d) / (2 * w * w));
          t += 1;
        }
      }
    }
    const kick = 0.26;
    const pos = this.sphPositions;
    const vel = this.sphVelocities;
    const n = this.nParticles;
    for (let p = 0; p < n; p++) {
      const coord = pos[p * 3 + ax]!;
      vel[p * 3 + ax] += coord < origin ? -kick : kick;
    }
    this.lastNeck = this.neckDensity();
  }

  neckDensity() {
    const ax = this.cutAxis;
    const origin = this.cutOrigin;
    const w = this.cutWidth * 1.2;
    let s = 0;
    let c = 0;
    let t = 0;
    for (let k = 0; k < this.nz; k++) {
      const z = this.nz <= 1 ? 0.5 : k / (this.nz - 1);
      for (let j = 0; j < this.ny; j++) {
        const y = this.ny <= 1 ? 0.5 : j / (this.ny - 1);
        for (let i = 0; i < this.nx; i++) {
          const x = this.nx <= 1 ? 0.5 : i / (this.nx - 1);
          const coord = ax === 0 ? x : ax === 1 ? y : z;
          if (Math.abs(coord - origin) <= w) {
            s += this.mass[t]!;
            c += 1;
          }
          t += 1;
        }
      }
    }
    this.lastNeck = c > 0 ? s / c : 0;
    return this.lastNeck;
  }

  probeAt(x: number, y: number, z: number): ProbeSample {
    const px = clamp01(x);
    const py = clamp01(y);
    const pz = clamp01(z);
    const ux = this.sampleField(this.macUx, px, py, pz);
    const uy = this.sampleField(this.macUy, px, py, pz);
    const uz = this.sampleField(this.macUz, px, py, pz);
    return {
      x: px,
      y: py,
      z: pz,
      pressure: this.sampleField(this.pressure, px, py, pz),
      density: this.sampleField(this.mass, px, py, pz),
      growth: this.sampleField(this.growth, px, py, pz),
      speed: Math.sqrt(ux * ux + uy * uy + uz * uz),
    };
  }

  sampleScalar(mode: ColorMode, p: number): number {
    const x = this.sphPositions[p * 3]!;
    const y = this.sphPositions[p * 3 + 1]!;
    const z = this.sphPositions[p * 3 + 2]!;
    if (mode === "speed") {
      const vx = this.sphVelocities[p * 3]!;
      const vy = this.sphVelocities[p * 3 + 1]!;
      const vz = this.sphVelocities[p * 3 + 2]!;
      return Math.sqrt(vx * vx + vy * vy + vz * vz);
    }
    if (mode === "density") return this.sampleField(this.mass, x, y, z);
    if (mode === "growth") return this.sampleField(this.growth, x, y, z);
    return this.sampleField(this.pressure, x, y, z);
  }

  colorScale(mode: ColorMode): { lo: number; hi: number } {
    if (mode === "speed") return { lo: 0, hi: Math.max(0.05, this.lastMaxSpeed) };
    if (mode === "density") {
      return { lo: 0, hi: Math.max(0.2, this.restDensity * 1.8) };
    }
    if (mode === "growth") return { lo: -0.4, hi: 1.6 };
    const span = Math.max(
      0.05,
      Math.max(Math.abs(this.lastPressureMin), Math.abs(this.lastPressureMax)),
    );
    return { lo: -span, hi: span };
  }

  slicePressure(k: number, out: Uint8Array) {
    const { nx, ny, nz } = this;
    const kk = Math.max(0, Math.min(nz - 1, k | 0));
    const lo = this.lastPressureMin;
    const hi = this.lastPressureMax;
    const span = Math.max(1e-6, hi - lo);
    let t = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v = (this.pressure[this.idx(i, j, kk)]! - lo) / span;
        const x = v < 0 ? 0 : v > 1 ? 1 : v;
        // packed later by the renderer using packRgb
        out[t++] = Math.round(x * 255);
      }
    }
  }

  readStats(): TickStats {
    const lag = this.nParticles * this.invariantMass;
    const drift = this.lastMassDrift;
    return {
      tick: this.tickCount,
      particleCount: this.nParticles,
      lagrangianMass: lag,
      eulerianMass: this.lastEulerianMass,
      massDrift: drift,
      maxDiv: this.lastMaxDiv,
      poissonResidual: this.lastResidual,
      kinetic: this.lastKinetic,
      pressureMin: this.lastPressureMin,
      pressureMax: this.lastPressureMax,
      maxSpeed: this.lastMaxSpeed,
      dtMs: this.lastDtMs,
      conserved: drift / Math.max(lag, 1) < 1e-3,
      neckDensity: this.cutTicks > 0 ? this.neckDensity() : this.lastNeck,
      cutActive: this.cutTicks > 0,
    };
  }

  private computeDensityGradient() {
    const { nx, ny, nz, dx } = this;
    const inv2dx = 1 / (2 * dx);
    const m = this.mass;
    this.dGx.fill(0);
    this.dGy.fill(0);
    this.dGz.fill(0);
    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const id = this.idx(i, j, k);
          this.dGx[id] =
            (m[this.idx(i + 1, j, k)]! - m[this.idx(i - 1, j, k)]!) * inv2dx;
          this.dGy[id] =
            (m[this.idx(i, j + 1, k)]! - m[this.idx(i, j - 1, k)]!) * inv2dx;
          this.dGz[id] =
            (m[this.idx(i, j, k + 1)]! - m[this.idx(i, j, k - 1)]!) * inv2dx;
        }
      }
    }
  }

  private stencil(x: number, y: number, z: number) {
    const gx = x * (this.nx - 1);
    const gy = y * (this.ny - 1);
    const gz = z * (this.nz - 1);
    const i0 = Math.min(this.nx - 2, Math.max(0, Math.floor(gx)));
    const j0 = Math.min(this.ny - 2, Math.max(0, Math.floor(gy)));
    const k0 = Math.min(this.nz - 2, Math.max(0, Math.floor(gz)));
    return [
      i0,
      Math.min(1, Math.max(0, gx - i0)),
      j0,
      Math.min(1, Math.max(0, gy - j0)),
      k0,
      Math.min(1, Math.max(0, gz - k0)),
    ] as const;
  }

  sampleField(field: Float32Array, x: number, y: number, z: number) {
    const [i0, tx, j0, ty, k0, tz] = this.stencil(x, y, z);
    const i1 = i0 + 1;
    const j1 = j0 + 1;
    const k1 = k0 + 1;
    const c000 = field[this.idx(i0, j0, k0)]!;
    const c100 = field[this.idx(i1, j0, k0)]!;
    const c010 = field[this.idx(i0, j1, k0)]!;
    const c110 = field[this.idx(i1, j1, k0)]!;
    const c001 = field[this.idx(i0, j0, k1)]!;
    const c101 = field[this.idx(i1, j0, k1)]!;
    const c011 = field[this.idx(i0, j1, k1)]!;
    const c111 = field[this.idx(i1, j1, k1)]!;
    const c00 = c000 * (1 - tx) + c100 * tx;
    const c10 = c010 * (1 - tx) + c110 * tx;
    const c01 = c001 * (1 - tx) + c101 * tx;
    const c11 = c011 * (1 - tx) + c111 * tx;
    const c0 = c00 * (1 - ty) + c10 * ty;
    const c1 = c01 * (1 - ty) + c11 * ty;
    return c0 * (1 - tz) + c1 * tz;
  }
}

export function visualRadius(n: number) {
  return 0.0155 * Math.sqrt(1700 / Math.max(400, n));
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
