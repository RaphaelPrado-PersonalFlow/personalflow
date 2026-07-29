"use client";

import type { VolumeMetric } from "@/lib/training-volume";

type Props = {
  metric: VolumeMetric;
  onChange: (metric: VolumeMetric) => void;
};

export default function VolumeMetricToggle({ metric, onChange }: Props) {
  const next = metric === "series" ? "work" : "series";
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onChange(next);
      }}
      title={metric === "series" ? "Mudar para volume de trabalho" : "Mudar para volume de séries"}
      aria-label={metric === "series" ? "Exibindo volume de séries. Mudar para volume de trabalho" : "Exibindo volume de trabalho. Mudar para volume de séries"}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 text-xs font-semibold text-blue-500 hover:border-blue-500/50"
    >
      <span aria-hidden="true">⇄</span>
      <span>{metric === "series" ? "Séries" : "Trabalho"}</span>
    </button>
  );
}
