import { Download } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { HistorySample } from "@/lib/solver/solver";
import { useLab } from "@/store/lab";

function exportCsv(history: HistorySample[]) {
  const header = "tick,residual,maxDiv,kinetic,massDrift,neck\n";
  const body = history
    .map(
      (s) =>
        `${s.tick},${s.residual},${s.maxDiv},${s.kinetic},${s.massDrift},${s.neck}`,
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `morphogenesis-${history[0]?.tick ?? 0}-${history[history.length - 1]?.tick ?? 0}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTelemetry() {
  const history = useLab.getState().history;
  if (history.length < 2) return;
  exportCsv(history);
}

export function Telemetry() {
  const history = useLab((s) => s.history);
  const runs = useLab((s) => s.runs);
  const compareId = useLab((s) => s.compareId);
  const compare = runs.find((r) => r.id === compareId) ?? null;

  const data = (() => {
    let rMax = 1e-12;
    let kMax = 1e-12;
    for (const s of history) {
      if (s.residual > rMax) rMax = s.residual;
      if (s.kinetic > kMax) kMax = s.kinetic;
    }
    if (compare) {
      for (const s of compare.series) {
        if (s.residual > rMax) rMax = s.residual;
        if (s.kinetic > kMax) kMax = s.kinetic;
      }
    }
    const live = history.map((s) => ({
      tick: s.tick,
      residual: s.residual / rMax,
      kinetic: s.kinetic / kMax,
    }));
    if (!compare || compare.series.length < 2 || live.length < 2) return live;
    const a0 = live[0]!.tick;
    const a1 = live[live.length - 1]!.tick;
    const b0 = compare.series[0]!.tick;
    const b1 = compare.series[compare.series.length - 1]!.tick;
    const spanA = Math.max(1, a1 - a0);
    const spanB = Math.max(1, b1 - b0);
    return live.map((s) => {
      const u = (s.tick - a0) / spanA;
      const tB = b0 + u * spanB;
      let lo = compare.series[0]!;
      let hi = compare.series[compare.series.length - 1]!;
      for (let i = 1; i < compare.series.length; i++) {
        if (compare.series[i]!.tick >= tB) {
          hi = compare.series[i]!;
          lo = compare.series[i - 1]!;
          break;
        }
      }
      const den = hi.tick - lo.tick || 1;
      const f = (tB - lo.tick) / den;
      return {
        ...s,
        cmpResidual: (lo.residual + (hi.residual - lo.residual) * f) / rMax,
        cmpKinetic: (lo.kinetic + (hi.kinetic - lo.kinetic) * f) / kMax,
      };
    });
  })();

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted">Telemetry</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-xs"
          disabled={history.length < 2}
          aria-label="Export CSV"
          onClick={() => exportCsv(useLab.getState().history)}
        >
          <Download className="size-3.5" />
          CSV
        </Button>
      </div>
      {data.length < 2 ? (
        <p className="text-xs text-subtle">Residual and kinetic energy record after the first ticks.</p>
      ) : (
        <>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
                <YAxis hide domain={[0, 1]} />
                {compare ? (
                  <>
                    <Line
                      type="monotone"
                      dataKey="cmpResidual"
                      stroke="var(--color-subtle)"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cmpKinetic"
                      stroke="var(--color-muted)"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </>
                ) : null}
                <Line
                  type="monotone"
                  dataKey="residual"
                  stroke="var(--color-muted)"
                  strokeWidth={1.25}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="kinetic"
                  stroke="var(--color-fg)"
                  strokeWidth={1.25}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-subtle">
            <span>residual</span>
            <span>{compare ? `vs ${compare.label}` : "kinetic"}</span>
          </div>
        </>
      )}
    </div>
  );
}
