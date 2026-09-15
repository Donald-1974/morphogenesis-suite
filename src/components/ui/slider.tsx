import { cn } from "@/lib/utils";

export function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="grid grid-cols-[1fr_auto] items-center gap-x-3">
      <span className="text-xs font-medium tracking-wide text-muted">{label}</span>
      <span className="font-mono text-xs tabular-nums text-fg">{format(value)}</span>
      <input
        type="range"
        className={cn("range col-span-2")}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </label>
  );
}
