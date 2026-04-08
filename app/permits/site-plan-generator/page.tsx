"use client";

import { useReducer, useCallback } from "react";
import InterpretationReview from "./stage-one/InterpretationReview";
import DimensionInput from "./stage-two/DimensionInput";
import OutputDownloads from "@/components/permits/OutputDownloads";
import SitePlanPreview from "@/components/permits/SitePlanPreview";
import type {
  RenderingInterpretation,
  PoolFeature,
  SitePlanInputs,
  SitePlanOutputs,
} from "@/types/permits";

type Stage = "upload" | "review" | "dimensions" | "output";

interface State {
  stage: Stage;
  uploadedFile: File | null;
  imagePreviewUrl: string | null;
  interpretation: RenderingInterpretation | null;
  confirmedFeatures: PoolFeature[];
  sitePlanInputs: Partial<SitePlanInputs>;
  outputs: SitePlanOutputs | null;
  isLoading: boolean;
  error: string | null;
}

interface SavedInterpretation {
  version: number;
  savedAt: string;
  interpretation: RenderingInterpretation;
  confirmedFeatures: PoolFeature[];
}

type Action =
  | { type: "SET_FILE"; file: File; previewUrl: string }
  | { type: "SET_INTERPRETATION"; data: RenderingInterpretation }
  | { type: "LOAD_INTERPRETATION"; saved: SavedInterpretation }
  | { type: "CONFIRM_FEATURE"; featureId: string }
  | { type: "REMOVE_FEATURE"; featureId: string }
  | { type: "EDIT_FEATURE"; featureId: string; override: Partial<PoolFeature> }
  | { type: "ADD_FEATURE"; feature: PoolFeature }
  | { type: "UPDATE_INPUTS"; inputs: Partial<SitePlanInputs> }
  | { type: "SET_OUTPUTS"; outputs: SitePlanOutputs }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_ERROR"; error: string }
  | { type: "GO_TO_DIMENSIONS" }
  | { type: "GO_BACK_TO_DIMENSIONS" }
  | { type: "RESET" };

const INITIAL: State = {
  stage: "upload",
  uploadedFile: null,
  imagePreviewUrl: null,
  interpretation: null,
  confirmedFeatures: [],
  sitePlanInputs: {},
  outputs: null,
  isLoading: false,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FILE":
      return { ...state, uploadedFile: action.file, imagePreviewUrl: action.previewUrl, error: null };
    case "SET_INTERPRETATION":
      return { ...state, stage: "review", interpretation: action.data, confirmedFeatures: action.data.features, isLoading: false, error: null };
    case "LOAD_INTERPRETATION":
      return { ...state, stage: "review", interpretation: action.saved.interpretation, confirmedFeatures: action.saved.confirmedFeatures, isLoading: false, error: null };
    case "CONFIRM_FEATURE":
      return { ...state, confirmedFeatures: state.confirmedFeatures.map((f) => f.id === action.featureId ? { ...f, engineerConfirmed: true } : f) };
    case "REMOVE_FEATURE":
      return { ...state, confirmedFeatures: state.confirmedFeatures.filter((f) => f.id !== action.featureId) };
    case "EDIT_FEATURE":
      return { ...state, confirmedFeatures: state.confirmedFeatures.map((f) => f.id === action.featureId ? { ...f, ...action.override } : f) };
    case "ADD_FEATURE":
      return { ...state, confirmedFeatures: [...state.confirmedFeatures, action.feature] };
    case "GO_TO_DIMENSIONS":
      return { ...state, stage: "dimensions", error: null };
    case "UPDATE_INPUTS":
      return { ...state, sitePlanInputs: { ...state.sitePlanInputs, ...action.inputs } };
    case "SET_OUTPUTS":
      return { ...state, stage: "output", outputs: action.outputs, isLoading: false, error: null };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading, error: null };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };
    case "GO_BACK_TO_DIMENSIONS":
      return { ...state, stage: "dimensions", outputs: null };
    case "RESET":
      return INITIAL;
    default:
      return state;
  }
}

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

