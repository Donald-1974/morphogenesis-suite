import { create } from "zustand";
import type {
  ColorMode,
  HistorySample,
  ProbeSample,
  TickStats,
} from "@/lib/solver/solver";
import type { Morphology } from "@/lib/solver/seeds";
import {
  IDLE_PROTOCOL,
  type ProtocolKind,
  type ProtocolStatus,
} from "@/lib/solver/protocol";
import {
  downsampleHistory,
  loadRuns,
  persistRuns,
  pushRun,
  type RunRecord,
} from "@/lib/solver/runs";

export type Tool = "probe" | "inject" | "paint" | "erase";

export type LabState = {
  running: boolean;
  morphology: Morphology;
  colorMode: ColorMode;
  showParticles: boolean;
  showSlice: boolean;
  showLattice: boolean;
  slice: number;
  turgor: number;
  viscosity: number;
  cohesion: number;
  flipRatio: number;
  poissonIters: number;
  sheetOpen: boolean;
  keysOpen: boolean;
  guideOpen: boolean;
  pausedByGuide: boolean;
  entered: boolean;
  tool: Tool;
  paintRadius: number;
  orbitLock: boolean;
  probe: ProbeSample | null;
  history: HistorySample[];
  lastAction: string;
  stats: TickStats;
  protocol: ProtocolStatus;
  protocolKind: ProtocolKind;
  protocolId: number;
  abortId: number;
  hasSnapshot: boolean;
  snapshotId: number;
  restoreId: number;
  runs: RunRecord[];
  compareId: number | null;
  pulseId: number;
  resetId: number;
  stepId: number;
  severId: number;
  toggleRunning: () => void;
  setRunning: (v: boolean) => void;
  setMorphology: (m: Morphology, opts?: { keepProtocol?: boolean }) => void;
  setColorMode: (m: ColorMode) => void;
  setShowParticles: (v: boolean) => void;
  setShowSlice: (v: boolean) => void;
  setShowLattice: (v: boolean) => void;
  setSlice: (v: number) => void;
  setTurgor: (v: number) => void;
  setViscosity: (v: number) => void;
  setCohesion: (v: number) => void;
  setFlipRatio: (v: number) => void;
  setPoissonIters: (v: number) => void;
  setSheetOpen: (v: boolean) => void;
  openKeys: () => void;
  closeKeys: () => void;
  toggleKeys: () => void;
  openGuide: () => void;
  closeGuide: () => void;
  setTool: (t: Tool) => void;
  setPaintRadius: (v: number) => void;
  setOrbitLock: (v: boolean) => void;
  setProbe: (p: ProbeSample | null) => void;
  setLastAction: (s: string) => void;
  setStats: (s: TickStats) => void;
  clearHistory: () => void;
  pulse: () => void;
  reset: () => void;
  step: () => void;
  sever: () => void;
  snapshot: () => void;
  restore: () => void;
  markSnapshot: (v: boolean) => void;
  startProtocol: (kind: ProtocolKind) => void;
  abortProtocol: () => void;
  setProtocol: (p: ProtocolStatus) => void;
  logRun: (label: string) => void;
  hydrateRuns: () => void;
  setCompareId: (id: number | null) => void;
  clearRuns: () => void;
};

const emptyStats: TickStats = {
  tick: 0,
  particleCount: 0,
  lagrangianMass: 0,
  eulerianMass: 0,
  massDrift: 0,
  maxDiv: 0,
  poissonResidual: 0,
  kinetic: 0,
  pressureMin: 0,
  pressureMax: 0,
  maxSpeed: 0,
  dtMs: 0,
  conserved: true,
  neckDensity: 0,
  cutActive: false,
};

const GUIDE_SEEN = "morphogenesis-lab-guide-v2";

function guideSeen() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUIDE_SEEN) === "1";
  } catch {
    return false;
  }
}

function markGuideSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GUIDE_SEEN, "1");
  } catch {
    /* quota / private mode */
  }
}

const HIST = 180;

