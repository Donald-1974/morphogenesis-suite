import { ArrowRight, BookOpen, X } from "lucide-react";
import { ShortcutList } from "@/components/lab/Shortcuts";
import { Button } from "@/components/ui/button";
import { MORPHOLOGIES } from "@/lib/solver/seeds";
import { useLab } from "@/store/lab";

const SECTIONS = [
  { id: "purpose", n: "01", label: "Purpose" },
  { id: "start", n: "02", label: "First session" },
  { id: "coupling", n: "03", label: "Coupling" },
  { id: "tick", n: "04", label: "A tick" },
  { id: "bench", n: "05", label: "The bench" },
  { id: "keys", n: "06", label: "Keys" },
  { id: "limits", n: "07", label: "Limits" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Enter and watch",
    body: "Budding is already seeded. Let it run. Residual should fall. MASS OK should stay green. That is the unperturbed baseline.",
  },
  {
    n: "02",
    title: "Snapshot",
    body: "Camera stores positions, velocities, growth, and pressure. Restore returns to that exact tick. Take one before every perturbation.",
  },
  {
    n: "03",
    title: "Perturb",
    body: "Inject clicks a Gaussian turgor pulse. Paint and Erase drag the growth field. Probe pins a live sample of p, ρ, g, and |v|.",
  },
  {
    n: "04",
    title: "Read the numbers",
    body: "Telemetry is residual (quiet) over kinetic (bright). Overlay a logged run as dashed lines. CSV exports the tick series.",
  },
  {
    n: "05",
    title: "Run an assay",
    body: "Fission assay seeds, elongates, severs, splits, and logs. Pulse response and Settle are shorter holds. Esc aborts.",
  },
  {
    n: "06",
    title: "Log the answer",
    body: "Log writes residual, kinetic, mass drift, and neck density. Last twelve persist in this browser. That is the experiment memory.",
  },
];

const TOOLS = [
  {
    name: "Inject",
    body: "Click a point in the chamber. Adds a Gaussian to the growth field and kicks nearby particles outward.",
  },
  {
    name: "Paint / Erase",
    body: "Drag to write or suppress growth. Orbit unlocks on release. Radius is on the right rail. Color switches to Growth so you can see the field you are writing.",
  },
  {
    name: "Probe",
    body: "Click to pin a live sample of pressure, density, growth, and speed. The readout updates every tick.",
  },
  {
    name: "Snapshot",
    body: "Stores positions, velocities, growth, and pressure. Restore returns to that exact tick. Use it as the control before a perturbation.",
  },
];

const PROTOCOLS = [
  {
    name: "Fission assay",
    body: "Seeds the fission morphology, elongates 64 ticks, severs the neck, splits 80 ticks, then logs.",
  },
  {
    name: "Pulse response",
    body: "Turgor pulse at the center of mass, then 64 ticks of relaxation.",
  },
  {
    name: "Settle",
    body: "Holds the current field for 48 ticks and logs residual and mass.",
  },
];

function EnterControl() {
  return (
    <Button
      variant="primary"
      className="h-11 px-5"
      onClick={() => useLab.getState().closeGuide()}
    >
      Enter the chamber
      <ArrowRight className="size-4" />
    </Button>
  );
}

