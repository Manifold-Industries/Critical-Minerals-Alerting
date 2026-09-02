import {
  geoDistance,
  geoGraticule10,
  geoPath,
  type GeoProjection,
} from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import type { Alert } from "@/lib/monitor/alerts";
import {
  GRAPHS,
  nodesById,
  type AlertGraph,
  type GeoNode,
} from "@/lib/monitor/graphs";
import { IMPACT_COLOR, SAFE_COLOR } from "@/lib/monitor/colors";

export type MapMode = "impact" | "alternatives" | "context";

/** Tooltip payload for a hovered node, positioned in panel pixels. */
export interface NodeHover {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly sub?: string;
  readonly detail?: string;
}

type HoverHandler = (hover: NodeHover | null) => void;

// Terminal palette, restated as literals because SVG attributes cannot
// resolve CSS variables.
const ACCENT = "#ffa028";
const GROUND = "#050505";
const OCEAN = "#08080a";
const LAND_FILL = "#1a1a1e";
const LAND_STROKE = "#2a2a30";
const GRATICULE = "#17171a";
const MUTED = "#6f6e66";
const LABEL = "#a3a29a";

const topology = land110 as unknown as Topology;
const LAND = feature(topology, topology.objects.land);
const GRATICULE_10 = geoGraticule10();

interface GlobeSceneProps {
  readonly projection: GeoProjection;
  readonly mode: MapMode;
  readonly graph?: AlertGraph;
  readonly alerts: readonly Alert[];
  readonly selectedAlertId: string;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
  readonly onSelectAlert: (id: string) => void;
  readonly onHoverNode: HoverHandler;
}

