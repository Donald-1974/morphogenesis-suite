# Protocols

Named assays. Each is a phase machine the chamber (and the Python CLI) can run without improvisation.

## Fission assay

Seed the fission morphology.

1. **elongate** — 64 ticks. Polar expansion under the seeded growth field.
2. **sever** — constriction plane through the center of mass, growth trench, opposing kick. N unchanged.
3. **split** — 80 ticks. Neck density should fall if the cut held.
4. Log residual, kinetic, mass drift, neck.

## Pulse response

Turgor pulse at the current center of mass, then 64 ticks of relaxation. Use on any morphology.

## Settle

Hold the current field 48 ticks. Log residual and mass. The control for “did I actually change anything.”

## Keys (lab)

| Key | Action |
|---|---|
| Space | Play / pause |
| N or . | Step one tick |
| T | Pulse at COM |
| C | Sever |
| F | Fission assay |
| S / L | Snapshot / restore |
| D | Log this run |
| E | Export CSV |
| 1–6 | Morphologies |
| H | Purpose |
| ? | Keys |
| Esc | Abort protocol |
