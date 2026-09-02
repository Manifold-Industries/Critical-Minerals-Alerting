"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { geoCentroid, geoDistance, geoOrthographic } from "d3-geo";
import {
  IconFocusCentered,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import type { Alert } from "@/lib/monitor/alerts";
import { graphForAlert, type AlertGraph } from "@/lib/monitor/graphs";
import { IMPACT_COLOR, SAFE_COLOR } from "@/lib/monitor/colors";
import GlobeScene, { type MapMode } from "./GlobeScene";

interface GlobePanelProps {
  readonly alerts: readonly Alert[];
  readonly selectedAlert: Alert;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
  readonly onSelectAlert: (id: string) => void;
}

interface Camera {
  readonly rotate: readonly [number, number];
  readonly scale: number;
}

interface Size {
  readonly w: number;
  readonly h: number;
}

const MODES: readonly { id: MapMode; label: string; hint: string }[] = [
  {
    id: "impact",
    label: "Impact",
    hint: "Downstream systems exposed by this disruption",
  },
  {
    id: "alternatives",
    label: "Alternatives",
    hint: "Ranked alternative sources for the affected supply",
  },
  {
    id: "context",
    label: "Context",
    hint: "All queued alerts · click a node to select",
  },
];

const FLY_MS = 650;
const MAX_ZOOM = 8;
const MIN_ZOOM = 0.9;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Shortest signed angular difference, so fly-to never spins the long way. */
function shortestAngle(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function baseScale(size: Size): number {
  return Math.max(Math.min(size.w, size.h) / 2 - 24, 80);
}

function pointsForMode(
  mode: MapMode,
  graph: AlertGraph,
): readonly [number, number][] {
  const core: [number, number][] = [
    [graph.asset.lon, graph.asset.lat],
    ...graph.downstream.map(
      (node) => [node.lon, node.lat] as [number, number],
    ),
  ];
  if (mode !== "alternatives") return core;
  return [
    ...core,
    ...graph.alternatives.map(
      (alt) => [alt.lon, alt.lat] as [number, number],
    ),
  ];
}

/** Camera that centers the mode's nodes and scales the globe to fit them. */
function fitCamera(
  mode: MapMode,
  graph: AlertGraph | undefined,
  size: Size,
): Camera {
  const base = baseScale(size);
  if (!graph) return { rotate: [0, -20], scale: base };
  const points = pointsForMode(mode, graph);
  const centroid = geoCentroid({ type: "MultiPoint", coordinates: [...points] });
  const rotate: [number, number] = [-centroid[0], -centroid[1]];
  if (mode === "context") return { rotate, scale: base };
  const maxDist = points.reduce(
    (max, point) => Math.max(max, geoDistance(point, centroid)),
    0,
  );
  const angle = Math.min(maxDist * 1.3 + 0.08, Math.PI / 2 - 0.05);
  const scale = Math.min(
    base / Math.sin(Math.max(angle, 0.15)),
    base * MAX_ZOOM * 0.6,
  );
  return { rotate, scale };
}

export default function GlobePanel({
  alerts,
  selectedAlert,
  selectedNodeId,
  onSelectNode,
  onSelectAlert,
}: GlobePanelProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [mode, setMode] = useState<MapMode>("impact");
  const [camera, setCamera] = useState<Camera>({ rotate: [0, -20], scale: 200 });

  const cameraRef = useRef(camera);
  const sizeRef = useRef(size);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);
  useEffect(() => {
    sizeRef.current = size;
  }, [size]);
  const animRef = useRef<number | null>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    rotate: readonly [number, number];
  } | null>(null);
  const dragMovedRef = useRef(false);
  const initializedRef = useRef(false);

  const graph = graphForAlert(selectedAlert.id);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stopAnim = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const flyTo = useCallback(
    (target: Camera, animate: boolean) => {
      stopAnim();
      if (!animate) {
        setCamera(target);
        return;
      }
      const from = cameraRef.current;
      const dLon = shortestAngle(from.rotate[0], target.rotate[0]);
      const dLat = target.rotate[1] - from.rotate[1];
      const scaleRatio = target.scale / from.scale;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min((now - start) / FLY_MS, 1);
        const e = easeInOutCubic(t);
        setCamera({
          rotate: [from.rotate[0] + dLon * e, from.rotate[1] + dLat * e],
          scale: from.scale * Math.pow(scaleRatio, e),
        });
        animRef.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [stopAnim],
  );

  useEffect(() => stopAnim, [stopAnim]);

  // Fly (or jump, on first layout) whenever the alert or mode changes.
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    flyTo(fitCamera(mode, graph, { w: size.w, h: size.h }), initializedRef.current);
    initializedRef.current = true;
  }, [selectedAlert.id, mode, graph, size.w, size.h, flyTo]);

  const clampScale = useCallback((scale: number, s: Size) => {
    const base = baseScale(s);
    return Math.min(Math.max(scale, base * MIN_ZOOM), base * MAX_ZOOM);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      stopAnim();
      setCamera((prev) => ({
        ...prev,
        scale: clampScale(prev.scale * factor, sizeRef.current),
      }));
    },
    [clampScale, stopAnim],
  );

  // Wheel zoom needs a non-passive listener to preventDefault page scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(Math.exp(-event.deltaY * 0.0015));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      rotate: cameraRef.current.rotate,
    };
    dragMovedRef.current = false;
    stopAnim();
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragMovedRef.current = true;
    const degPerPx = 57.3 / cameraRef.current.scale;
    setCamera((prev) => ({
      ...prev,
      rotate: [
        drag.rotate[0] + dx * degPerPx,
        Math.min(Math.max(drag.rotate[1] - dy * degPerPx, -89), 89),
      ],
    }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const guardClick = useCallback(
    (handler: (id: string) => void) => (id: string) => {
      if (!dragMovedRef.current) handler(id);
    },
    [],
  );

  const projection = useMemo(
    () =>
      geoOrthographic()
        .translate([size.w / 2, size.h / 2])
        .scale(camera.scale)
        .rotate([camera.rotate[0], camera.rotate[1], 0])
        .clipAngle(90),
    [size.w, size.h, camera],
  );

  const activeMode = MODES.find((entry) => entry.id === mode) ?? MODES[0];

  return (
    <section
      ref={wrapRef}
      className="blueprint relative min-h-0 overflow-hidden"
    >
      {size.w > 0 && (
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="img"
          aria-label="Globe of the selected alert's dependency network"
        >
          <GlobeScene
            projection={projection}
            mode={mode}
            graph={graph}
            alerts={alerts}
            selectedAlertId={selectedAlert.id}
            selectedNodeId={selectedNodeId}
            onSelectNode={guardClick(onSelectNode)}
            onSelectAlert={guardClick(onSelectAlert)}
          />
        </svg>
      )}

      {/* Top-left: mode switch + hint */}
      <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
        <div className="flex border border-surface-2 bg-surface-1">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setMode(entry.id)}
              className={`cursor-pointer px-2.5 py-1.5 font-mono text-[10px] font-medium tracking-[0.15em] uppercase transition-colors ${
                entry.id === mode
                  ? "bg-accent-tint text-accent"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <p className="border border-surface-2 bg-surface-1/90 px-2 py-1 font-mono text-[10px] tracking-[0.1em] text-text-tertiary uppercase">
          {activeMode.hint}
        </p>
      </div>

      {/* Top-right: zoom stack */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.4)}
          className="cursor-pointer border border-surface-2 bg-surface-1 p-1.5 text-text-secondary transition-colors hover:bg-ghost-hover hover:text-foreground"
        >
          <IconPlus size={14} stroke={1.5} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / 1.4)}
          className="cursor-pointer border border-surface-2 bg-surface-1 p-1.5 text-text-secondary transition-colors hover:bg-ghost-hover hover:text-foreground"
        >
          <IconMinus size={14} stroke={1.5} />
        </button>
        <button
          type="button"
          aria-label="Recenter"
          onClick={() => flyTo(fitCamera(mode, graph, sizeRef.current), true)}
          className="cursor-pointer border border-surface-2 bg-surface-1 p-1.5 text-text-secondary transition-colors hover:bg-ghost-hover hover:text-foreground"
        >
          <IconFocusCentered size={14} stroke={1.5} />
        </button>
      </div>

      {/* Bottom-left: legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 border border-surface-2 bg-surface-1/90 px-2.5 py-1.5">
        {(
          [
            ["High", IMPACT_COLOR.high],
            ["Medium", IMPACT_COLOR.medium],
            ["Low", IMPACT_COLOR.low],
          ] as const
        ).map(([label, color]) => (
          <span
            key={label}
            className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] text-text-secondary uppercase"
          >
            <span
              className="inline-block size-[7px] rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-[0.12em] text-text-secondary uppercase">
          <span
            className="inline-block size-[7px] rounded-full border-[1.5px]"
            style={{ borderColor: SAFE_COLOR }}
          />
          Alternative
        </span>
      </div>
    </section>
  );
}
