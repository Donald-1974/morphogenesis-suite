import type { ReactNode } from "react";
import {
  BookOpen,
  Camera,
  Crosshair,
  History,
  Keyboard,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  SkipForward,
  SlidersHorizontal,
  Square,
  Zap,
} from "lucide-react";
import { RunLog } from "@/components/lab/RunLog";
import { Telemetry } from "@/components/lab/Telemetry";
import { Button } from "@/components/ui/button";
import { ParamSlider } from "@/components/ui/slider";
import { PROTOCOL_LIST, PROTOCOLS } from "@/lib/solver/protocol";
import { MORPHOLOGIES } from "@/lib/solver/seeds";
import { cn } from "@/lib/utils";
import { useLab, type Tool } from "@/store/lab";
import type { ColorMode } from "@/lib/solver/solver";

const COLORS: { id: ColorMode; label: string }[] = [
  { id: "pressure", label: "Pressure" },
  { id: "speed", label: "Speed" },
  { id: "density", label: "Density" },
  { id: "growth", label: "Growth" },
];

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: "inject", label: "Inject", hint: "Click to raise turgor and kick nearby particles." },
  { id: "paint", label: "Paint", hint: "Drag to raise the growth field. Orbit unlocks on release." },
  { id: "erase", label: "Erase", hint: "Drag to suppress growth. Use after a bud overshoots." },
  { id: "probe", label: "Probe", hint: "Click to pin a live sample of p, ρ, g, |v|." },
];

function fmtSci(n: number) {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a === 0) return "0.00";
  if (a >= 100) return n.toFixed(0);
  if (a >= 1) return n.toFixed(2);
  return n.toExponential(1);
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-sm px-2.5 text-xs font-medium transition-[background-color,color,box-shadow] duration-[var(--motion-quick)] ease-[var(--ease-out)]",
        active
          ? "bg-accent text-accent-fg"
          : "text-muted hover:bg-fg/8 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function Pipeline() {
  const stats = useLab((s) => s.stats);
  const rows = [
    {
      n: "01",
      name: "P2G transfer",
      detail: `m ${fmtSci(stats.eulerianMass)}`,
    },
    {
      n: "02",
      name: "Poisson / turgor",
      detail: `r ${fmtSci(stats.poissonResidual)}`,
    },
    {
      n: "03",
      name: "G2P + integrate",
      detail: `|v| ${fmtSci(stats.maxSpeed)}`,
    },
    {
      n: "04",
      name: "Mass invariant",
      detail: `Δ ${fmtSci(stats.massDrift)}`,
    },
  ];
  return (
    <ol className="mt-4 grid gap-1">
      {rows.map((row) => (
        <li
          key={row.n}
          className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-2 border-t border-border py-1.5 first:border-t-0"
        >
          <span className="font-mono text-xs tabular-nums text-subtle">{row.n}</span>
          <span className="text-sm text-fg">{row.name}</span>
          <span className="font-mono text-xs tabular-nums text-muted">{row.detail}</span>
        </li>
      ))}
    </ol>
  );
}

