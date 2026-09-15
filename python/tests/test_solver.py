import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from morphogenesis.solver import MorphogenesisTriCoupledSolver, SolverParams  # noqa: E402


class SolverInvariants(unittest.TestCase):
    def setUp(self):
        self.solver = MorphogenesisTriCoupledSolver((10, 10, 10), 280)
        self.params = SolverParams(poisson_iters=8)

    def test_mass_is_n(self):
        self.solver.reseed("protoplast")
        for _ in range(12):
            self.solver.execute_physics_tick(1 / 48, self.params)
        s = self.solver.read_stats()
        self.assertEqual(s.particle_count, 280)
        self.assertAlmostEqual(s.lagrangian_mass, 280.0)
        self.assertTrue(s.conserved)
        self.assertLess(s.mass_drift / 280.0, 1e-3)

    def test_snapshot_restore(self):
        self.solver.reseed("budding")
        for _ in range(6):
            self.solver.execute_physics_tick(1 / 48, self.params)
        snap = self.solver.capture()
        tick = self.solver.tick_count
        pos = self.solver.positions.copy()
        for _ in range(5):
            self.solver.execute_physics_tick(1 / 48, self.params)
        self.solver.restore(snap)
        self.assertEqual(self.solver.tick_count, tick)
        self.assertTrue((self.solver.positions == pos).all())

    def test_sever_does_not_delete_mass(self):
        self.solver.reseed("fission")
        for _ in range(8):
            self.solver.execute_physics_tick(1 / 48, self.params)
        self.solver.sever()
        n = self.solver.n_particles
        for _ in range(12):
            self.solver.execute_physics_tick(1 / 48, self.params)
        self.assertEqual(self.solver.n_particles, n)
        self.assertTrue(self.solver.read_stats().conserved)

    def test_unknown_morphology(self):
        with self.assertRaises(ValueError):
            self.solver.reseed("not-a-seed")


if __name__ == "__main__":
    unittest.main()
