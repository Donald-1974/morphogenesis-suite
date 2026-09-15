import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  MorphogenesisTriCoupledSolver,
  visualRadius,
  type ColorMode,
  type SolverSnapshot,
} from "@/lib/solver/solver";
import { packRgb, sampleColormap } from "@/lib/solver/color";
import { PROTOCOLS, type ProtocolKind } from "@/lib/solver/protocol";
import { cn } from "@/lib/utils";
import { useLab, type Tool } from "@/store/lab";

const FIXED = 1 / 48;
const COLOR = { r: 0, g: 0, b: 0 };
const DUMMY = new THREE.Object3D();
const THREE_COLOR = new THREE.Color();

type Machine = {
  kind: ProtocolKind;
  phase: number;
  until: number;
};

function paintAmp(tool: Tool) {
  if (tool === "erase") return -0.7;
  return 0.55;
}

function Sim() {
  const solverRef = useRef<MorphogenesisTriCoupledSolver | null>(null);
  if (!solverRef.current) solverRef.current = new MorphogenesisTriCoupledSolver();
  const solver = solverRef.current;

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const latticeRef = useRef<THREE.InstancedMesh>(null);
  const sliceRef = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const cutRef = useRef<THREE.Mesh>(null);
  const brushRef = useRef<THREE.Mesh>(null);
  const texRef = useRef<THREE.DataTexture | null>(null);
  const slicePix = useRef<Uint8Array | null>(null);
  const acc = useRef(0);
  const seeded = useRef(false);
  const drag = useRef({ x: 0, y: 0, active: false, painting: false });
  const lastPaint = useRef(0);
  const lastPaintPos = useRef(new THREE.Vector3(99, 99, 99));
  const snapRef = useRef<SolverSnapshot | null>(null);
  const machine = useRef<Machine | null>(null);
  const pendingProto = useRef<ProtocolKind | null>(null);

  const morphology = useLab((s) => s.morphology);
  const resetId = useLab((s) => s.resetId);
  const pulseId = useLab((s) => s.pulseId);
  const stepId = useLab((s) => s.stepId);
  const severId = useLab((s) => s.severId);
  const snapshotId = useLab((s) => s.snapshotId);
  const restoreId = useLab((s) => s.restoreId);
  const protocolId = useLab((s) => s.protocolId);
  const abortId = useLab((s) => s.abortId);
  const showParticles = useLab((s) => s.showParticles);
  const showSlice = useLab((s) => s.showSlice);
  const showLattice = useLab((s) => s.showLattice);

  const n = solver.nParticles;
  const radius = visualRadius(n);

  const sliceTex = useMemo(() => {
    const data = new Uint8Array(solver.nx * solver.ny * 4);
    const tex = new THREE.DataTexture(
      data,
      solver.nx,
      solver.ny,
      THREE.RGBAFormat,
    );
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    texRef.current = tex;
    slicePix.current = new Uint8Array(solver.nx * solver.ny);
    return tex;
  }, [solver.nx, solver.ny]);

  const enterPhase = (i: number) => {
    const m = machine.current;
    if (!m) return;
    const spec = PROTOCOLS[m.kind];
    if (i >= spec.phases.length) {
      useLab.getState().logRun(spec.label);
      useLab.getState().setRunning(false);
      useLab.getState().setProtocol({
        kind: null,
        phase: "done",
        progress: 1,
        until: 0,
      });
      useLab.getState().setLastAction(`${spec.label} complete`);
      machine.current = null;
      return;
    }
    const phase = spec.phases[i]!;
    m.phase = i;
    if (phase.action === "sever") {
      solver.sever();
      const [cx, cy, cz] = solver.centerOfMass();
      useLab.getState().setProbe(solver.probeAt(cx, cy, cz));
      useLab.getState().setLastAction("protocol: cytokinesis sever");
      useLab.getState().setStats(solver.readStats());
      enterPhase(i + 1);
      return;
    }
    if (phase.action === "pulse") {
      solver.injectTurgorPulse();
      const [cx, cy, cz] = solver.centerOfMass();
      useLab.getState().setProbe(solver.probeAt(cx, cy, cz));
      useLab.getState().setLastAction("protocol: turgor pulse");
      enterPhase(i + 1);
      return;
    }
    const ticks = phase.ticks ?? 48;
    m.until = solver.tickCount + ticks;
    useLab.getState().setProtocol({
      kind: m.kind,
      phase: phase.name,
      progress: 0,
      until: m.until,
    });
    useLab.getState().setRunning(true);
  };

  const arm = (kind: ProtocolKind) => {
    machine.current = { kind, phase: 0, until: 0 };
    enterPhase(0);
  };

  useEffect(() => {
    solver.reseed(morphology);
    useLab.getState().clearHistory();
    const params = useLab.getState();
    for (let i = 0; i < 10; i++) {
      solver.executePhysicsTick(FIXED, {
        turgor: params.turgor,
        viscosity: params.viscosity,
        cohesion: params.cohesion,
        flipRatio: params.flipRatio,
        poissonIters: params.poissonIters,
      });
    }
    seeded.current = true;
    useLab.getState().setStats(solver.readStats());
    if (pendingProto.current) {
      const k = pendingProto.current;
      pendingProto.current = null;
      arm(k);
    } else if (machine.current) {
      machine.current = null;
    }
    // arm is stable enough for this effect; protocol start uses pendingProto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morphology, resetId, solver]);

  useEffect(() => {
    if (!seeded.current) return;
    if (pulseId === 0) return;
    solver.injectTurgorPulse();
    const [cx, cy, cz] = solver.centerOfMass();
    useLab.getState().setProbe(solver.probeAt(cx, cy, cz));
  }, [pulseId, solver]);

  useEffect(() => {
    if (!seeded.current) return;
    if (severId === 0) return;
    solver.sever();
    const [cx, cy, cz] = solver.centerOfMass();
    useLab.getState().setProbe(solver.probeAt(cx, cy, cz));
    useLab.getState().setStats(solver.readStats());
  }, [severId, solver]);

  useEffect(() => {
    if (!seeded.current) return;
    if (stepId === 0) return;
    const s = useLab.getState();
    solver.executePhysicsTick(FIXED, {
      turgor: s.turgor,
      viscosity: s.viscosity,
      cohesion: s.cohesion,
      flipRatio: s.flipRatio,
      poissonIters: s.poissonIters,
    });
    useLab.getState().setStats(solver.readStats());
  }, [stepId, solver]);

  useEffect(() => {
    if (!seeded.current) return;
    if (snapshotId === 0) return;
    snapRef.current = solver.capture();
    useLab.getState().markSnapshot(true);
  }, [snapshotId, solver]);

  useEffect(() => {
    if (!seeded.current) return;
    if (restoreId === 0) return;
    const snap = snapRef.current;
    if (!snap) return;
    machine.current = null;
    solver.restore(snap);
    useLab.getState().clearHistory();
    useLab.getState().setStats(solver.readStats());
    const [cx, cy, cz] = solver.centerOfMass();
    useLab.getState().setProbe(solver.probeAt(cx, cy, cz));
  }, [restoreId, solver]);

  useEffect(() => {
    if (!seeded.current) return;
    if (protocolId === 0) return;
    const kind = useLab.getState().protocolKind;
    const spec = PROTOCOLS[kind];
    if (spec.seed && useLab.getState().morphology !== spec.seed) {
      pendingProto.current = kind;
      useLab.getState().setMorphology(spec.seed, { keepProtocol: true });
      return;
    }
    arm(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolId, solver]);

  useEffect(() => {
    if (abortId === 0) return;
    if (pendingProto.current) return;
    machine.current = null;
  }, [abortId]);

  useEffect(() => {
    const api = {
      stats: () => solver.readStats(),
      tool: () => useLab.getState().tool,
      protocol: () => useLab.getState().protocol,
      hasSnapshot: () => useLab.getState().hasSnapshot,
      runs: () => useLab.getState().runs.length,
      snapshot: () => useLab.getState().snapshot(),
      restore: () => useLab.getState().restore(),
      startProtocol: (k: ProtocolKind) => useLab.getState().startProtocol(k),
      logRun: (label = "manual") => useLab.getState().logRun(label),
      abort: () => useLab.getState().abortProtocol(),
    };
    (window as Window & { __lab?: typeof api }).__lab = api;
    return () => {
      delete (window as Window & { __lab?: typeof api }).__lab;
    };
  }, [solver]);

  useEffect(() => {
    return () => {
      sliceTex.dispose();
    };
  }, [sliceTex]);

  useEffect(() => {
    const up = () => {
      if (!drag.current.painting) return;
      drag.current.painting = false;
      drag.current.active = false;
      useLab.getState().setOrbitLock(false);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  useFrame((_, delta) => {
    const state = useLab.getState();
    const d = Math.min(delta, 0.1);
    acc.current += d;
    let steps = 0;
    if (state.running) {
      while (acc.current >= FIXED && steps < 2) {
        solver.executePhysicsTick(FIXED, {
          turgor: state.turgor,
          viscosity: state.viscosity,
          cohesion: state.cohesion,
          flipRatio: state.flipRatio,
          poissonIters: state.poissonIters,
        });
        acc.current -= FIXED;
        steps += 1;
      }
    } else {
      acc.current = 0;
    }
    if (steps > 0) {
      if (state.probe) {
        state.setProbe(solver.probeAt(state.probe.x, state.probe.y, state.probe.z));
      }
      state.setStats(solver.readStats());
      const m = machine.current;
      if (m) {
        const spec = PROTOCOLS[m.kind];
        const phase = spec.phases[m.phase];
        if (phase?.ticks) {
          const left = m.until - solver.tickCount;
          const prog = 1 - left / phase.ticks;
          state.setProtocol({
            kind: m.kind,
            phase: phase.name,
            progress: Math.min(1, Math.max(0, prog)),
            until: m.until,
          });
          if (solver.tickCount >= m.until) enterPhase(m.phase + 1);
        }
      }
    }

    const mesh = meshRef.current;
    if (mesh && state.showParticles) {
      const pos = solver.sphPositions;
      const scale = solver.colorScale(state.colorMode);
      const span = scale.hi - scale.lo || 1;
      for (let i = 0; i < n; i++) {
        DUMMY.position.set(pos[i * 3]! - 0.5, pos[i * 3 + 1]! - 0.5, pos[i * 3 + 2]! - 0.5);
        DUMMY.scale.setScalar(radius);
        DUMMY.updateMatrix();
        mesh.setMatrixAt(i, DUMMY.matrix);
        const raw = solver.sampleScalar(state.colorMode, i);
        sampleColormap((raw - scale.lo) / span, COLOR);
        THREE_COLOR.setRGB(COLOR.r, COLOR.g, COLOR.b);
        mesh.setColorAt(i, THREE_COLOR);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    if (state.showSlice && texRef.current && slicePix.current) {
      const k = Math.round(state.slice * (solver.nz - 1));
      solver.slicePressure(k, slicePix.current);
      const data = texRef.current.image.data as Uint8Array;
      for (let i = 0; i < slicePix.current.length; i++) {
        const t = slicePix.current[i]! / 255;
        const [r, g, b] = packRgb(t);
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = 200;
      }
      texRef.current.needsUpdate = true;
      const slice = sliceRef.current;
      if (slice) slice.position.z = state.slice - 0.5;
    }

    const lat = latticeRef.current;
    if (lat && state.showLattice) {
      const occ = 0.12;
      let written = 0;
      const max = lat.count;
      const scale = solver.colorScale("density");
      const span = scale.hi - scale.lo || 1;
      for (let k = 0; k < solver.nz && written < max; k++) {
        for (let j = 0; j < solver.ny && written < max; j++) {
          for (let i = 0; i < solver.nx && written < max; i++) {
            const id = solver.idx(i, j, k);
            const m = solver.mass[id]!;
            if (m < occ) continue;
            DUMMY.position.set(
              (solver.nx <= 1 ? 0.5 : i / (solver.nx - 1)) - 0.5,
              (solver.ny <= 1 ? 0.5 : j / (solver.ny - 1)) - 0.5,
              (solver.nz <= 1 ? 0.5 : k / (solver.nz - 1)) - 0.5,
            );
            DUMMY.scale.setScalar(0.008);
            DUMMY.updateMatrix();
            lat.setMatrixAt(written, DUMMY.matrix);
            sampleColormap((m - scale.lo) / span, COLOR);
            THREE_COLOR.setRGB(COLOR.r, COLOR.g, COLOR.b);
            lat.setColorAt(written, THREE_COLOR);
            written += 1;
          }
        }
      }
      for (let i = written; i < max; i++) {
        DUMMY.position.set(0, -10, 0);
        DUMMY.scale.setScalar(0);
        DUMMY.updateMatrix();
        lat.setMatrixAt(i, DUMMY.matrix);
      }
      lat.instanceMatrix.needsUpdate = true;
      if (lat.instanceColor) lat.instanceColor.needsUpdate = true;
    }

    const marker = markerRef.current;
    if (marker) {
      const probe = state.probe;
      marker.visible = Boolean(probe);
      if (probe) {
        marker.position.set(probe.x - 0.5, probe.y - 0.5, probe.z - 0.5);
      }
    }

    const cutMesh = cutRef.current;
    if (cutMesh) {
      const on = solver.cutTicks > 0;
      cutMesh.visible = on;
      if (on) {
        cutMesh.position.set(0, 0, 0);
        cutMesh.rotation.set(0, 0, 0);
        const o = solver.cutOrigin - 0.5;
        if (solver.cutAxis === 0) {
          cutMesh.rotation.y = Math.PI / 2;
          cutMesh.position.x = o;
        } else if (solver.cutAxis === 1) {
          cutMesh.rotation.x = Math.PI / 2;
          cutMesh.position.y = o;
        } else {
          cutMesh.position.z = o;
        }
      }
    }

    const brush = brushRef.current;
    if (brush) {
      const painting = state.tool === "paint" || state.tool === "erase";
      brush.visible = painting && drag.current.painting;
      if (brush.visible) {
        brush.scale.setScalar(state.paintRadius * 2);
      }
    }
  });

  const latticeCount = Math.min(solver.nCells, 900);

  const applyPaint = (point: THREE.Vector3, force = false) => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (!force && now - lastPaint.current < 32) return;
    if (!force && lastPaintPos.current.distanceToSquared(point) < 0.0009) return;
    lastPaint.current = now;
    lastPaintPos.current.copy(point);
    const lab = useLab.getState();
    solver.paintAt(
      point.x + 0.5,
      point.y + 0.5,
      point.z + 0.5,
      paintAmp(lab.tool),
      lab.paintRadius,
    );
    lab.setProbe(solver.probeAt(point.x + 0.5, point.y + 0.5, point.z + 0.5));
    const brush = brushRef.current;
    if (brush) brush.position.copy(point);
  };

  const onHit = (point: THREE.Vector3) => {
    const x = point.x + 0.5;
    const y = point.y + 0.5;
    const z = point.z + 0.5;
    const lab = useLab.getState();
    if (lab.tool === "inject") {
      solver.injectAt(x, y, z);
      lab.setLastAction(`inject ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
    } else if (lab.tool === "paint" || lab.tool === "erase") {
      applyPaint(point, true);
      lab.setLastAction(
        `${lab.tool} ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`,
      );
    } else {
      lab.setLastAction(`probe ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);
    }
    lab.setProbe(solver.probeAt(x, y, z));
    lab.setStats(solver.readStats());
  };

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, n]}
        frustumCulled={false}
        visible={showParticles}
        castShadow={false}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          roughness={0.36}
          metalness={0.18}
          vertexColors
          toneMapped
        />
      </instancedMesh>

      <instancedMesh
        ref={latticeRef}
        args={[undefined, undefined, latticeCount]}
        frustumCulled={false}
        visible={showLattice}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>

      <mesh ref={sliceRef} visible={showSlice} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={sliceTex}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh
        ref={cutRef}
        visible={false}
        frustumCulled={false}
        renderOrder={2}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#c5cdd8"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={markerRef} visible={false} renderOrder={3} frustumCulled={false}>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial color="#e8eaef" toneMapped={false} />
      </mesh>

      <mesh ref={brushRef} visible={false} renderOrder={4} frustumCulled={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#c5cdd8"
          wireframe
          transparent
          opacity={0.45}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <mesh
        onPointerDown={(e) => {
          const lab = useLab.getState();
          const painting = lab.tool === "paint" || lab.tool === "erase";
          drag.current = {
            x: e.nativeEvent.clientX,
            y: e.nativeEvent.clientY,
            active: true,
            painting,
          };
          if (painting) {
            e.stopPropagation();
            const target = e.nativeEvent.target as HTMLElement | null;
            target?.setPointerCapture?.(e.nativeEvent.pointerId);
            lab.setOrbitLock(true);
            applyPaint(e.point, true);
            const brush = brushRef.current;
            if (brush) brush.position.copy(e.point);
          }
        }}
        onPointerMove={(e) => {
          if (!drag.current.painting) return;
          e.stopPropagation();
          applyPaint(e.point);
          const brush = brushRef.current;
          if (brush) brush.position.copy(e.point);
        }}
        onPointerUp={(e) => {
          if (!drag.current.active) return;
          const wasPaint = drag.current.painting;
          drag.current.active = false;
          drag.current.painting = false;
          if (wasPaint) {
            useLab.getState().setOrbitLock(false);
            return;
          }
          const dx = e.nativeEvent.clientX - drag.current.x;
          const dy = e.nativeEvent.clientY - drag.current.y;
          if (dx * dx + dy * dy > 36) return;
          e.stopPropagation();
          onHit(e.point);
        }}
        onPointerLeave={() => {
          if (!drag.current.painting) return;
          drag.current.active = false;
          drag.current.painting = false;
          useLab.getState().setOrbitLock(false);
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

function ChamberFrame() {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial transparent opacity={0.035} color="#8ea0b8" />
      <lineSegments>
        <edgesGeometry args={[geo]} />
        <lineBasicMaterial color="#3a4250" />
      </lineSegments>
    </mesh>
  );
}

function toolCursor(tool: Tool) {
  if (tool === "paint" || tool === "erase") return "cursor-crosshair";
  if (tool === "probe") return "cursor-cell";
  return "cursor-crosshair";
}

export function Chamber() {
  const tool = useLab((s) => s.tool);
  const orbitLock = useLab((s) => s.orbitLock);
  return (
    <Canvas
      className={cn("h-full w-full touch-none", toolCursor(tool))}
      frameloop="always"
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      camera={{ position: [1.22, 0.78, 1.38], fov: 40, near: 0.05, far: 24 }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#07080b");
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        scene.fog = new THREE.FogExp2("#07080b", 0.22);
      }}
    >
      <hemisphereLight args={["#9aabc0", "#08090c", 0.72]} />
      <ambientLight intensity={0.12} />
      <directionalLight position={[1.5, 2.1, 1.2]} intensity={1.05} />
      <directionalLight position={[-1.2, 0.4, -0.8]} intensity={0.22} color="#7f93a8" />
      <ChamberFrame />
      <Sim />
      <ContactShadows
        opacity={0.42}
        scale={2.2}
        blur={2.6}
        far={1.1}
        position={[0, -0.505, 0]}
        color="#000000"
      />
      <OrbitControls
        makeDefault
        enabled={!orbitLock}
        enablePan={false}
        minDistance={0.7}
        maxDistance={3.4}
        target={[0, 0, 0]}
        autoRotate={!orbitLock}
        autoRotateSpeed={0.28}
        dampingFactor={0.08}
        enableDamping
      />
    </Canvas>
  );
}

export type { ColorMode };