function ProtocolMeter() {
  const protocol = useLab((s) => s.protocol);
  if (!protocol.kind) return null;
  const spec = PROTOCOLS[protocol.kind];
  const pct = Math.round(protocol.progress * 100);
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted">{spec.label}</p>
        <p className="font-mono text-xs tabular-nums text-fg">{protocol.phase}</p>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-fg/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-[var(--motion-quick)] ease-[var(--ease-out)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProbeReadout() {
  const probe = useLab((s) => s.probe);
  const stats = useLab((s) => s.stats);
  const lastAction = useLab((s) => s.lastAction);
  if (!probe && !lastAction && !stats.cutActive) return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium tracking-wide text-muted">Probe</p>
      {probe ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
          <dt className="text-subtle">xyz</dt>
          <dd className="text-fg">
            {probe.x.toFixed(2)} {probe.y.toFixed(2)} {probe.z.toFixed(2)}
          </dd>
          <dt className="text-subtle">p</dt>
          <dd className="text-fg">{fmtSci(probe.pressure)}</dd>
          <dt className="text-subtle">ρ</dt>
          <dd className="text-fg">{fmtSci(probe.density)}</dd>
          <dt className="text-subtle">g</dt>
          <dd className="text-fg">{fmtSci(probe.growth)}</dd>
          <dt className="text-subtle">|v|</dt>
          <dd className="text-fg">{fmtSci(probe.speed)}</dd>
        </dl>
      ) : (
        <p className="text-xs text-subtle">Click the chamber to sample a point.</p>
      )}
      {stats.cutActive ? (
        <p className="mt-2 font-mono text-xs tabular-nums text-warn">
          neck ρ {fmtSci(stats.neckDensity)}
        </p>
      ) : null}
      {lastAction ? (
        <p className="mt-2 text-xs text-subtle">{lastAction}</p>
      ) : null}
    </div>
  );
}