interface Projected {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

function project(
  projection: GeoProjection,
  lon: number,
  lat: number,
): Projected {
  const rotate = projection.rotate();
  const point = projection([lon, lat]) ?? [0, 0];
  const visible =
    geoDistance([lon, lat], [-rotate[0], -rotate[1]]) < Math.PI / 2 - 0.01;
  return { x: point[0], y: point[1], visible };
}

function edgePath(
  path: ReturnType<typeof geoPath>,
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): string | undefined {
  return (
    path({
      type: "LineString",
      coordinates: [
        [a.lon, a.lat],
        [b.lon, b.lat],
      ],
    }) ?? undefined
  );
}

function NodeLabel({
  at,
  text,
  color = LABEL,
  size = 10.5,
}: {
  readonly at: Projected;
  readonly text: string;
  readonly color?: string;
  readonly size?: number;
}) {
  if (!at.visible) return null;
  return (
    <text
      x={at.x}
      y={at.y + 15}
      textAnchor="middle"
      fontSize={size}
      fontWeight={600}
      fill={color}
      stroke={GROUND}
      strokeWidth={3}
      paintOrder="stroke"
      className="pointer-events-none select-none"
    >
      {text}
    </text>
  );
}

function NodeDot({
  at,
  r,
  fill,
  stroke,
  strokeWidth = 0,
  selected = false,
  ping = false,
  onClick,
  hover,
  onHover,
}: {
  readonly at: Projected;
  readonly r: number;
  readonly fill: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly selected?: boolean;
  readonly ping?: boolean;
  readonly onClick?: () => void;
  readonly hover?: Omit<NodeHover, "x" | "y">;
  readonly onHover?: HoverHandler;
}) {
  if (!at.visible) return null;
  return (
    <g
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerEnter={
        hover && onHover
          ? () => onHover({ ...hover, x: at.x, y: at.y })
          : undefined
      }
      onPointerLeave={onHover ? () => onHover(null) : undefined}
      className={onClick ? "cursor-pointer" : undefined}
    >
      {ping && (
        <circle
          className="map-ping"
          cx={at.x}
          cy={at.y}
          r={r + 2}
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
        />
      )}
      {selected && (
        <circle
          cx={at.x}
          cy={at.y}
          r={r + 5}
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
        />
      )}
      <circle
        cx={at.x}
        cy={at.y}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {onClick && <circle cx={at.x} cy={at.y} r={r + 8} fill="transparent" />}
    </g>
  );
}

function ImpactLayer({
  projection,
  graph,
  showLabels,
  selectedNodeId,
  onSelectNode,
  onHoverNode,
}: {
  readonly projection: GeoProjection;
  readonly graph: AlertGraph;
  readonly showLabels: boolean;
  readonly selectedNodeId: string | null;
  readonly onSelectNode?: (id: string) => void;
  readonly onHoverNode?: HoverHandler;
}) {
  const path = geoPath(projection);
  const lookup = nodesById(graph);
  const assetAt = project(projection, graph.asset.lon, graph.asset.lat);

  return (
    <g>
      {graph.edges.map((edge) => {
        const from = lookup.get(edge.from);
        const to = lookup.get(edge.to);
        if (!from || !to) return null;
        const target = graph.downstream.find((node) => node.id === edge.to);
        return (
          <path
            key={`${edge.from}-${edge.to}`}
            d={edgePath(path, from, to)}
            fill="none"
            stroke={target ? IMPACT_COLOR[target.impact] : ACCENT}
            strokeWidth={1.25}
            strokeDasharray={edge.transport ? "5 4" : undefined}
            opacity={0.75}
          />
        );
      })}
      {graph.downstream.map((node) => {
        const at = project(projection, node.lon, node.lat);
        return (
          <g key={node.id}>
            <NodeDot
              at={at}
              r={3.5}
              fill={IMPACT_COLOR[node.impact]}
              selected={node.id === selectedNodeId}
              onClick={onSelectNode ? () => onSelectNode(node.id) : undefined}
              hover={{
                name: node.name,
                sub: `${node.role} · ${node.place}`,
                detail: `${node.impact} impact`,
              }}
              onHover={onHoverNode}
            />
            {showLabels && <NodeLabel at={at} text={node.name} />}
          </g>
        );
      })}
      <NodeDot
        at={assetAt}
        r={5}
        fill={ACCENT}
        ping
        selected={graph.asset.id === selectedNodeId}
        onClick={onSelectNode ? () => onSelectNode(graph.asset.id) : undefined}
        hover={{
          name: graph.asset.name,
          sub: `${graph.asset.role} · ${graph.asset.place}`,
          detail: "Affected asset",
        }}
        onHover={onHoverNode}
      />
      {showLabels && (
        <NodeLabel at={assetAt} text={graph.asset.name} color="#e9e7e0" />
      )}
    </g>
  );
}

function AlternativesLayer({
  projection,
  graph,
  selectedNodeId,
  onSelectNode,
  onHoverNode,
}: {
  readonly projection: GeoProjection;
  readonly graph: AlertGraph;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
  readonly onHoverNode: HoverHandler;
}) {
  const path = geoPath(projection);
  const lookup = nodesById(graph);
  const assetAt = project(projection, graph.asset.lon, graph.asset.lat);

  return (
    <g>
      {graph.downstream.map((node) => {
        const at = project(projection, node.lon, node.lat);
        return (
          <g key={node.id} opacity={0.7}>
            <NodeDot
              at={at}
              r={3}
              fill={MUTED}
              selected={node.id === selectedNodeId}
              onClick={() => onSelectNode(node.id)}
              hover={{
                name: node.name,
                sub: `${node.role} · ${node.place}`,
                detail: "Dependent system",
              }}
              onHover={onHoverNode}
            />
            <NodeLabel at={at} text={node.name} size={10} />
          </g>
        );
      })}
      {graph.alternatives.map((alt) => {
        const feeds = lookup.get(alt.feedsNodeId);
        const at = project(projection, alt.lon, alt.lat);
        const opacity = alt.rank === 1 ? 1 : 0.5;
        return (
          <g key={alt.id} opacity={opacity}>
            {feeds && (
              <path
                d={edgePath(path, alt, feeds)}
                fill="none"
                stroke={SAFE_COLOR}
                strokeWidth={1.25}
                strokeDasharray="5 4"
                opacity={0.8}
              />
            )}
            <NodeDot
              at={at}
              r={4.5}
              fill={GROUND}
              stroke={SAFE_COLOR}
              strokeWidth={1.5}
              selected={alt.id === selectedNodeId}
              onClick={() => onSelectNode(alt.id)}
              hover={{
                name: alt.name,
                sub: alt.country,
                detail: `Alternative source · rank ${alt.rank}${
                  feeds ? ` · feeds ${feeds.name}` : ""
                }`,
              }}
              onHover={onHoverNode}
            />
            <NodeLabel at={at} text={`${alt.rank} · ${alt.name}`} />
          </g>
        );
      })}
      <NodeDot
        at={assetAt}
        r={5}
        fill={ACCENT}
        selected={graph.asset.id === selectedNodeId}
        onClick={() => onSelectNode(graph.asset.id)}
        hover={{
          name: graph.asset.name,
          sub: `${graph.asset.role} · ${graph.asset.place}`,
          detail: "Affected asset",
        }}
        onHover={onHoverNode}
      />
      <NodeLabel at={assetAt} text={graph.asset.name} color="#e9e7e0" />
    </g>
  );
}

function ContextLayer({
  projection,
  graph,
  alerts,
  selectedAlertId,
  selectedNodeId,
  onSelectNode,
  onSelectAlert,
  onHoverNode,
}: {
  readonly projection: GeoProjection;
  readonly graph?: AlertGraph;
  readonly alerts: readonly Alert[];
  readonly selectedAlertId: string;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (id: string) => void;
  readonly onSelectAlert: (id: string) => void;
  readonly onHoverNode: HoverHandler;
}) {
  return (
    <g>
      {graph && (
        <g opacity={0.45}>
          <ImpactLayer
            projection={projection}
            graph={graph}
            showLabels={false}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onHoverNode={onHoverNode}
          />
        </g>
      )}
      {alerts
        .filter((alert) => alert.id !== selectedAlertId)
        .map((alert) => {
          const other = GRAPHS[alert.id];
          if (!other) return null;
          const at = project(projection, other.asset.lon, other.asset.lat);
          return (
            <g key={alert.id}>
              <NodeDot
                at={at}
                r={4}
                fill={MUTED}
                stroke={GROUND}
                strokeWidth={1}
                onClick={() => onSelectAlert(alert.id)}
                hover={{
                  name: other.asset.name,
                  sub: `${other.asset.role} · ${other.asset.place}`,
                  detail: `Queued alert · ${alert.title}`,
                }}
                onHover={onHoverNode}
              />
              <NodeLabel at={at} text={other.asset.name} size={10} />
            </g>
          );
        })}
      {graph && (
        <NodeLabel
          at={project(projection, graph.asset.lon, graph.asset.lat)}
          text={graph.asset.name}
          color="#e9e7e0"
        />
      )}
    </g>
  );
}

export default function GlobeScene({
  projection,
  mode,
  graph,
  alerts,
  selectedAlertId,
  selectedNodeId,
  onSelectNode,
  onSelectAlert,
  onHoverNode,
}: GlobeSceneProps) {
  const path = geoPath(projection);

  return (
    <>
      <path d={path({ type: "Sphere" }) ?? undefined} fill={OCEAN} />
      <path
        d={path(GRATICULE_10) ?? undefined}
        fill="none"
        stroke={GRATICULE}
        strokeWidth={0.5}
      />
      <path
        d={path(LAND) ?? undefined}
        fill={LAND_FILL}
        stroke={LAND_STROKE}
        strokeWidth={0.5}
      />
      <path
        d={path({ type: "Sphere" }) ?? undefined}
        fill="none"
        stroke="#2a2a30"
        strokeWidth={1}
      />
      {mode === "impact" && graph && (
        <ImpactLayer
          projection={projection}
          graph={graph}
          showLabels
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onHoverNode={onHoverNode}
        />
      )}
      {mode === "alternatives" && graph && (
        <AlternativesLayer
          projection={projection}
          graph={graph}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onHoverNode={onHoverNode}
        />
      )}
      {mode === "context" && (
        <ContextLayer
          projection={projection}
          graph={graph}
          alerts={alerts}
          selectedAlertId={selectedAlertId}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          onSelectAlert={onSelectAlert}
          onHoverNode={onHoverNode}
        />
      )}
    </>
  );
}

/** Shared node type re-export for panel-side helpers. */
export type { GeoNode };
