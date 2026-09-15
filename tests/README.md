# Tests

Headless invariants live in `python/tests`. They do not need Node or WebGL.

```bash
PYTHONPATH=python python3 -m unittest discover -s python/tests -v
# or
npm test
```

Covered:

- Lagrangian mass equals particle count N
- Snapshot / restore returns the same tick and positions
- `sever` does not delete mass
- Unknown morphology raises

The interactive lab is checked by `npm run typecheck` and `npm run build`.
