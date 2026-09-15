export type Shortcut = {
  keys: string[];
  action: string;
};

export type ShortcutGroup = {
  id: string;
  label: string;
  items: Shortcut[];
};

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "transport",
    label: "Transport",
    items: [
      { keys: ["Space"], action: "Play or pause" },
      { keys: ["N"], action: "Step one tick" },
      { keys: ["."], action: "Step one tick" },
      { keys: ["T"], action: "Turgor pulse at center of mass" },
      { keys: ["C"], action: "Cytokinesis sever" },
      { keys: ["R"], action: "Reseed current morphology" },
    ],
  },
  {
    id: "tools",
    label: "Click tools",
    items: [
      { keys: ["I"], action: "Inject turgor at click" },
      { keys: ["P"], action: "Probe — pin a live sample" },
      { keys: ["G"], action: "Paint growth" },
      { keys: ["X"], action: "Erase growth" },
    ],
  },
  {
    id: "bench",
    label: "Bench",
    items: [
      { keys: ["S"], action: "Snapshot" },
      { keys: ["L"], action: "Restore snapshot" },
      { keys: ["F"], action: "Fission assay" },
      { keys: ["D"], action: "Log this run" },
      { keys: ["E"], action: "Export telemetry CSV" },
    ],
  },
  {
    id: "morphology",
    label: "Morphology",
    items: [
      { keys: ["1"], action: "Seed Protoplast" },
      { keys: ["2"], action: "Seed Budding" },
      { keys: ["3"], action: "Seed Fission" },
      { keys: ["4"], action: "Seed Polar" },
      { keys: ["5"], action: "Seed Blastula" },
      { keys: ["6"], action: "Seed Dual" },
    ],
  },
  {
    id: "pages",
    label: "Pages",
    items: [
      { keys: ["H"], action: "Purpose and instructions" },
      { keys: ["?"], action: "This shortcuts list" },
      { keys: ["Esc"], action: "Close overlay, or abort a protocol" },
      { keys: ["Enter"], action: "Leave the purpose page" },
    ],
  },
];
