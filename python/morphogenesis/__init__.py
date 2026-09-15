"""NumPy port of MorphogenesisTriCoupledSolver.

Computational morphogenesis only — no biological interpretation.
"""

from .solver import MorphogenesisTriCoupledSolver, SolverParams, TickStats

__all__ = [
    "MorphogenesisTriCoupledSolver",
    "SolverParams",
    "TickStats",
]
__version__ = "0.1.0"
