"use client";

import { useEffect, useRef, useState } from "react";
import { generateSitePlanSvg } from "@/lib/permits/sitePlanSvg";
import type { SitePlanInputs } from "@/types/permits";

interface SitePlanPreviewProps {
  inputs: Partial<SitePlanInputs>;
}

const EMPTY_INTERPRETATION = {
  features: [],
  siteConditions: [],
  materialsIdentified: [],
  engineerActionItems: [],
  rawDescription: "",
};

export default function SitePlanPreview({ inputs }: SitePlanPreviewProps) {
  const [svg, setSvg] = useState("");
  const [zoom, setZoom] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const full: SitePlanInputs = {
        interpretation: inputs.interpretation ?? EMPTY_INTERPRETATION,
        confirmedFeatures: inputs.confirmedFeatures ?? [],
        confirmedDimensions: inputs.confirmedDimensions ?? {},
        ...inputs,
      };
      setSvg(generateSitePlanSvg(full));
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inputs]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">
          Site Plan Preview
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="rounded bg-slate-800 px-2 py-0.5 text-xs text-white hover:bg-slate-700"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="min-w-[40px] text-center text-xs text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="rounded bg-slate-800 px-2 py-0.5 text-xs text-white hover:bg-slate-700"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-slate-800 bg-white">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
