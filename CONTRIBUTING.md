# Contributing

This repository is an independent Morphogenesis Suite. Keep it that way: no app-builder scaffolding, no auth, no database.

## Ground rules

- Computational morphogenesis only. No biological interpretation in code, comments, or docs.
- Solver changes need an invariant test: mass, snapshot/restore, or a named protocol.
- One key per action. If you add a shortcut, put it in `src/lib/solver/keys.ts` and on the purpose page.
- Do not add accounts, cloud persistence, or telemetry that leaves the browser.

## Layout

- `src/lib/solver/` — coupling. Keep this importable without React.
- `src/components/lab/` — chamber only.
- `python/` — NumPy port of the same coupling. If you change a tick, change both.

## Checks

```bash
npm test
npm run typecheck
PYTHONPATH=python python -m unittest discover -s python/tests -v
```

Originating Architect: Sai Genoa (Genoa Page) / ACGC Laboratories LLC
