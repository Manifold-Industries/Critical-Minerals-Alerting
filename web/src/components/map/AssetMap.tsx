"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { GraphNode } from "@/lib/api/types";
import type { LocatedAsset } from "@/lib/map/markers";

// Leaflet's default icon paths break under bundlers; declare them explicitly.
const icon = L.icon({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  tooltipAnchor: [14, -28],
  shadowSize: [41, 41],
});

interface AssetMapProps {
  assets: LocatedAsset[];
  onSelect: (node: GraphNode) => void;
}

/** Client-only Leaflet map of every asset with attested coordinates. */
export function AssetMap({ assets, onSelect }: AssetMapProps) {
  const center: [number, number] =
    assets.length > 0 ? [assets[0].latitude, assets[0].longitude] : [0, 0];

  return (
    <MapContainer center={center} zoom={4} minZoom={2} className="h-full w-full">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {assets.map((asset) => (
        <Marker
          key={asset.node.id}
          position={[asset.latitude, asset.longitude]}
          icon={icon}
          eventHandlers={{ click: () => onSelect(asset.node) }}
        >
          <Tooltip>{asset.node.name}</Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
