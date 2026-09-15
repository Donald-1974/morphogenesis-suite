"""MAC–SPH–turgor tri-coupled solver (NumPy).

Layout matches the TypeScript chamber: collocated MAC velocity on a node
grid, Lagrangian SPH particles, Jacobi Poisson turgor projection.

Computational morphogenesis only — no biological interpretation.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .seeds import seed_growth, seed_particles


@dataclass
class SolverParams:
    turgor: float = 2.2
    viscosity: float = 0.1
    cohesion: float = 1.8
    flip_ratio: float = 0.9
    poisson_iters: int = 16


@dataclass
class TickStats:
    tick: int
    particle_count: int
    lagrangian_mass: float
    eulerian_mass: float
    mass_drift: float
    max_div: float
    poisson_residual: float
    kinetic: float
    pressure_min: float
    pressure_max: float
    max_speed: float
    conserved: bool
    neck_density: float
    cut_active: bool


class MorphogenesisTriCoupledSolver:
    invariant_mass = 1.0

    def __init__(self, grid_res: tuple[int, int, int] = (16, 16, 16), max_particles: int = 800):
        nx, ny, nz = grid_res
        self.nx, self.ny, self.nz = nx, ny, nz
        self.n_cells = nx * ny * nz
        self.n_particles = max_particles
        self.dx = 1.0 if nx <= 1 else 1.0 / (nx - 1)
        self.positions = np.zeros((max_particles, 3), dtype=np.float64)
        self.velocities = np.zeros((max_particles, 3), dtype=np.float64)
        shape = (nz, ny, nx)
        self.pressure = np.zeros(shape)
        self.mac_u = np.zeros(shape)
        self.mac_v = np.zeros(shape)
        self.mac_w = np.zeros(shape)
        self.mass = np.zeros(shape)
        self.growth = np.zeros(shape)
        self.rest_density = 1.0
        self.tick_count = 0
        self.last_max_div = 0.0
        self.last_residual = 0.0
        self.last_eulerian_mass = 0.0
        self.last_kinetic = 0.0
        self.last_pressure_min = 0.0
        self.last_pressure_max = 0.0
        self.last_max_speed = 0.0
        self.last_mass_drift = 0.0
        self.last_neck = 0.0
        self.cut_axis = 0
        self.cut_origin = 0.5
        self.cut_width = 0.06
        self.cut_ticks = 0
        self.total_initial_mass = max_particles * self.invariant_mass
        self._ux_old = self.mac_u.copy()
        self._uy_old = self.mac_v.copy()
        self._uz_old = self.mac_w.copy()

    def reseed(self, kind: str) -> None:
        self.positions, self.velocities = seed_particles(kind, self.n_particles)
        self.growth = seed_growth(kind, self.nx, self.ny, self.nz)
        self.pressure.fill(0)
        self.mac_u.fill(0)
        self.mac_v.fill(0)
        self.mac_w.fill(0)
        self.tick_count = 0
        self.cut_ticks = 0
        self.last_neck = 0.0
        self.total_initial_mass = self.n_particles * self.invariant_mass
        self.map_particles_to_grid()
        self.calibrate_rest_density()
        self.validate_mass()

    def calibrate_rest_density(self) -> None:
        mask = self.mass > 0.08
        self.rest_density = float(self.mass[mask].mean()) if mask.any() else 1.0

    def execute_physics_tick(self, dt: float, params: SolverParams) -> None:
        self.apply_cohesion(dt, params.cohesion)
        self.apply_viscosity(params.viscosity)
        self.map_particles_to_grid()
        self.solve_poisson(dt, params)
        self.map_grid_to_particles(params.flip_ratio)
        self.integrate_positions(dt)
        self.validate_mass()
        if self.cut_ticks > 0:
            self.cut_ticks -= 1
        self.tick_count += 1

    def apply_cohesion(self, dt: float, cohesion: float) -> None:
        cutting = self.cut_ticks > 0
        ax = self.cut_axis
        if cutting:
            sep = 0.012 * (self.cut_ticks / 96)
            coord = self.positions[:, ax]
            self.velocities[:, ax] += np.where(coord < self.cut_origin, -sep, sep)
        if cohesion <= 0:
            return
        gx, gy, gz = self._density_gradient()
        k = cohesion * dt
        samples = self._sample_fields(
            [gx, gy, gz], self.positions[:, 0], self.positions[:, 1], self.positions[:, 2]
        )
        atten = np.ones(self.n_particles)
        if cutting:
            d = np.abs(self.positions[:, ax] - self.cut_origin)
            atten = np.where(
                d < self.cut_width,
                0.0,
                np.minimum(1.0, (d - self.cut_width) / self.cut_width),
            )
        self.velocities[:, 0] += samples[0] * k * atten
        self.velocities[:, 1] += samples[1] * k * atten
        self.velocities[:, 2] += samples[2] * k * atten

    def apply_viscosity(self, viscosity: float) -> None:
        if viscosity <= 0:
            return
        self.velocities *= 1.0 - min(0.6, viscosity)

    def map_particles_to_grid(self) -> None:
        self.mass.fill(0)
        self.mac_u.fill(0)
        self.mac_v.fill(0)
        self.mac_w.fill(0)
        nx, ny, nz = self.gx(self.positions)
        i0 = np.clip(np.floor(nx).astype(int), 0, self.nx - 2)
        j0 = np.clip(np.floor(ny).astype(int), 0, self.ny - 2)
        k0 = np.clip(np.floor(nz).astype(int), 0, self.nz - 2)
        tx = np.clip(nx - i0, 0, 1)
        ty = np.clip(ny - j0, 0, 1)
        tz = np.clip(nz - k0, 0, 1)
        for di, wi in ((0, 1 - tx), (1, tx)):
            for dj, wj in ((0, 1 - ty), (1, ty)):
                for dk, wk in ((0, 1 - tz), (1, tz)):
                    w = wi * wj * wk
                    wm = w * self.invariant_mass
                    ii = i0 + di
                    jj = j0 + dj
                    kk = k0 + dk
                    np.add.at(self.mass, (kk, jj, ii), wm)
                    np.add.at(self.mac_u, (kk, jj, ii), wm * self.velocities[:, 0])
                    np.add.at(self.mac_v, (kk, jj, ii), wm * self.velocities[:, 1])
                    np.add.at(self.mac_w, (kk, jj, ii), wm * self.velocities[:, 2])
        m = self.mass
        live = m > 1e-8
        self.mac_u[live] /= m[live]
        self.mac_v[live] /= m[live]
        self.mac_w[live] /= m[live]
        self.mac_u[~live] = 0
        self.mac_v[~live] = 0
        self.mac_w[~live] = 0
        self.last_eulerian_mass = float(m.sum())

    def gx(self, pos: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        return pos[:, 0] * (self.nx - 1), pos[:, 1] * (self.ny - 1), pos[:, 2] * (self.nz - 1)

    def solve_poisson(self, dt: float, params: SolverParams) -> None:
        ux, uy, uz = self.mac_u, self.mac_v, self.mac_w
        ux_old, uy_old, uz_old = ux.copy(), uy.copy(), uz.copy()
        inv2dx = 1.0 / (2.0 * self.dx)
        dx2 = self.dx * self.dx
        inv_dt = 1.0 / max(dt, 1e-6)
        div = np.zeros_like(ux)
        div[1:-1, 1:-1, 1:-1] = (
            (ux[1:-1, 1:-1, 2:] - ux[1:-1, 1:-1, :-2]) * inv2dx
            + (uy[1:-1, 2:, 1:-1] - uy[1:-1, :-2, 1:-1]) * inv2dx
            + (uz[2:, 1:-1, 1:-1] - uz[:-2, 1:-1, 1:-1]) * inv2dx
        )
        self.last_max_div = float(np.max(np.abs(div)))
        dens_err = self.mass - self.rest_density * (1.0 + self.growth)
        rhs = div * inv_dt + params.turgor * dens_err / (self.rest_density + 1e-4)
        p = self.pressure
        residual = 0.0
        iters = max(4, min(28, int(params.poisson_iters)))
        for _ in range(iters):
            nxt = p.copy()
            nxt[1:-1, 1:-1, 1:-1] = (
                p[1:-1, 1:-1, :-2]
                + p[1:-1, 1:-1, 2:]
                + p[1:-1, :-2, 1:-1]
                + p[1:-1, 2:, 1:-1]
                + p[:-2, 1:-1, 1:-1]
                + p[2:, 1:-1, 1:-1]
                - rhs[1:-1, 1:-1, 1:-1] * dx2
            ) / 6.0
            nxt[0] = 0
            nxt[-1] = 0
            nxt[:, 0] = 0
            nxt[:, -1] = 0
            nxt[:, :, 0] = 0
            nxt[:, :, -1] = 0
            residual = float(np.max(np.abs(nxt - p)))
            p = nxt
        self.pressure = p
        self.last_residual = residual
        self.last_pressure_min = float(p.min())
        self.last_pressure_max = float(p.max())
        ux[1:-1, 1:-1, 1:-1] -= dt * (p[1:-1, 1:-1, 2:] - p[1:-1, 1:-1, :-2]) * inv2dx
        uy[1:-1, 1:-1, 1:-1] -= dt * (p[1:-1, 2:, 1:-1] - p[1:-1, :-2, 1:-1]) * inv2dx
        uz[1:-1, 1:-1, 1:-1] -= dt * (p[2:, 1:-1, 1:-1] - p[:-2, 1:-1, 1:-1]) * inv2dx
        ux[:, :, 0] = 0
        ux[:, :, -1] = 0
        uy[:, 0] = 0
        uy[:, -1] = 0
        uz[0] = 0
        uz[-1] = 0
        self._ux_old, self._uy_old, self._uz_old = ux_old, uy_old, uz_old

    def map_grid_to_particles(self, flip_ratio: float) -> None:
        flip = min(1.0, max(0.0, flip_ratio))
        pic = 1.0 - flip
        x, y, z = self.positions[:, 0], self.positions[:, 1], self.positions[:, 2]
        gux, guy, guz = self._sample_fields([self.mac_u, self.mac_v, self.mac_w], x, y, z)
        dux, duy, duz = self._sample_fields(
            [
                self.mac_u - self._ux_old,
                self.mac_v - self._uy_old,
                self.mac_w - self._uz_old,
            ],
            x,
            y,
            z,
        )
        self.velocities[:, 0] = pic * gux + flip * (self.velocities[:, 0] + dux)
        self.velocities[:, 1] = pic * guy + flip * (self.velocities[:, 1] + duy)
        self.velocities[:, 2] = pic * guz + flip * (self.velocities[:, 2] + duz)

    def integrate_positions(self, dt: float) -> None:
        lo = self.dx * 1.05
        hi = 1.0 - lo
        rest = 0.18
        vmax = 0.42 * self.dx / max(dt, 1e-6)
        sp2 = np.sum(self.velocities**2, axis=1)
        over = sp2 > vmax * vmax
        if np.any(over):
            s = vmax / np.sqrt(sp2[over])
            self.velocities[over] *= s[:, None]
        self.positions += self.velocities * dt
        for a in range(3):
            low = self.positions[:, a] < lo
            high = self.positions[:, a] > hi
            self.positions[low, a] = lo
            self.velocities[low, a] = np.abs(self.velocities[low, a]) * rest
            self.positions[high, a] = hi
            self.velocities[high, a] = -np.abs(self.velocities[high, a]) * rest
        sp2 = np.sum(self.velocities**2, axis=1)
        self.last_max_speed = float(np.sqrt(sp2.max())) if len(sp2) else 0.0
        self.last_kinetic = float(0.5 * self.invariant_mass * sp2.sum())

    def validate_mass(self) -> None:
        current = self.n_particles * self.invariant_mass
        drift = abs(self.total_initial_mass - current)
        mapped = abs(self.last_eulerian_mass - current)
        self.last_mass_drift = max(drift, mapped)

    def add_growth(self, cx: float, cy: float, cz: float, amp: float, sig: float) -> None:
        zs = np.linspace(0.0, 1.0, self.nz) if self.nz > 1 else np.array([0.5])
        ys = np.linspace(0.0, 1.0, self.ny) if self.ny > 1 else np.array([0.5])
        xs = np.linspace(0.0, 1.0, self.nx) if self.nx > 1 else np.array([0.5])
        Z, Y, X = np.meshgrid(zs, ys, xs, indexing="ij")
        d2 = (X - np.clip(cx, 0, 1)) ** 2 + (Y - np.clip(cy, 0, 1)) ** 2 + (Z - np.clip(cz, 0, 1)) ** 2
        self.growth = np.clip(self.growth + amp * np.exp(-d2 / (2 * sig * sig)), -2.5, 3.5)

    def inject_at(self, cx: float, cy: float, cz: float, amp: float = 1.15, sig: float = 0.08) -> None:
        self.add_growth(cx, cy, cz, amp, sig)
        d = self.positions - np.array([np.clip(cx, 0, 1), np.clip(cy, 0, 1), np.clip(cz, 0, 1)])
        r = np.linalg.norm(d, axis=1) + 1e-6
        kick = 0.16 * np.exp(-(r * r) / (2 * sig * sig))
        self.velocities += (d / r[:, None]) * kick[:, None]

    def center_of_mass(self) -> np.ndarray:
        return self.positions.mean(axis=0)

    def principal_axis(self) -> int:
        c = self.center_of_mass()
        var = ((self.positions - c) ** 2).sum(axis=0)
        return int(np.argmax(var))

    def sever(self, axis: int | None = None) -> None:
        ax = self.principal_axis() if axis is None else axis
        origin = float(self.center_of_mass()[ax])
        self.cut_axis, self.cut_origin, self.cut_width, self.cut_ticks = ax, origin, 0.06, 96
        zs = np.linspace(0.0, 1.0, self.nz) if self.nz > 1 else np.array([0.5])
        ys = np.linspace(0.0, 1.0, self.ny) if self.ny > 1 else np.array([0.5])
        xs = np.linspace(0.0, 1.0, self.nx) if self.nx > 1 else np.array([0.5])
        Z, Y, X = np.meshgrid(zs, ys, xs, indexing="ij")
        coord = (X, Y, Z)[ax]
        self.growth -= 2.1 * np.exp(-((coord - origin) ** 2) / (2 * self.cut_width**2))
        kick = 0.26
        self.velocities[:, ax] += np.where(self.positions[:, ax] < origin, -kick, kick)
        self.last_neck = self.neck_density()

    def neck_density(self) -> float:
        zs = np.linspace(0.0, 1.0, self.nz) if self.nz > 1 else np.array([0.5])
        ys = np.linspace(0.0, 1.0, self.ny) if self.ny > 1 else np.array([0.5])
        xs = np.linspace(0.0, 1.0, self.nx) if self.nx > 1 else np.array([0.5])
        Z, Y, X = np.meshgrid(zs, ys, xs, indexing="ij")
        coord = (X, Y, Z)[self.cut_axis]
        mask = np.abs(coord - self.cut_origin) <= self.cut_width * 1.2
        self.last_neck = float(self.mass[mask].mean()) if mask.any() else 0.0
        return self.last_neck

    def capture(self) -> dict:
        return {
            "positions": self.positions.copy(),
            "velocities": self.velocities.copy(),
            "growth": self.growth.copy(),
            "pressure": self.pressure.copy(),
            "mac_u": self.mac_u.copy(),
            "mac_v": self.mac_v.copy(),
            "mac_w": self.mac_w.copy(),
            "tick": self.tick_count,
            "rest_density": self.rest_density,
            "cut_ticks": self.cut_ticks,
            "cut_axis": self.cut_axis,
            "cut_origin": self.cut_origin,
            "cut_width": self.cut_width,
        }

    def restore(self, snap: dict) -> None:
        self.positions = snap["positions"].copy()
        self.velocities = snap["velocities"].copy()
        self.growth = snap["growth"].copy()
        self.pressure = snap["pressure"].copy()
        self.mac_u = snap["mac_u"].copy()
        self.mac_v = snap["mac_v"].copy()
        self.mac_w = snap["mac_w"].copy()
        self.tick_count = snap["tick"]
        self.rest_density = snap["rest_density"]
        self.cut_ticks = snap["cut_ticks"]
        self.cut_axis = snap["cut_axis"]
        self.cut_origin = snap["cut_origin"]
        self.cut_width = snap["cut_width"]
        self.map_particles_to_grid()
        self.validate_mass()

    def read_stats(self) -> TickStats:
        lag = self.n_particles * self.invariant_mass
        drift = self.last_mass_drift
        return TickStats(
            tick=self.tick_count,
            particle_count=self.n_particles,
            lagrangian_mass=lag,
            eulerian_mass=self.last_eulerian_mass,
            mass_drift=drift,
            max_div=self.last_max_div,
            poisson_residual=self.last_residual,
            kinetic=self.last_kinetic,
            pressure_min=self.last_pressure_min,
            pressure_max=self.last_pressure_max,
            max_speed=self.last_max_speed,
            conserved=drift / max(lag, 1) < 1e-3,
            neck_density=self.neck_density() if self.cut_ticks > 0 else self.last_neck,
            cut_active=self.cut_ticks > 0,
        )

    def _density_gradient(self) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        inv2dx = 1.0 / (2.0 * self.dx)
        m = self.mass
        gx = np.zeros_like(m)
        gy = np.zeros_like(m)
        gz = np.zeros_like(m)
        gx[1:-1, 1:-1, 1:-1] = (m[1:-1, 1:-1, 2:] - m[1:-1, 1:-1, :-2]) * inv2dx
        gy[1:-1, 1:-1, 1:-1] = (m[1:-1, 2:, 1:-1] - m[1:-1, :-2, 1:-1]) * inv2dx
        gz[1:-1, 1:-1, 1:-1] = (m[2:, 1:-1, 1:-1] - m[:-2, 1:-1, 1:-1]) * inv2dx
        return gx, gy, gz

    def _sample_fields(self, fields: list[np.ndarray], x, y, z) -> list[np.ndarray]:
        nx = np.clip(x * (self.nx - 1), 0, self.nx - 1 - 1e-9)
        ny = np.clip(y * (self.ny - 1), 0, self.ny - 1 - 1e-9)
        nz = np.clip(z * (self.nz - 1), 0, self.nz - 1 - 1e-9)
        i0 = np.floor(nx).astype(int)
        j0 = np.floor(ny).astype(int)
        k0 = np.floor(nz).astype(int)
        tx, ty, tz = nx - i0, ny - j0, nz - k0
        out = []
        for field in fields:
            c000 = field[k0, j0, i0]
            c100 = field[k0, j0, i0 + 1]
            c010 = field[k0, j0 + 1, i0]
            c110 = field[k0, j0 + 1, i0 + 1]
            c001 = field[k0 + 1, j0, i0]
            c101 = field[k0 + 1, j0, i0 + 1]
            c011 = field[k0 + 1, j0 + 1, i0]
            c111 = field[k0 + 1, j0 + 1, i0 + 1]
            c00 = c000 * (1 - tx) + c100 * tx
            c10 = c010 * (1 - tx) + c110 * tx
            c01 = c001 * (1 - tx) + c101 * tx
            c11 = c011 * (1 - tx) + c111 * tx
            c0 = c00 * (1 - ty) + c10 * ty
            c1 = c01 * (1 - ty) + c11 * ty
            out.append(c0 * (1 - tz) + c1 * tz)
        return out
