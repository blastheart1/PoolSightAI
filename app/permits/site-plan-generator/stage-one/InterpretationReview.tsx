"use client";

import FeatureEditor from "@/components/permits/FeatureEditor";
import type {
  RenderingInterpretation,
  PoolFeature,
  SiteCondition,
} from "@/types/permits";

interface InterpretationReviewProps {
  interpretation: RenderingInterpretation;
  confirmedFeatures: PoolFeature[];
  onConfirm: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, override: Partial<PoolFeature>) => void;
  onAdd: (feature: PoolFeature) => void;
  onSave: () => void;
  onProceed: () => void;
}

function ConditionCard({ condition }: { condition: SiteCondition }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-amber-400">⚠</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            {condition.description}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Type: {condition.type.replace(/_/g, " ")} · Action:{" "}
            {condition.actionRequired}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function InterpretationReview({
  interpretation,
  confirmedFeatures,
  onConfirm,
  onRemove,
  onEdit,
  onAdd,
  onSave,
  onProceed,
}: InterpretationReviewProps) {
  const allConfirmed =
    confirmedFeatures.length > 0 &&
    confirmedFeatures.every((f) => f.engineerConfirmed);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white">
          Stage 1 — Review AI Interpretation
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Review each feature detected by the AI. Confirm, edit, or remove items
          before proceeding. You can also add features the AI missed.
        </p>
      </div>

      {interpretation.rawDescription && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            AI Description
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">
            {interpretation.rawDescription}
          </p>
        </div>
      )}

      {interpretation.inferredStyle && (
        <p className="text-xs text-slate-400">
          Inferred style:{" "}
          <span className="text-white">{interpretation.inferredStyle}</span>
        </p>
      )}

      {interpretation.materialsIdentified.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {interpretation.materialsIdentified.map((m) => (
            <span
              key={m}
              className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
            >
              {m}
            </span>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-white">Features</h3>
        <FeatureEditor
          features={confirmedFeatures}
          onConfirm={onConfirm}
          onRemove={onRemove}
          onEdit={onEdit}
          onAdd={onAdd}
        />
      </div>

      {interpretation.siteConditions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white">
            Site Conditions
          </h3>
          <div className="space-y-2">
            {interpretation.siteConditions.map((c) => (
              <ConditionCard key={c.id} condition={c} />
            ))}
          </div>
        </div>
      )}

      {interpretation.engineerActionItems.length > 0 && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-500">
            Engineer Action Items
          </h3>
          <ul className="space-y-1 text-sm text-slate-300">
            {interpretation.engineerActionItems.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-amber-500">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          Save Interpretation
        </button>
        <button
          onClick={onProceed}
          disabled={!allConfirmed}
          className="rounded-lg bg-sky-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {allConfirmed
            ? "Proceed to Dimensions →"
            : `Confirm all features to proceed (${confirmedFeatures.filter((f) => f.engineerConfirmed).length}/${confirmedFeatures.length})`}
        </button>
      </div>
    </div>
  );
}