export default function SitePlanGeneratorPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.has(file.type)) {
      dispatch({ type: "SET_ERROR", error: "Please upload a JPEG, PNG, or PDF file." });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    dispatch({ type: "SET_FILE", file, previewUrl });
    dispatch({ type: "SET_LOADING", isLoading: true });
    try {
      const buf = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), ""));
      const res = await fetch("/api/permits/site-plan-generator/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const json = await res.json();
      if (!json.success) { dispatch({ type: "SET_ERROR", error: json.error }); return; }
      dispatch({ type: "SET_INTERPRETATION", data: json.data });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Upload failed" });
    }
  }, []);

  const handleLoadSaved = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const saved = JSON.parse(text) as SavedInterpretation;
      if (!saved.version || !saved.interpretation || !saved.confirmedFeatures) {
        dispatch({ type: "SET_ERROR", error: "Invalid saved interpretation file. Expected a JSON file previously exported from this tool." });
        return;
      }
      dispatch({ type: "LOAD_INTERPRETATION", saved });
    } catch {
      dispatch({ type: "SET_ERROR", error: "Could not parse the saved file. Make sure it is a valid JSON interpretation export." });
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!state.interpretation) return;
    const payload: SavedInterpretation = {
      version: 1,
      savedAt: new Date().toISOString(),
      interpretation: state.interpretation,
      confirmedFeatures: state.confirmedFeatures,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-plan-interpretation-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.interpretation, state.confirmedFeatures]);

  const handleGenerate = useCallback(async () => {
    if (!state.interpretation) return;
    dispatch({ type: "SET_LOADING", isLoading: true });
    const payload: SitePlanInputs = {
      interpretation: state.interpretation,
      confirmedFeatures: state.confirmedFeatures,
      confirmedDimensions: state.sitePlanInputs.confirmedDimensions ?? {},
      address: state.sitePlanInputs.address,
      lotWidth: state.sitePlanInputs.lotWidth,
      lotDepth: state.sitePlanInputs.lotDepth,
      houseFootprintWidth: state.sitePlanInputs.houseFootprintWidth,
      houseFootprintDepth: state.sitePlanInputs.houseFootprintDepth,
      houseSetbackFromFront: state.sitePlanInputs.houseSetbackFromFront,
      houseSetbackFromLeft: state.sitePlanInputs.houseSetbackFromLeft,
      north: state.sitePlanInputs.north ?? "up",
      scale: state.sitePlanInputs.scale,
    };
    try {
      const res = await fetch("/api/permits/site-plan-generator/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) { dispatch({ type: "SET_ERROR", error: json.error }); return; }
      dispatch({ type: "SET_OUTPUTS", outputs: json.data });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Generation failed" });
    }
  }, [state.interpretation, state.confirmedFeatures, state.sitePlanInputs]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Rendering to Site Plan Generator
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload a rendering or sketch → AI interprets → you confirm → generate SVG, DXF, and data sheet.
          </p>
        </div>
        {state.stage !== "upload" && (
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Start Over
          </button>
        )}
      </div>

      {/* Stage indicator */}
      <div className="flex gap-1">
        {(["upload", "review", "dimensions", "output"] as Stage[]).map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition ${
              i <= ["upload", "review", "dimensions", "output"].indexOf(state.stage)
                ? "bg-blue-500"
                : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      {/* Error */}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {/* Upload */}
      {state.stage === "upload" && (
        <div className="space-y-4">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white py-16 transition hover:border-blue-400 hover:bg-blue-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <svg className="mb-3 h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18.75C3 19.9926 4.00736 21 5.25 21H18.75C19.9926 21 21 19.9926 21 18.75V16.5M16.5 12L12 16.5M12 16.5L7.5 12M12 16.5V3" />
            </svg>
            <span className="text-sm font-medium text-slate-700">Drop a rendering, sketch, or PDF here</span>
            <span className="mt-1 text-xs text-slate-400">JPEG, PNG, or PDF up to 20 MB</span>
          </label>

          {state.isLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              Analyzing rendering with AI...
            </div>
          )}

          {state.imagePreviewUrl && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.imagePreviewUrl} alt="Uploaded rendering" className="max-h-[300px] w-full bg-slate-50 object-contain" />
            </div>
          )}

          {!state.isLoading && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs text-slate-400">or</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
          )}

          {!state.isLoading && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V18.75C3 19.9926 4.00736 21 5.25 21H18.75C19.9926 21 21 19.9926 21 18.75V16.5M16.5 12L12 16.5M12 16.5L7.5 12M12 16.5V3" />
              </svg>
              Load a previously saved interpretation (.json)
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLoadSaved(f); }}
              />
            </label>
          )}
        </div>
      )}

      {/* Review */}
      {state.stage === "review" && state.interpretation && (
        <InterpretationReview
          interpretation={state.interpretation}
          confirmedFeatures={state.confirmedFeatures}
          onConfirm={(id) => dispatch({ type: "CONFIRM_FEATURE", featureId: id })}
          onRemove={(id) => dispatch({ type: "REMOVE_FEATURE", featureId: id })}
          onEdit={(id, override) => dispatch({ type: "EDIT_FEATURE", featureId: id, override })}
          onAdd={(feature) => dispatch({ type: "ADD_FEATURE", feature })}
          onSave={handleSave}
          onProceed={() => dispatch({ type: "GO_TO_DIMENSIONS" })}
        />
      )}

      {/* Dimensions */}
      {state.stage === "dimensions" && (
        <DimensionInput
          confirmedFeatures={state.confirmedFeatures}
          inputs={{ ...state.sitePlanInputs, interpretation: state.interpretation ?? undefined, confirmedFeatures: state.confirmedFeatures }}
          onUpdateInputs={(updates) => dispatch({ type: "UPDATE_INPUTS", inputs: updates })}
          onGenerate={handleGenerate}
          isLoading={state.isLoading}
        />
      )}

      {/* Output */}
      {state.stage === "output" && state.outputs && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Generated Site Plan</h2>
            <button
              onClick={() => dispatch({ type: "GO_BACK_TO_DIMENSIONS" })}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              ← Back to Dimensions
            </button>
          </div>

          <SitePlanPreview
            inputs={{ ...state.sitePlanInputs, interpretation: state.interpretation ?? undefined, confirmedFeatures: state.confirmedFeatures }}
          />

          <OutputDownloads outputs={state.outputs} />

          {/* Data sheet summary */}
          {state.outputs.dataSheet && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Data Sheet Summary</h3>

              {state.outputs.dataSheet.features?.length > 0 && (
                <div className="mb-3">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Features</h4>
                  <ul className="space-y-0.5 text-xs text-slate-600">
                    {state.outputs.dataSheet.features.map((f) => (
                      <li key={f.id} className="flex gap-2">
                        <span className="text-blue-500">•</span>
                        {f.label} ({f.type.replace(/_/g, " ")})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {state.outputs.dataSheet.materialsSchedule?.length > 0 && (
                <div className="mb-3">
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Materials Schedule</h4>
                  <ul className="space-y-0.5 text-xs text-slate-600">
                    {state.outputs.dataSheet.materialsSchedule.map((m, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-blue-500">•</span>
                        {m.item}: {m.material}
                        {m.notes && <span className="text-slate-400"> — {m.notes}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {state.outputs.dataSheet.engineerActionItems?.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-600">Action Items</h4>
                  <ul className="space-y-0.5 text-xs text-slate-600">
                    {state.outputs.dataSheet.engineerActionItems.map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
