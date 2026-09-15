import { Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHORTCUT_GROUPS } from "@/lib/solver/keys";
import { useLab } from "@/store/lab";

export function ShortcutList() {
  return (
    <div className="grid gap-6">
      {SHORTCUT_GROUPS.map((group) => (
        <section key={group.id}>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted">
            {group.label}
          </p>
          <dl>
            {group.items.map((row) => (
              <div
                key={`${group.id}-${row.keys.join("-")}-${row.action}`}
                className="grid grid-cols-[7.5rem_1fr] items-baseline gap-3 border-t border-border py-2 first:border-t-0"
              >
                <dt className="flex flex-wrap gap-1">
                  {row.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </dt>
                <dd className="text-sm text-muted">{row.action}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function Shortcuts() {
  const open = useLab((s) => s.keysOpen);
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-bg/70"
        aria-label="Close keyboard shortcuts"
        onClick={() => useLab.getState().closeKeys()}
      />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-3 sm:items-center sm:p-5">
        <section
          role="dialog"
          aria-labelledby="shortcuts-title"
          className="pointer-events-auto hud-panel max-h-[min(78vh,40rem)] w-full max-w-lg overflow-y-auto rounded-xl p-4 sm:p-5"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Keyboard className="size-4 shrink-0 text-muted" />
              <h2
                id="shortcuts-title"
                className="font-display text-xl tracking-[var(--tracking-display)] text-fg"
              >
                Keyboard shortcuts
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close keyboard shortcuts"
              onClick={() => useLab.getState().closeKeys()}
            >
              <X className="size-4" />
            </Button>
          </div>
          <p className="mb-5 text-sm text-pretty text-muted">
            One key, one action. Press{" "}
            <kbd>?</kbd> to open or close this list.
          </p>
          <ShortcutList />
        </section>
      </div>
    </div>
  );
}
