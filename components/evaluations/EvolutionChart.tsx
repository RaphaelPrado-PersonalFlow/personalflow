"use client";

export type ChartAssessment = {
  id: number;
  date: string;
  weight: number;
  bodyFat: number;
  leanMass: number;
  circumferences?: Record<string, number>;
  skinfolds?: Record<string, number>;
};

export type ChartMetric = {
  key: string;
  label: string;
  unit: string;
  color: string;
  getValue: (assessment: ChartAssessment) => number | undefined;
};

type EvolutionChartProps = { assessments: ChartAssessment[]; metrics: ChartMetric[] };

function parseDate(date: string) {
  const [day, month, year] = date.split("/").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function formatValue(value: number, unit: string) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unit}`;
}

export default function EvolutionChart({ assessments, metrics }: EvolutionChartProps) {
  const ordered = [...assessments].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const width = 760, height = 300;
  const padding = { top: 34, right: 28, bottom: 48, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index: number) => padding.left + (ordered.length <= 1 ? plotWidth / 2 : index * plotWidth / (ordered.length - 1));

  return <div>
    <div className="mb-4 flex flex-wrap gap-4">
      {metrics.map((metric) => {
        const latest = [...ordered].reverse().find((item) => metric.getValue(item));
        const value = latest ? metric.getValue(latest) : undefined;
        return <div key={metric.key} className="flex items-center gap-2 text-xs"><span className="size-2.5 rounded-full" style={{ backgroundColor: metric.color }} /><span className="text-[var(--muted)]">{metric.label}</span>{value !== undefined && <strong>{formatValue(value, metric.unit)}</strong>}</div>;
      })}
    </div>
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[620px]" role="img" aria-label="Gráfico de evolução das medidas selecionadas">
        {[0, .25, .5, .75, 1].map((ratio) => { const y = padding.top + ratio * plotHeight; return <line key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--border)" />; })}
        {ordered.map((assessment, index) => <text key={assessment.id} x={x(index)} y={height - 16} fill="var(--muted)" fontSize="11" textAnchor="middle">{assessment.date.slice(0, 5)}</text>)}
        {metrics.map((metric) => {
          const points = ordered.map((assessment, index) => ({ index, value: metric.getValue(assessment) })).filter((point): point is { index: number; value: number } => typeof point.value === "number" && point.value > 0);
          if (!points.length) return null;
          const values = points.map((point) => point.value), min = Math.min(...values), max = Math.max(...values);
          const spread = max - min || Math.max(max * .1, 1);
          const y = (value: number) => padding.top + plotHeight - ((value - min) / spread * plotHeight * .76 + plotHeight * .12);
          const path = points.map((point, position) => `${position === 0 ? "M" : "L"} ${x(point.index)} ${y(point.value)}`).join(" ");
          return <g key={metric.key}>{points.length > 1 && <path d={path} fill="none" stroke={metric.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}{points.map((point) => <g key={`${metric.key}-${point.index}`}><circle cx={x(point.index)} cy={y(point.value)} r="5" fill={metric.color} stroke="var(--surface)" strokeWidth="3" /><text x={x(point.index)} y={y(point.value) - 11} fill={metric.color} fontSize="11" fontWeight="700" textAnchor="middle">{point.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</text></g>)}</g>;
        })}
      </svg>
    </div>
    <p className="mt-3 text-xs text-[var(--muted)]">Cada linha usa uma escala visual própria para destacar a tendência. Os valores reais aparecem nos pontos e na legenda.</p>
  </div>;
}
