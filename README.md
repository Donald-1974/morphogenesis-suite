# Morphogenesis Suite

**MAC–SPH–turgor tri-coupled solver · interactive lab · assay protocols**

> Particles carry mass. The grid enforces incompressibility. Turgor steers form.

An independent computational-morphogenesis instrument. Lagrangian SPH particles, a collocated MAC grid, and a Jacobi Poisson turgor projection share one mass invariant. You seed a morphology, write the growth field, run a named assay, and keep the numbers.

**Computational morphogenesis only — no biological interpretation.**

Originating Architect: **Sai Genoa (Genoa Page)** · ACGC Laboratories LLC

---

## What this is

Not a cell simulator and not a game. A tri-coupled loop you can perturb:

| Layer | Role |
|---|---|
| Lagrangian SPH | Particles carry unit mass and momentum |
| Eulerian MAC | PIC scatter / FLIP gather on a collocated node grid |
| Poisson turgor | ∇2p = ∇·u / Δt + κ(ρ − ρ0(1+g)) then u ← u − Δt ∇p |

Growth g is the morphogenetic control. Paint it, pulse it, or sever a neck. Residual, kinetic energy, mass drift, and neck density are the readout.

Two runtimes, one coupling:

- **Lab** — TypeScript + WebGL chamber (this repo’s app)
- **Solver** — the same coupling as a headless library, plus a NumPy port under `python/`

---

## Quick start — lab

```bash
git clone https://github.com/Donald-1974/morphogenesis-suite.git
cd morphogenesis-suite
npm install
npm run dev
```

Enter the chamber. Budding is already seeded. Residual should fall. **MASS OK** should stay green. That is the unperturbed baseline.

```bash
npm test          # solver invariants (NumPy)
npm run typecheck
npm run build
```

## Quick start — Python solver

```bash
pip install numpy
PYTHONPATH=python python -m morphogenesis --assay fission --ticks 40
PYTHONPATH=python python -m unittest discover -s python/tests -v
```

---

## First session

1. **Watch.** Let budding run. Residual quiet, mass conserved.
2. **Snapshot** (`S`). Restore (`L`) returns to that exact tick.
3. **Perturb.** Inject (`I`) a turgor pulse, paint (`G`) / erase (`X`) growth, probe (`P`) a live sample of p, ρ, g, |v|.
4. **Assay.** `F` runs fission: elongate 64 · sever · split 80 · log.
5. **Log.** `D` writes residual, kinetic, mass drift, and neck density. Last twelve persist in the browser. `E` exports CSV.

`H` purpose · `?` keys · `Esc` abort.

---

## Repository

```
src/lib/solver/     TypeScript coupling (library)
src/components/lab  Interactive chamber
src/store/          Bench state
python/             NumPy port of the same coupling
docs/               Purpose, solver, protocols
tests/              Invariant tests
```

Import the solver without the chamber:

```ts
import {
  MorphogenesisTriCoupledSolver,
} from "@acgc/morphogenesis-suite/solver";

const solver = new MorphogenesisTriCoupledSolver([16, 16, 16], 800);
solver.reseed("fission");
solver.executePhysicsTick(1 / 48, {
  turgor: 2.2,
  viscosity: 0.1,
  cohesion: 1.8,
  flipRatio: 0.9,
  poissonIters: 16,
});
console.log(solver.readStats());
```

---

## Morphologies and protocols

| Seed | What it sets up |
|---|---|
| Protoplast | Spherical mass, uniform interior turgor |
| Budding | Localized turgor on one flank |
| Fission | Equatorial constriction, polar expansion |
| Polar | Tip growth on the +Y cap |
| Blastula | Hollow shell, cortex under turgor |
| Dual | Two approaching masses |

| Protocol | Sequence |
|---|---|
| Fission assay | Seed fission → elongate 64 → sever → split 80 → log |
| Pulse response | Turgor pulse at COM → relax 64 |
| Settle | Hold 48 ticks, log residual and mass |

Particle count N is invariant. Sever thins the neck; it does not delete mass.

---

## Limits

- Browser grid is 12³–18³ and ~900–2400 particles. The Python port takes an explicit resolution.
- Poisson is Jacobi, not multigrid. Residual is a diagnostic, not a proof of uniqueness.
- Mass is conserved by construction (N fixed). Eulerian drift is the PIC scatter residual, not a leak.
- This is not tissue, not a cell, not a claim about biology.

Full notes: [docs/PURPOSE.md](docs/PURPOSE.md), [docs/SOLVER.md](docs/SOLVER.md), [docs/PROTOCOLS.md](docs/PROTOCOLS.md).

---

## Citation

```
Page, G. (Sai Genoa). (2026). Morphogenesis Suite (Version 0.1.0) [Computer software].
ACGC Laboratories LLC. https://github.com/Donald-1974/morphogenesis-suite
```

Or use `CITATION.cff`.

---

## License and IP

**Core framework** is MIT for research, education, and non-commercial experimentation.

For enterprise deployment, proprietary extensions, or integration into commercial products, contact the Originating Architect through **ACGC Laboratories LLC**.

---

*Independent suite. Not a Grok App Builder export.*
