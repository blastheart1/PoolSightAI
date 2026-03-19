"use client";

import { useState } from "react";
import SitePlanPreview from "@/components/permits/SitePlanPreview";
import type { PoolFeature, SitePlanInputs } from "@/types/permits";

interface DimensionInputProps {
  confirmedFeatures: PoolFeature[];
  inputs: Partial<SitePlanInputs>;
  onUpdateInputs: (updates: Partial<SitePlanInputs>) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

export default function DimensionInput({
  confirmedFeatures,
  inputs,
  onUpdateInputs,
  onGenerate,
  isLoading,
}: DimensionInputProps) {
  const [dims, setDims] = useState<SitePlanInputs["confirmedDimensions"]>(
    inputs.confirmedDimensions ?? {},
  );

  function updateDim(
    featureId: string,
    key: "width" | "length" | "area",
    value: string,
  ) {
    const next = {
      ...dims,
      [featureId]: {
        ...dims[featureId],
        [key]: value ? Number(value) : undefined,
      },
    };
    setDims(next);
    onUpdateInputs({ confirmedDimensions: next });
  }

  const allConfirmed =
    confirmedFeatures.length > 0 &&
    confirmedFeatures.every((f) => f.engineerConfirmed);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">
          Stage 2 — Dimensions & Site Info
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Enter known dimensions and lot info. The preview updates live as you
          type.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: inputs */}
        <div className="space-y-5">
          {/* Lot info */}
          <fieldset className="rounded-lg border border-slate-800 p-4">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lot & House
            </legend>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="text-xs text-slate-400">
                Address
                <input
                  defaultValue={inputs.address ?? ""}
                  onChange={(e) => onUpdateInputs({ address: e.target.value })}
                  placeholder="123 Main St, LA"
                  className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1.5 text-xs text-white placeholder:text-slate-600"
                />
              </label>
              <label className="text-xs text-slate-400">
                North
                <select
                  defaultValue={inputs.north ?? "up"}
                  onChange={(e) =>
                    onUpdateInputs({
                      north: e.target.value as SitePlanInputs["north"],
                    })
                  }
                  className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1.5 text-xs text-white"
                >
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Lot width (ft)
                <input
                  type="number"
                  defaultValue={inputs.lotWidth ?? ""}
                  onChange={(e) =>
                    onUpdateInputs({
                      lotWidth: Number(e.target.value) || undefined,
                    })
                  }
                  className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                Lot depth (ft)
                <input
                  type="number"
                  defaultValue={inputs.lotDepth ?? ""}
                  onChange={(e) =>
                    onUpdateInputs({
                      lotDepth: Number(e.target.value) || undefined,
                    })
                  }
                  className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                House width (ft)
                <input
                  type="number"
                  defaultValue={inputs.houseFootprintWidth ?? ""}
                  onChange={(e) =>
                    onUpdateInputs({
                      houseFootprintWidth: Number(e.target.value) || undefined,
                    })
                  }
                  className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                House depth (ft)
                <input
                  type="number"
                  defaultValue={inputs.houseFootprintDepth ?? ""}
                  onChange={(e) =>
                    onUpdateInputs({
                      houseFootprintDepth: Number(e.target.value) || undefined,
                    })
                  }
                  className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                Setback from front (ft)
                <input
                  type="number"
                  defaultValue={inputs.houseSetbackFromFront ?? ""}
                  onChange={(e) =>
                    onUpdateInputs({
                      houseSetbackFromFront:
                        Number(e.target.value) || undefined,
                    })
                  }
                  className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </label>
              <label className="text-xs text-slate-400">
                Setback from left (ft)
                <input
                  type="number"
                  defaultValue={inputs.houseSetbackFromLeft ?? ""}
                  onChange={(e) =>
                    onUpdateInputs({
                      houseSetbackFromLeft:
                        Number(e.target.value) || undefined,
                    })
                  }
                  className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1.5 text-xs text-white"
                />
              </label>
            </div>
          </fieldset>

          {/* Feature dimensions */}
          <fieldset className="rounded-lg border border-slate-800 p-4">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Feature Dimensions
            </legend>
            <div className="space-y-3 pt-1">
              {confirmedFeatures.map((f) => (
                <div
                  key={f.id}
                  className="rounded border border-slate-800 bg-slate-900/40 p-3"
                >
                  <p className="mb-1.5 text-xs font-semibold text-white">
                    {f.label}{" "}
                    <span className="font-normal text-slate-500">
                      ({f.type.replace(/_/g, " ")})
                    </span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[10px] text-slate-400">
                      Width (ft)
                      <input
                        type="number"
                        defaultValue={
                          dims[f.id]?.width ?? f.estimatedWidth ?? ""
                        }
                        onChange={(e) =>
                          updateDim(f.id, "width", e.target.value)
                        }
                        className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="text-[10px] text-slate-400">
                      Length (ft)
                      <input
                        type="number"
                        defaultValue={
                          dims[f.id]?.length ?? f.estimatedLength ?? ""
                        }
                        onChange={(e) =>
                          updateDim(f.id, "length", e.target.value)
                        }
                        className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
                      />
                    </label>
                    <label className="text-[10px] text-slate-400">
                      Area (sqft)
                      <input
                        type="number"
                        defaultValue={
                          dims[f.id]?.area ?? f.estimatedArea ?? ""
                        }
                        onChange={(e) =>
                          updateDim(f.id, "area", e.target.value)
                        }
                        className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>

          <button
            onClick={onGenerate}
            disabled={!allConfirmed || isLoading}
            className="w-full rounded-lg bg-sky-700 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Generating..." : "Generate Site Plan"}
          </button>
        </div>

        {/* Right: live preview */}
        <SitePlanPreview inputs={{ ...inputs, confirmedDimensions: dims }} />
      </div>
    </div>
  );
}
