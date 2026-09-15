import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportRunsCsv } from "@/lib/solver/runs";
import { cn } from "@/lib/utils";
import { useLab } from "@/store/lab";

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a === 0) return "0";
  if (a >= 100) return n.toFixed(0);
  if (a >= 1) return n.toFixed(2);
  return n.toExponential(1);
}

export function RunLog() {
  const runs = useLab((s) => s.runs);
  const compareId = useLab((s) => s.compareId);

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted">Run log</p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            aria-label="Log this run"
            onClick={() => useLab.getState().logRun("manual")}
          >
            Log
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            disabled={runs.length === 0}
            aria-label="Export run log CSV"
            onClick={() => exportRunsCsv(useLab.getState().runs)}
          >
            <Download className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            disabled={runs.length === 0}
            aria-label="Clear run log"
            onClick={() => useLab.getState().clearRuns()}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      {runs.length === 0 ? (
        <p className="text-xs leading-snug text-subtle">
          Snapshot a finished assay. Logs persist in this browser.
        </p>
      ) : (
        <ul className="grid gap-1">
          {runs.slice(0, 6).map((r) => {
            const active = r.id === compareId;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() =>
                    useLab.getState().setCompareId(active ? null : r.id)
                  }
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] gap-x-3 rounded-sm px-2 py-2 text-left transition-[background-color,color] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
                    active ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/8 hover:text-fg",
                  )}
                >
                  <span className="truncate text-xs">{r.label}</span>
                  <span className="font-mono text-xs tabular-nums text-subtle">
                    t {r.ticks}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-subtle">
                    {r.morphology} · r {fmt(r.residual)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-subtle">
                    Δ {fmt(r.massDrift)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
