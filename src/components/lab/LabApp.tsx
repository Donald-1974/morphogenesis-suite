import { useEffect } from "react";
import { Chamber } from "@/components/lab/Chamber";
import { Guide } from "@/components/lab/Guide";
import { Hud } from "@/components/lab/Hud";
import { Shortcuts } from "@/components/lab/Shortcuts";
import { downloadTelemetry } from "@/components/lab/Telemetry";
import { cn } from "@/lib/utils";
import { useLab } from "@/store/lab";

export function LabApp() {
  const guideOpen = useLab((s) => s.guideOpen);
  const entered = useLab((s) => s.entered);

  useEffect(() => {
    useLab.getState().hydrateRuns();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (useLab.getState().guideOpen) {
        if (e.code === "Escape" || e.code === "Enter") {
          e.preventDefault();
          useLab.getState().closeGuide();
        }
        return;
      }

      if (e.key === "?" || e.key === "/") {
        e.preventDefault();
        useLab.getState().toggleKeys();
        return;
      }

      if (useLab.getState().keysOpen) {
        if (e.code === "Escape") {
          e.preventDefault();
          useLab.getState().closeKeys();
        }
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        useLab.getState().toggleRunning();
      } else if (e.code === "Escape") {
        if (useLab.getState().protocol.kind) useLab.getState().abortProtocol();
      } else if (e.code === "KeyH") {
        useLab.getState().openGuide();
      } else if (e.code === "KeyR") {
        useLab.getState().reset();
      } else if (e.code === "KeyT") {
        useLab.getState().pulse();
      } else if (e.code === "KeyC") {
        useLab.getState().sever();
      } else if (e.code === "KeyE") {
        downloadTelemetry();
      } else if (e.code === "KeyI") {
        useLab.getState().setTool("inject");
      } else if (e.code === "KeyP") {
        useLab.getState().setTool("probe");
      } else if (e.code === "KeyG") {
        useLab.getState().setTool("paint");
      } else if (e.code === "KeyX") {
        useLab.getState().setTool("erase");
      } else if (e.code === "KeyS") {
        useLab.getState().snapshot();
      } else if (e.code === "KeyL") {
        useLab.getState().restore();
      } else if (e.code === "KeyF") {
        useLab.getState().startProtocol("fission");
      } else if (e.code === "KeyD") {
        useLab.getState().logRun("manual");
      } else if (e.code === "Period" || e.code === "KeyN") {
        useLab.getState().step();
      } else if (e.code === "Digit1") {
        useLab.getState().setMorphology("protoplast");
      } else if (e.code === "Digit2") {
        useLab.getState().setMorphology("budding");
      } else if (e.code === "Digit3") {
        useLab.getState().setMorphology("fission");
      } else if (e.code === "Digit4") {
        useLab.getState().setMorphology("polar");
      } else if (e.code === "Digit5") {
        useLab.getState().setMorphology("blastula");
      } else if (e.code === "Digit6") {
        useLab.getState().setMorphology("dual");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showChamber = entered;

  return (
    <main
      className={cn(
        "w-full bg-bg text-fg",
        showChamber ? "relative h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      {showChamber ? (
        <>
          <Chamber />
          <Hud />
          <Shortcuts />
        </>
      ) : null}
      {guideOpen ? (
        <div
          className={
            showChamber
              ? "absolute inset-0 z-30 overflow-y-auto"
              : "min-h-dvh"
          }
        >
          <Guide
            onClose={
              showChamber ? () => useLab.getState().closeGuide() : undefined
            }
          />
        </div>
      ) : null}
    </main>
  );
}