export const useLab = create<LabState>((set, get) => ({
  running: false,
  morphology: "budding",
  colorMode: "pressure",
  showParticles: true,
  showSlice: true,
  showLattice: false,
  slice: 0.5,
  turgor: 2.2,
  viscosity: 0.1,
  cohesion: 1.8,
  flipRatio: 0.9,
  poissonIters: 16,
  sheetOpen: false,
  keysOpen: false,
  guideOpen: true,
  pausedByGuide: true,
  entered: false,
  tool: "inject",
  paintRadius: 0.07,
  orbitLock: false,
  probe: null,
  history: [],
  lastAction: "",
  stats: emptyStats,
  protocol: IDLE_PROTOCOL,
  protocolKind: "fission",
  protocolId: 0,
  abortId: 0,
  hasSnapshot: false,
  snapshotId: 0,
  restoreId: 0,
  runs: [],
  compareId: null,
  pulseId: 0,
  resetId: 0,
  stepId: 0,
  severId: 0,
  toggleRunning: () => set((s) => ({ running: !s.running })),
  setRunning: (v) => set({ running: v }),
  setMorphology: (m, opts) =>
    set((s) => ({
      morphology: m,
      resetId: Date.now(),
      history: [],
      probe: null,
      lastAction: `seed ${m}`,
      protocol: opts?.keepProtocol ? s.protocol : IDLE_PROTOCOL,
      abortId: opts?.keepProtocol ? s.abortId : s.abortId + 1,
    })),
  setColorMode: (m) => set({ colorMode: m }),
  setShowParticles: (v) => set({ showParticles: v }),
  setShowSlice: (v) => set({ showSlice: v }),
  setShowLattice: (v) => set({ showLattice: v }),
  setSlice: (v) => set({ slice: v }),
  setTurgor: (v) => set({ turgor: v }),
  setViscosity: (v) => set({ viscosity: v }),
  setCohesion: (v) => set({ cohesion: v }),
  setFlipRatio: (v) => set({ flipRatio: v }),
  setPoissonIters: (v) => set({ poissonIters: v }),
  setSheetOpen: (v) => set({ sheetOpen: v }),
  openKeys: () => set({ keysOpen: true, sheetOpen: false }),
  closeKeys: () => set({ keysOpen: false }),
  toggleKeys: () =>
    set((s) => ({ keysOpen: !s.keysOpen, sheetOpen: s.keysOpen ? s.sheetOpen : false })),
  openGuide: () =>
    set((s) => ({
      guideOpen: true,
      sheetOpen: false,
      keysOpen: false,
      pausedByGuide: s.running,
      running: false,
    })),
  closeGuide: () => {
    markGuideSeen();
    set((s) => ({
      guideOpen: false,
      entered: true,
      keysOpen: false,
      running: s.pausedByGuide,
      pausedByGuide: false,
    }));
  },
  setTool: (tool) =>
    set({
      tool,
      colorMode: tool === "paint" || tool === "erase" ? "growth" : get().colorMode,
    }),
  setPaintRadius: (paintRadius) => set({ paintRadius }),
  setOrbitLock: (orbitLock) => set({ orbitLock }),
  setProbe: (probe) => set({ probe }),
  setLastAction: (lastAction) => set({ lastAction }),
  setStats: (stats) =>
    set((s) => {
      const sample: HistorySample = {
        tick: stats.tick,
        residual: stats.poissonResidual,
        maxDiv: stats.maxDiv,
        kinetic: stats.kinetic,
        massDrift: stats.massDrift,
        neck: stats.neckDensity,
      };
      const last = s.history[s.history.length - 1];
      if (last && last.tick === sample.tick) return { stats };
      const history =
        s.history.length >= HIST
          ? s.history.slice(1).concat(sample)
          : s.history.concat(sample);
      return { stats, history };
    }),
  clearHistory: () => set({ history: [] }),
  pulse: () =>
    set((s) => ({ pulseId: s.pulseId + 1, lastAction: "turgor pulse (COM)" })),
  reset: () =>
    set((s) => ({
      resetId: s.resetId + 1,
      history: [],
      probe: null,
      lastAction: "reset",
      protocol: IDLE_PROTOCOL,
      abortId: s.abortId + 1,
    })),
  step: () => set((s) => ({ running: false, stepId: s.stepId + 1 })),
  sever: () =>
    set((s) => ({ severId: s.severId + 1, lastAction: "cytokinesis sever" })),
  snapshot: () =>
    set((s) => ({
      snapshotId: s.snapshotId + 1,
      lastAction: "snapshot",
    })),
  restore: () =>
    set((s) => {
      if (!s.hasSnapshot) return s;
      return {
        restoreId: s.restoreId + 1,
        lastAction: "restore snapshot",
        protocol: IDLE_PROTOCOL,
        abortId: s.abortId + 1,
      };
    }),
  markSnapshot: (hasSnapshot) => set({ hasSnapshot }),
  startProtocol: (kind) =>
    set((s) => ({
      protocolKind: kind,
      protocolId: s.protocolId + 1,
      protocol: { kind, phase: "arm", progress: 0, until: 0 },
      lastAction: `protocol ${kind}`,
      running: true,
    })),
  abortProtocol: () =>
    set((s) => ({
      abortId: s.abortId + 1,
      protocol: IDLE_PROTOCOL,
      lastAction: "protocol aborted",
    })),
  setProtocol: (protocol) => set({ protocol }),
  logRun: (label) =>
    set((s) => {
      const rec: RunRecord = {
        id: Date.now(),
        at: Date.now(),
        label,
        morphology: s.morphology,
        ticks: s.stats.tick,
        residual: s.stats.poissonResidual,
        kinetic: s.stats.kinetic,
        massDrift: s.stats.massDrift,
        neck: s.stats.neckDensity,
        turgor: s.turgor,
        cohesion: s.cohesion,
        series: downsampleHistory(s.history),
      };
      const runs = pushRun(s.runs, rec);
      persistRuns(runs);
      return { runs, lastAction: `logged ${label}` };
    }),
  hydrateRuns: () => {
    const seen = guideSeen();
    set({
      runs: loadRuns(),
      guideOpen: !seen,
      entered: seen,
      running: seen,
      pausedByGuide: !seen,
    });
  },
  setCompareId: (compareId) => set({ compareId }),
  clearRuns: () => {
    persistRuns([]);
    set({ runs: [], compareId: null, lastAction: "cleared run log" });
  },
}));
