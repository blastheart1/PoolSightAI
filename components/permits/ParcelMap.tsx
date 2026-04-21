"use client";

import { useEffect } from "react";
import type { Map as LeafletMap } from "leaflet";

interface ParcelMapProps {
  lat: number;
  lon: number;
  address?: string;
}

export default function ParcelMap({ lat, lon, address }: ParcelMapProps) {
  useEffect(() => {
    let map: LeafletMap | null = null;

    async function init() {
      // Leaflet CSS is loaded via global stylesheet — no dynamic CSS import needed
      const L = (await import("leaflet")).default;

      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const container = document.getElementById("parcel-map");
      if (!container) return;

      // Destroy previous instance if re-rendering
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((container as any)._leaflet_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (L as any).DomUtil.remove(container);
        const parent = container.parentElement;
        if (parent) {
          const newDiv = document.createElement("div");
          newDiv.id = "parcel-map";
          newDiv.style.height = "240px";
          newDiv.style.width = "100%";
          parent.appendChild(newDiv);
        }
        return;
      }

      map = L.map("parcel-map", { scrollWheelZoom: false }).setView([lat, lon], 17);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      L.marker([lat, lon])
        .addTo(map)
        .bindPopup(address ?? `${lat.toFixed(6)}, ${lon.toFixed(6)}`)
        .openPopup();
    }

    init();

    return () => {
      if (map) {
        map.remove();
        map = null;
      }
    };
  }, [lat, lon, address]);

  return (
    <div
      id="parcel-map"
      style={{ height: "240px", width: "100%" }}
      className="rounded-md border border-slate-200 overflow-hidden"
    />
  );
}