export function Guide({ onClose }: { onClose?: () => void }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen className="size-4 shrink-0 text-muted" />
            <p className="truncate text-sm text-muted">
              Morphogenesis Lab
              <span className="mx-2 text-subtle">/</span>
              <span className="text-fg">Purpose</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EnterControl />
            {onClose ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close purpose page"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-16">
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-24 grid gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="grid grid-cols-[2rem_1fr] items-baseline gap-2 rounded-sm px-2 py-2 text-sm text-muted transition-colors duration-[var(--motion-quick)] ease-[var(--ease-out)] hover:bg-fg/8 hover:text-fg"
                >
                  <span className="font-mono text-xs tabular-nums text-subtle">
                    {s.n}
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="stagger-in max-w-2xl">
          <p className="text-xs font-medium tracking-wide text-muted">
            Instruction and purpose
          </p>
          <h1 className="mt-3 font-display text-2xl leading-tight tracking-[var(--tracking-display)] text-fg">
            A chamber for computational morphogenesis
          </h1>
          <p className="mt-4 text-base leading-normal text-pretty text-muted">
            This is an instrument, not a game and not a cell. Particles carry
            mass. The grid enforces incompressibility. Turgor steers form. You
            seed a morphology, write the growth field, and read whether residual,
            kinetic energy, and mass drift behave as the coupling predicts.
          </p>
          <p className="mt-3 text-sm text-subtle">
            Computational morphogenesis — no biological interpretation.
          </p>

          <section id="purpose" className="mt-12 scroll-mt-24">
            <SectionHead n="01" title="Purpose" />
            <p className="mt-3 text-sm leading-normal text-pretty text-muted">
              Morphogenesis Lab exists so a tri-coupled solver can be used, not
              merely watched. The original sketch was a GPU MAC–SPH–turgor loop
              with a mass invariant. This chamber is the honest browser port of
              that loop: you can perturb it, checkpoint it, run a named assay,
              and keep the numbers.
            </p>
            <p className="mt-3 text-sm leading-normal text-pretty text-muted">
              Use it to ask a narrow question. What does a turgor pulse do to
              residual. Whether a painted growth cap buds. Whether a fission
              neck actually thins after sever. The run log is the memory of
              those questions.
            </p>
          </section>

          <section id="start" className="mt-12 scroll-mt-24">
            <SectionHead n="02" title="First session" />
            <p className="mt-3 text-sm leading-normal text-pretty text-muted">
              One pass through the bench. After that, the book icon or H brings
              you back here without losing the chamber.
            </p>
            <ol className="mt-4 grid gap-0">
              {STEPS.map((step) => (
                <li
                  key={step.n}
                  className="grid grid-cols-[2rem_1fr] gap-3 border-t border-border py-3 first:border-t-0"
                >
                  <span className="font-mono text-xs tabular-nums text-subtle">
                    {step.n}
                  </span>
                  <div>
                    <p className="text-sm text-fg">{step.title}</p>
                    <p className="mt-1 text-sm text-pretty text-muted">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-xs font-medium tracking-wide text-muted">
              Morphologies
            </p>
            <ul className="mt-3 grid gap-0">
              {MORPHOLOGIES.map((m, i) => (
                <li
                  key={m.id}
                  className="grid grid-cols-[2rem_1fr] gap-3 border-t border-border py-2.5 first:border-t-0"
                >
                  <span className="font-mono text-xs tabular-nums text-subtle">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm text-fg">{m.label}</p>
                    <p className="mt-0.5 text-sm text-pretty text-muted">
                      {m.blurb}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section id="coupling" className="mt-12 scroll-mt-24">
            <SectionHead n="03" title="Coupling" />
            <p className="mt-3 text-sm leading-normal text-pretty text-muted">
              Three representations share one tick. Lagrangian SPH particles
              hold position, velocity, and unit mass. A collocated MAC grid
              holds velocity, pressure, mapped density, and the growth field.
              Poisson turgor projects the velocity so the fluid stays nearly
              incompressible while growth sources expansion.
            </p>
            <ul className="mt-4 grid gap-3">
              <Fact
                k="Mass"
                v="Lagrangian mass is N × 1 by construction. The useful number is Eulerian mapped mass and the drift flag."
              />
              <Fact
                k="Turgor"
                v="Right-hand side includes κ (ρ − ρ₀(1+g)) / ρ₀. Growth is the morphogenetic control field."
              />
              <Fact
                k="Cohesion"
                v="Particles accelerate along ∇ρ — a cheap surface-tension analogue. A cut plane attenuates it and adds a separating kick."
              />
            </ul>
          </section>

          <section id="tick" className="mt-12 scroll-mt-24">
            <SectionHead n="04" title="A tick" />
            <ol className="mt-4 grid gap-2">
              {[
                ["01", "P2G", "Scatter particle mass and momentum onto the grid."],
                [
                  "02",
                  "Poisson / turgor",
                  "Solve ∇²p = ∇·u / dt + turgor term. Subtract ∇p from velocity.",
                ],
                [
                  "03",
                  "G2P + integrate",
                  "FLIP/PIC interpolate back. Advance positions under a CFL clamp.",
                ],
                [
                  "04",
                  "Mass invariant",
                  "Compare Lagrangian N to mapped Eulerian mass. MASS OK means relative drift < 1e-3.",
                ],
              ].map(([n, name, detail]) => (
                <li
                  key={n}
                  className="grid grid-cols-[2rem_1fr] gap-3 border-t border-border py-3 first:border-t-0"
                >
                  <span className="font-mono text-xs tabular-nums text-subtle">
                    {n}
                  </span>
                  <div>
                    <p className="text-sm text-fg">{name}</p>
                    <p className="mt-1 text-sm text-pretty text-muted">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="bench" className="mt-12 scroll-mt-24">
            <SectionHead n="05" title="The bench" />
            <p className="mt-3 text-sm leading-normal text-pretty text-muted">
              Work left to right. Seed a morphology. Snapshot. Perturb. Compare
              telemetry. Restore if you need the control. Log the run when the
              question is answered.
            </p>
            <div className="mt-5 grid gap-4">
              {TOOLS.map((t) => (
                <div key={t.name} className="border-t border-border pt-3">
                  <p className="text-sm text-fg">{t.name}</p>
                  <p className="mt-1 text-sm text-pretty text-muted">{t.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-xs font-medium tracking-wide text-muted">
              Protocols
            </p>
            <div className="mt-3 grid gap-4">
              {PROTOCOLS.map((t) => (
                <div key={t.name} className="border-t border-border pt-3">
                  <p className="text-sm text-fg">{t.name}</p>
                  <p className="mt-1 text-sm text-pretty text-muted">{t.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="keys" className="mt-12 scroll-mt-24">
            <SectionHead n="06" title="Keys" />
            <p className="mt-3 text-sm leading-normal text-pretty text-muted">
              One key, one action. From the chamber, press <kbd>?</kbd> or the
              keyboard icon for this list without leaving the run.
            </p>
            <div className="mt-4">
              <ShortcutList />
            </div>
            <p className="mt-4 text-sm text-subtle">
              Click tools use a six-pixel threshold so a drag still orbits.
              Paint and erase capture the pointer until release.
            </p>
          </section>

          <section id="limits" className="mt-12 scroll-mt-24">
            <SectionHead n="07" title="Limits" />
            <ul className="mt-4 grid gap-3 text-sm leading-normal text-pretty text-muted">
              <li>
                Collocated MAC, not staggered. Grid is 12³ to 18³; particle count
                is about 900 to 2400, chosen from viewport and density.
              </li>
              <li>
                N is fixed. Cytokinesis severs the field and kicks two lobes
                apart. It does not duplicate particles.
              </li>
              <li>
                Growth is static except for inject, paint, pulse, and sever.
                There is no biology, no membrane, no genome.
              </li>
              <li>
                This is not the 128³ CuPy sketch. It is the same coupling at a
                resolution the browser can hold at a fixed 1/48 s tick.
              </li>
            </ul>
          </section>

          <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-border pt-8">
            <EnterControl />
            <p className="text-sm text-subtle">
              H reopens this page from the chamber.
            </p>
          </div>
        </article>
      </div>
    </div>
  );
}

function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <h2 className="grid grid-cols-[2rem_1fr] items-baseline gap-3 font-display text-xl tracking-[var(--tracking-display)] text-fg">
      <span className="font-mono text-xs tabular-nums text-subtle">{n}</span>
      {title}
    </h2>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <li className="grid gap-1 border-t border-border pt-3 sm:grid-cols-[7rem_1fr] sm:gap-3">
      <p className="font-mono text-xs tabular-nums text-subtle">{k}</p>
      <p className="text-sm text-pretty text-muted">{v}</p>
    </li>
  );
}
