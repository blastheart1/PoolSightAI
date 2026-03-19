"use client";

import { useState } from "react";
import clsx from "clsx";
import ConfidenceBadge from "./ConfidenceBadge";
import type { PoolFeature, PoolFeatureType, ConfidenceLevel } from "@/types/permits";
import { ALL_FEATURE_TYPES } from "@/lib/permits/featureRegistry";

const FEATURE_TYPES: PoolFeatureType[] = [...ALL_FEATURE_TYPES];

interface FeatureEditorProps {
  features: PoolFeature[];
  onConfirm: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, override: Partial<PoolFeature>) => void;
  onAdd: (feature: PoolFeature) => void;
}

function FeatureCard({
  feature,
  onConfirm,
  onRemove,
  onEdit,
}: {
  feature: PoolFeature;
  onConfirm: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, override: Partial<PoolFeature>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<PoolFeature>>({});

  const confirmed = feature.engineerConfirmed;

  function saveEdit() {
    onEdit(feature.id, draft);
    setDraft({});
    setEditing(false);
  }

  return (
    <div
      className={clsx(
        "rounded-lg border p-4 transition",
        confirmed
          ? "border-emerald-700 bg-emerald-950/30"
          : "border-amber-700 bg-amber-950/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">
              {feature.label}
            </span>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
              {feature.type.replace(/_/g, " ")}
            </span>
            <ConfidenceBadge level={feature.confidence} />
            {confirmed && (
              <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                Confirmed
              </span>
            )}
          </div>

          {feature.notes && (
            <p className="mt-1 text-xs text-slate-400">{feature.notes}</p>
          )}

          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-300">
            {feature.estimatedWidth && feature.estimatedLength && (
              <span>
                ~{feature.estimatedWidth}ft × {feature.estimatedLength}ft
              </span>
            )}
            {feature.estimatedArea && <span>~{feature.estimatedArea} sqft</span>}
            {feature.material && <span>{feature.material}</span>}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          {!confirmed && (
            <button
              onClick={() => onConfirm(feature.id)}
              className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
            >
              Confirm
            </button>
          )}
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-600"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={() => onRemove(feature.id)}
            className="rounded bg-red-900/60 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-800"
          >
            Remove
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3">
          <label className="text-xs text-slate-400">
            Type
            <select
              defaultValue={feature.type}
              onChange={(e) =>
                setDraft({ ...draft, type: e.target.value as PoolFeatureType })
              }
              className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
            >
              {FEATURE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Label
            <input
              defaultValue={feature.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Width (ft)
            <input
              type="number"
              defaultValue={feature.estimatedWidth ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, estimatedWidth: Number(e.target.value) || undefined })
              }
              className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Length (ft)
            <input
              type="number"
              defaultValue={feature.estimatedLength ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, estimatedLength: Number(e.target.value) || undefined })
              }
              className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Material
            <input
              defaultValue={feature.material ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, material: e.target.value || undefined })
              }
              className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
            />
          </label>
          <label className="text-xs text-slate-400">
            Notes
            <input
              defaultValue={feature.notes ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, notes: e.target.value || undefined })
              }
              className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
            />
          </label>
          <div className="col-span-2 flex justify-end">
            <button
              onClick={saveEdit}
              className="rounded bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeatureEditor({
  features,
  onConfirm,
  onRemove,
  onEdit,
  onAdd,
}: FeatureEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<PoolFeatureType>("other");
  const [newLabel, setNewLabel] = useState("");

  const confirmedCount = features.filter((f) => f.engineerConfirmed).length;

  function handleAdd() {
    if (!newLabel.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      type: newType,
      label: newLabel.trim(),
      confidence: "high" as ConfidenceLevel,
      engineerConfirmed: true,
    });
    setNewLabel("");
    setNewType("other");
    setAdding(false);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-300">
          <span className="text-emerald-400">{confirmedCount}</span> of{" "}
          <span className="text-white">{features.length}</span> features
          confirmed
        </p>
        {confirmedCount === features.length && features.length > 0 && (
          <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            All confirmed
          </span>
        )}
      </div>

      <div className="space-y-2">
        {features.map((f) => (
          <FeatureCard
            key={f.id}
            feature={f}
            onConfirm={onConfirm}
            onRemove={onRemove}
            onEdit={onEdit}
          />
        ))}
      </div>

      {adding ? (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Type
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as PoolFeatureType)}
                className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white"
              >
                {FEATURE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              Label
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Main Pool"
                className="mt-0.5 block w-full rounded bg-slate-800 px-2 py-1 text-xs text-white placeholder:text-slate-600"
              />
            </label>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setAdding(false)}
              className="rounded bg-slate-700 px-3 py-1 text-xs text-white hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!newLabel.trim()}
              className="rounded bg-sky-700 px-3 py-1 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-40"
            >
              Add Feature
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 w-full rounded-lg border border-dashed border-slate-700 py-2 text-center text-xs font-medium text-slate-400 transition hover:border-slate-500 hover:text-white"
        >
          + Add Feature Manually
        </button>
      )}
    </div>
  );
}
