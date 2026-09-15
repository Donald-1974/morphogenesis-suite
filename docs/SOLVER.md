# Solver

`MorphogenesisTriCoupledSolver` is a collocated MAC + PIC/FLIP + Jacobi Poisson coupling.

## State

- Lagrangian: `sphPositions`, `sphVelocities` — N particles, unit mass each.
- Eulerian: `macUx/Y/Z`, `pressure`, `mass`, `growth` on an nx × ny × nz node grid.
- Control: growth field g. Turgor stiffness κ multiplies density error ρ − ρ₀(1+g).

## A tick

1. Cohesion — particles accelerate along ∇ρ (SPH-like surface analogue). If a cut is active, cohesion is attenuated in the neck and an opposing kick is applied.
2. Viscosity — velocity damping.
3. P2G — trilinear PIC scatter of mass and momentum onto the MAC grid.
4. Poisson turgor — Jacobi iterations of ∇²p = ∇·u/Δt + κ(ρ − ρ₀(1+g)), Dirichlet p=0 on the chamber wall, then u ← u − Δt ∇p.
5. G2P — FLIP/PIC mix back to particles.
6. Integrate — CFL clamp, bounce on the wall.
7. Mass assert — Lagrangian mass is N. Eulerian mass is the PIC scatter sum. Drift is reported, never silently repaired.

Particle count does not change. `sever` thins the neck; it does not delete mass.

## Snapshot

`capture` / `restore` copy positions, velocities, growth, pressure, MAC velocities, and tick diagnostics. Restore remaps P2G so Eulerian fields match.

## Quality

The lab picks grid and N from viewport. Headless callers pass `[nx,ny,nz]` and `maxParticles`.