function ControlsBody() {
  const morphology = useLab((s) => s.morphology);
  const colorMode = useLab((s) => s.colorMode);
  const showParticles = useLab((s) => s.showParticles);
  const showSlice = useLab((s) => s.showSlice);
  const showLattice = useLab((s) => s.showLattice);
  const slice = useLab((s) => s.slice);
  const turgor = useLab((s) => s.turgor);
  const viscosity = useLab((s) => s.viscosity);
  const cohesion = useLab((s) => s.cohesion);
  const flipRatio = useLab((s) => s.flipRatio);
  const poissonIters = useLab((s) => s.poissonIters);
  const tool = useLab((s) => s.tool);
  const paintRadius = useLab((s) => s.paintRadius);
  const protocol = useLab((s) => s.protocol);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted">Click tool</p>
        <div className="flex flex-wrap gap-1">
          {TOOLS.map((t) => (
            <Chip
              key={t.id}
              active={tool === t.id}
              onClick={() => useLab.getState().setTool(t.id)}
            >
              {t.label}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs leading-snug text-subtle">
          {TOOLS.find((t) => t.id === tool)?.hint}
        </p>
        {tool === "paint" || tool === "erase" ? (
          <div className="mt-2">
            <ParamSlider
              label="Brush"
              value={paintRadius}
              min={0.04}
              max={0.16}
              step={0.005}
              onChange={useLab.getState().setPaintRadius}
              format={(v) => v.toFixed(3)}
            />
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted">Protocol</p>
        <div className="flex flex-wrap gap-1">
          {PROTOCOL_LIST.map((p) => (
            <Chip
              key={p.id}
              active={protocol.kind === p.id}
              onClick={() => useLab.getState().startProtocol(p.id)}
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs leading-snug text-subtle">
          {protocol.kind
            ? PROTOCOLS[protocol.kind].blurb
            : "Named assays that seed, wait, act, and log. Esc aborts."}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted">Morphology</p>
        <div className="flex flex-wrap gap-1">
          {MORPHOLOGIES.map((m) => (
            <Chip
              key={m.id}
              active={morphology === m.id}
              onClick={() => useLab.getState().setMorphology(m.id)}
            >
              {m.label}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs leading-snug text-subtle">
          {MORPHOLOGIES.find((m) => m.id === morphology)?.blurb}
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted">Color</p>
        <div className="flex flex-wrap gap-1">
          {COLORS.map((c) => (
            <Chip
              key={c.id}
              active={colorMode === c.id}
              onClick={() => useLab.getState().setColorMode(c.id)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted">Layers</p>
        <div className="flex flex-wrap gap-1">
          <Chip
            active={showParticles}
            onClick={() => useLab.getState().setShowParticles(!showParticles)}
          >
            Particles
          </Chip>
          <Chip
            active={showSlice}
            onClick={() => useLab.getState().setShowSlice(!showSlice)}
          >
            Pressure
          </Chip>
          <Chip
            active={showLattice}
            onClick={() => useLab.getState().setShowLattice(!showLattice)}
          >
            Lattice
          </Chip>
        </div>
      </div>

      <div className="grid gap-1">
        <ParamSlider
          label="Turgor"
          value={turgor}
          min={0}
          max={4.5}
          step={0.05}
          onChange={useLab.getState().setTurgor}
          format={(v) => v.toFixed(2)}
        />
        <ParamSlider
          label="Viscosity"
          value={viscosity}
          min={0}
          max={0.4}
          step={0.01}
          onChange={useLab.getState().setViscosity}
          format={(v) => v.toFixed(2)}
        />
        <ParamSlider
          label="Cohesion"
          value={cohesion}
          min={0}
          max={4}
          step={0.05}
          onChange={useLab.getState().setCohesion}
          format={(v) => v.toFixed(2)}
        />
        <ParamSlider
          label="FLIP mix"
          value={flipRatio}
          min={0.5}
          max={1}
          step={0.01}
          onChange={useLab.getState().setFlipRatio}
          format={(v) => v.toFixed(2)}
        />
        <ParamSlider
          label="Poisson iters"
          value={poissonIters}
          min={4}
          max={24}
          step={1}
          onChange={(v) => useLab.getState().setPoissonIters(Math.round(v))}
          format={(v) => String(Math.round(v))}
        />
        {showSlice ? (
          <ParamSlider
            label="Slice"
            value={slice}
            min={0}
            max={1}
            step={0.01}
            onChange={useLab.getState().setSlice}
            format={(v) => v.toFixed(2)}
          />
        ) : null}
      </div>

      <RunLog />
    </div>
  );
}

export function Hud() {
  const running = useLab((s) => s.running);
  const stats = useLab((s) => s.stats);
  const sheetOpen = useLab((s) => s.sheetOpen);
  const tool = useLab((s) => s.tool);
  const hasSnapshot = useLab((s) => s.hasSnapshot);
  const protocol = useLab((s) => s.protocol);

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 p-3 sm:p-5">
        <div className="flex h-full flex-col justify-between gap-3">
          <div className="flex min-h-0 flex-1 items-start justify-between gap-3">
            <section className="hud-panel pointer-events-auto max-h-full max-w-[22rem] overflow-y-auto rounded-xl p-4 stagger-in">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-2xl leading-tight tracking-[var(--tracking-display)] text-fg">
                    Morphogenesis Lab
                  </p>
                  <p className="mt-1 hidden text-xs tracking-wide text-muted sm:block">
                    MAC–SPH–Turgor tri-coupled solver
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Purpose and instructions"
                    onClick={() => useLab.getState().openGuide()}
                  >
                    <BookOpen className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Keyboard shortcuts"
                    onClick={() => useLab.getState().toggleKeys()}
                  >
                    <Keyboard className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="icon"
                  aria-label={running ? "Pause" : "Play"}
                  onClick={() => useLab.getState().toggleRunning()}
                >
                  {running ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4 ml-0.5" />
                  )}
                </Button>
                <Button
                  variant="subtle"
                  size="icon"
                  aria-label="Step one tick"
                  onClick={() => useLab.getState().step()}
                >
                  <SkipForward className="size-4" />
                </Button>
                <Button
                  variant="subtle"
                  size="icon"
                  aria-label="Turgor pulse"
                  onClick={() => useLab.getState().pulse()}
                >
                  <Zap className="size-4" />
                </Button>
                <Button
                  variant="subtle"
                  size="icon"
                  aria-label="Cytokinesis sever"
                  onClick={() => useLab.getState().sever()}
                >
                  <Scissors className="size-4" />
                </Button>
                <Button
                  variant="subtle"
                  size="icon"
                  aria-label="Snapshot"
                  onClick={() => useLab.getState().snapshot()}
                >
                  <Camera className="size-4" />
                </Button>
                <Button
                  variant="subtle"
                  size="icon"
                  aria-label="Restore snapshot"
                  disabled={!hasSnapshot}
                  onClick={() => useLab.getState().restore()}
                >
                  <History className="size-4" />
                </Button>
                <Button
                  variant="subtle"
                  size="icon"
                  aria-label="Reset"
                  onClick={() => useLab.getState().reset()}
                >
                  <RotateCcw className="size-4" />
                </Button>
                {protocol.kind ? (
                  <Button
                    variant="subtle"
                    size="icon"
                    aria-label="Abort protocol"
                    onClick={() => useLab.getState().abortProtocol()}
                  >
                    <Square className="size-3.5 fill-current" />
                  </Button>
                ) : null}
                <div className="ml-1 font-mono text-xs tabular-nums text-muted">
                  <span className="text-fg">{stats.tick.toLocaleString()}</span>
                  <span className="mx-1.5 text-subtle">·</span>
                  {stats.dtMs.toFixed(1)} ms
                </div>
              </div>
              <ProtocolMeter />
              <div className="hidden sm:block">
                <Pipeline />
              </div>
              <ProbeReadout />
              <div className="hidden sm:block">
                <Telemetry />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="font-mono text-xs tabular-nums text-muted">
                  N {stats.particleCount.toLocaleString()}
                </p>
                <p
                  className={cn(
                    "font-mono text-xs tabular-nums",
                    stats.conserved ? "text-ok" : "text-danger",
                  )}
                >
                  {stats.conserved ? "MASS OK" : "MASS DRIFT"}
                </p>
              </div>
            </section>

            <section className="hud-panel pointer-events-auto hidden max-h-full w-[20.5rem] overflow-y-auto rounded-xl p-4 md:block">
              <ControlsBody />
            </section>
          </div>

          <div className="flex items-end justify-between gap-3">
            <p className="pointer-events-none max-w-sm text-xs leading-snug text-subtle">
              {tool === "paint" || tool === "erase"
                ? "Drag to paint growth · Release to orbit"
                : `Click to ${tool} · Drag orbits`}
              {" · "}? keys · H purpose
              <span className="mt-1 block">
                Computational morphogenesis — no biological interpretation.
              </span>
            </p>
            <div className="pointer-events-auto flex gap-2 md:hidden">
              <Button
                variant="subtle"
                size="icon"
                aria-label="Purpose and instructions"
                onClick={() => useLab.getState().openGuide()}
              >
                <BookOpen className="size-4" />
              </Button>
              <Button
                variant="subtle"
                size="icon"
                aria-label="Keyboard shortcuts"
                onClick={() => useLab.getState().toggleKeys()}
              >
                <Keyboard className="size-4" />
              </Button>
              <Button
                variant="subtle"
                size="icon"
                aria-label="Cycle click tool"
                onClick={() => {
                  const order: Tool[] = ["inject", "paint", "erase", "probe"];
                  const i = order.indexOf(tool);
                  useLab.getState().setTool(order[(i + 1) % order.length]!);
                }}
              >
                <Crosshair className="size-4" />
              </Button>
              <Button
                variant="subtle"
                onClick={() => useLab.getState().setSheetOpen(true)}
              >
                <SlidersHorizontal className="size-4" />
                Controls
              </Button>
            </div>
          </div>
        </div>
      </div>

      {sheetOpen ? (
        <div className="absolute inset-0 z-20 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-bg/70"
            aria-label="Close controls"
            onClick={() => useLab.getState().setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-xl bg-surface p-4 pb-8 shadow-[var(--shadow-border)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-xl text-fg">Controls</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => useLab.getState().setSheetOpen(false)}
              >
                Close
              </Button>
            </div>
            <ControlsBody />
            <div className="mt-4">
              <ProbeReadout />
              <Telemetry />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
