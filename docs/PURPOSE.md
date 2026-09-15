# Purpose

Morphogenesis Suite exists so a tri-coupled solver can be used, not merely watched. The original sketch was a GPU MAC–SPH–turgor loop with a mass invariant. This repository is the independent instrument:

- a TypeScript library of that loop
- a WebGL chamber that perturbs, checkpoints, and assays it
- a NumPy port for headless work

It is not a game and not a cell. Particles carry mass. The grid enforces incompressibility. Turgor steers form.

**Computational morphogenesis — no biological interpretation.**

## What to ask

Narrow questions. What a turgor pulse does to residual. Whether a painted growth cap buds. Whether a fission neck actually thins after sever. The run log is the memory of those questions.

## First session

1. Enter. Budding is seeded. Residual should fall. MASS OK should stay green.
2. Snapshot before every perturbation.
3. Inject, paint, erase, or probe.
4. Read residual (quiet) over kinetic (bright).
5. Run an assay. Log the answer.

`H` returns to this document in the lab. `?` lists keys.
