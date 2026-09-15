"""Headless assays.

    PYTHONPATH=python python -m morphogenesis --assay fission --ticks 40
"""

from __future__ import annotations

import argparse
import json

from .solver import MorphogenesisTriCoupledSolver, SolverParams


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Morphogenesis Suite — headless MAC–SPH–turgor solver. Computational only."
    )
    p.add_argument("--assay", choices=("fission", "pulse", "settle", "watch"), default="watch")
    p.add_argument("--morphology", default="budding")
    p.add_argument("--ticks", type=int, default=32)
    p.add_argument("--grid", type=int, default=12)
    p.add_argument("--particles", type=int, default=400)
    p.add_argument("--dt", type=float, default=1 / 48)
    args = p.parse_args(argv)

    solver = MorphogenesisTriCoupledSolver((args.grid, args.grid, args.grid), args.particles)
    params = SolverParams()
    seed = "fission" if args.assay == "fission" else args.morphology
    solver.reseed(seed)

    if args.assay == "pulse":
        c = solver.center_of_mass()
        solver.inject_at(float(c[0]), float(c[1]), float(c[2]))

    ticks = args.ticks
    if args.assay == "fission":
        for _ in range(min(64, ticks)):
            solver.execute_physics_tick(args.dt, params)
        solver.sever()
        for _ in range(min(80, max(1, ticks))):
            solver.execute_physics_tick(args.dt, params)
    else:
        for _ in range(ticks):
            solver.execute_physics_tick(args.dt, params)

    stats = solver.read_stats()
    print(
        json.dumps(
            {
                "assay": args.assay,
                "morphology": seed,
                "tick": stats.tick,
                "N": stats.particle_count,
                "lagrangian_mass": stats.lagrangian_mass,
                "eulerian_mass": stats.eulerian_mass,
                "mass_drift": stats.mass_drift,
                "conserved": stats.conserved,
                "residual": stats.poisson_residual,
                "kinetic": stats.kinetic,
                "max_div": stats.max_div,
                "neck": stats.neck_density,
                "cut_active": stats.cut_active,
            },
            indent=2,
        )
    )
    return 0 if stats.conserved else 1


if __name__ == "__main__":
    raise SystemExit(main())
