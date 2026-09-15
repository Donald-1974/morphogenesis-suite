"""Seed morphologies. Computational only — no biological interpretation."""

from __future__ import annotations

import numpy as np

MORPHOLOGIES = (
    "protoplast",
    "budding",
    "fission",
    "polar",
    "blastula",
    "dual",
)


def _rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def _fill_ball(pos, vel, start, count, cx, cy, cz, radius, rng, vx=0.0, vy=0.0, vz=0.0, inner=0.0):
    written = 0
    guard = 0
    r2 = radius * radius
    i2 = inner * inner
    while written < count and guard < count * 40:
        guard += 1
        x, y, z = (rng.random(3) * 2 - 1) * radius
        d2 = float(x * x + y * y + z * z)
        if d2 > r2 or d2 < i2:
            continue
        i = start + written
        pos[i] = (cx + x, cy + y, cz + z)
        vel[i] = (
            vx + (rng.random() - 0.5) * 0.02,
            vy + (rng.random() - 0.5) * 0.02,
            vz + (rng.random() - 0.5) * 0.02,
        )
        written += 1
    while written < count:
        u = rng.random() * np.pi * 2
        v = np.arccos(rng.random() * 2 - 1)
        rr = inner + (radius - inner) * rng.random() ** (1 / 3)
        i = start + written
        pos[i] = (
            cx + rr * np.sin(v) * np.cos(u),
            cy + rr * np.cos(v),
            cz + rr * np.sin(v) * np.sin(u),
        )
        vel[i] = (vx, vy, vz)
        written += 1


def seed_particles(kind: str, count: int) -> tuple[np.ndarray, np.ndarray]:
    pos = np.zeros((count, 3), dtype=np.float64)
    vel = np.zeros((count, 3), dtype=np.float64)
    rng = _rng(17 + len(kind) * 97)
    if kind == "protoplast":
        _fill_ball(pos, vel, 0, count, 0.5, 0.5, 0.5, 0.22, rng)
    elif kind == "budding":
        _fill_ball(pos, vel, 0, count, 0.5, 0.5, 0.5, 0.20, rng)
    elif kind == "fission":
        written = 0
        guard = 0
        rx, ry, rz = 0.28, 0.16, 0.16
        while written < count and guard < count * 40:
            guard += 1
            x = (rng.random() * 2 - 1) * rx
            y = (rng.random() * 2 - 1) * ry
            z = (rng.random() * 2 - 1) * rz
            if (x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz) > 1:
                continue
            pos[written] = (0.5 + x, 0.5 + y, 0.5 + z)
            vel[written] = (
                (rng.random() - 0.5) * 0.02,
                (rng.random() - 0.5) * 0.02,
                (rng.random() - 0.5) * 0.02,
            )
            written += 1
        while written < count:
            u = rng.random() * np.pi * 2
            v = np.arccos(rng.random() * 2 - 1)
            pos[written] = (
                0.5 + rx * np.sin(v) * np.cos(u) * 0.92,
                0.5 + ry * np.cos(v) * 0.92,
                0.5 + rz * np.sin(v) * np.sin(u) * 0.92,
            )
            written += 1
    elif kind == "polar":
        _fill_ball(pos, vel, 0, count, 0.5, 0.46, 0.5, 0.18, rng)
    elif kind == "blastula":
        _fill_ball(pos, vel, 0, count, 0.5, 0.5, 0.5, 0.24, rng, inner=0.175)
    elif kind == "dual":
        half = count // 2
        _fill_ball(pos, vel, 0, half, 0.32, 0.5, 0.5, 0.14, rng, vx=0.22)
        _fill_ball(pos, vel, half, count - half, 0.68, 0.5, 0.5, 0.14, rng, vx=-0.22)
    else:
        raise ValueError(f"unknown morphology: {kind}")
    return pos, vel


def seed_growth(kind: str, nx: int, ny: int, nz: int) -> np.ndarray:
    g = np.zeros((nz, ny, nx), dtype=np.float64)
    zs = np.linspace(0.0, 1.0, nz) if nz > 1 else np.array([0.5])
    ys = np.linspace(0.0, 1.0, ny) if ny > 1 else np.array([0.5])
    xs = np.linspace(0.0, 1.0, nx) if nx > 1 else np.array([0.5])
    Z, Y, X = np.meshgrid(zs, ys, xs, indexing="ij")
    if kind == "protoplast":
        r2 = (X - 0.5) ** 2 + (Y - 0.5) ** 2 + (Z - 0.5) ** 2
        g = np.where(r2 < 0.08, 0.12, 0.0)
    elif kind == "budding":
        d2 = (X - 0.66) ** 2 + (Y - 0.56) ** 2 + (Z - 0.5) ** 2
        g = 1.7 * np.exp(-d2 / (2 * 0.055 * 0.055))
    elif kind == "fission":
        band = np.exp(-((X - 0.5) ** 2) / (2 * 0.042 * 0.042))
        poles = np.clip(np.abs(X - 0.5) - 0.1, 0, None) * 4
        g = -1.35 * band + 0.55 * np.minimum(1.0, poles)
    elif kind == "polar":
        d2 = (X - 0.5) ** 2 + (Y - 0.72) ** 2 + (Z - 0.5) ** 2
        g = 1.85 * np.exp(-d2 / (2 * 0.07 * 0.07))
    elif kind == "blastula":
        r = np.sqrt((X - 0.5) ** 2 + (Y - 0.5) ** 2 + (Z - 0.5) ** 2)
        g = np.exp(-((r - 0.2) ** 2) / (2 * 0.03 * 0.03)) * 0.7
    else:
        g = np.full_like(g, 0.18)
    return g
