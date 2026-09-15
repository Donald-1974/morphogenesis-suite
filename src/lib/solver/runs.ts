import type { Morphology } from "./seeds";
import type { HistorySample } from "./solver";

export const RUN_LOG_VERSION = 1;
const KEY = "morphogenesis-lab-runs-v1";
const MAX_RUNS = 12;
const SERIES = 48;

export type RunSeriesPoint = {
  tick: number;
  residual: number;
  kinetic: number;
};

export type RunRecord = {
  id: number;
  at: number;
  label: string;
  morphology: Morphology;
  ticks: number;
  residual: number;
  kinetic: number;
  massDrift: number;
  neck: number;
  turgor: number;
  cohesion: number;
  series: RunSeriesPoint[];
};

type Disk = { v: number; runs: RunRecord[] };

export function downsampleHistory(history: HistorySample[], n = SERIES): RunSeriesPoint[] {
  if (history.length === 0) return [];
  const take = Math.min(n, history.length);
  if (history.length <= n) {
    return history.map((s) => ({
      tick: s.tick,
      residual: s.residual,
      kinetic: s.kinetic,
    }));
  }
  const out: RunSeriesPoint[] = [];
  for (let i = 0; i < take; i++) {
    const idx = Math.round((i / (take - 1)) * (history.length - 1));
    const s = history[idx]!;
    out.push({ tick: s.tick, residual: s.residual, kinetic: s.kinetic });
  }
  return out;
}

export function loadRuns(): RunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Disk;
    if (!parsed || parsed.v !== RUN_LOG_VERSION || !Array.isArray(parsed.runs)) {
      return [];
    }
    return parsed.runs.slice(0, MAX_RUNS);
  } catch {
    return [];
  }
}

export function persistRuns(runs: RunRecord[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = runs.slice(0, MAX_RUNS);
    window.localStorage.setItem(KEY, JSON.stringify({ v: RUN_LOG_VERSION, runs: trimmed }));
  } catch {
    // private mode / quota — keep in-memory only
  }
}

export function pushRun(runs: RunRecord[], next: RunRecord): RunRecord[] {
  return [next, ...runs].slice(0, MAX_RUNS);
}

export function exportRunsCsv(runs: RunRecord[]) {
  const header =
    "id,at,label,morphology,ticks,residual,kinetic,massDrift,neck,turgor,cohesion\n";
  const body = runs
    .map(
      (r) =>
        `${r.id},${new Date(r.at).toISOString()},${csvCell(r.label)},${r.morphology},${r.ticks},${r.residual},${r.kinetic},${r.massDrift},${r.neck},${r.turgor},${r.cohesion}`,
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `morphogenesis-runs-${runs.length}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
