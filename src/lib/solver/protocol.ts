import type { Morphology } from "./seeds";

export type ProtocolKind = "fission" | "pulse" | "settle";

export type ProtocolPhase = {
  name: string;
  ticks?: number;
  action?: "sever" | "pulse";
};

export type ProtocolSpec = {
  id: ProtocolKind;
  label: string;
  blurb: string;
  seed: Morphology | null;
  phases: ProtocolPhase[];
};

export const PROTOCOLS: Record<ProtocolKind, ProtocolSpec> = {
  fission: {
    id: "fission",
    label: "Fission assay",
    blurb: "Seed the fission morphology, elongate, sever the neck, settle, log.",
    seed: "fission",
    phases: [
      { name: "elongate", ticks: 64 },
      { name: "sever", action: "sever" },
      { name: "split", ticks: 80 },
    ],
  },
  pulse: {
    id: "pulse",
    label: "Pulse response",
    blurb: "Turgor pulse at the center of mass, then 64 ticks of relaxation.",
    seed: null,
    phases: [
      { name: "pulse", action: "pulse" },
      { name: "relax", ticks: 64 },
    ],
  },
  settle: {
    id: "settle",
    label: "Settle",
    blurb: "Hold the current field for 48 ticks, then log residual and mass.",
    seed: null,
    phases: [{ name: "hold", ticks: 48 }],
  },
};

export const PROTOCOL_LIST: ProtocolSpec[] = [
  PROTOCOLS.fission,
  PROTOCOLS.pulse,
  PROTOCOLS.settle,
];

export type ProtocolStatus = {
  kind: ProtocolKind | null;
  phase: string;
  progress: number;
  until: number;
};

export const IDLE_PROTOCOL: ProtocolStatus = {
  kind: null,
  phase: "",
  progress: 0,
  until: 0,
};
