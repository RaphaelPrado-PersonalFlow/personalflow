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
  const width = 600, height = 300;
  const padding = { top: 42, right: 28, bottom: 48, left: 46 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const pointGap = ordered.length <= 1 ? 0 : Math.min(96, plotWidth / (ordered.length - 1));
  const usedWidth = pointGap * Math.max(0, ordered.length - 1);
  const firstX = padding.left + (plotWidth - usedWidth) / 2;
  const x = (index: number) => ordered.length <= 1 ? width / 2 : firstX + index * pointGap;

  const series = metrics.map((metric) => {
    const rawPoints = ordered.map((assessment, index) => ({ index, value: metric.getValue(assessment) })).filter((point): point is { index: number; value: number } => typeof point.value === "number" && point.value > 0);
    const baseline = rawPoints[0]?.value;
    return { metric, points: baseline ? rawPoints.map((point) => ({ ...point, change: (point.value - baseline) / baseline * 100 })) : [] };
  });
  const allChanges = series.flatMap((item) => item.points.map((point) => point.change));
  const changeLimit = Math.max(5, Math.ceil(Math.max(...allChanges.map(Math.abs), 0) / 5) * 5);
  const y = (change: number) => padding.top + (changeLimit - change) / (changeLimit * 2) * plotHeight;

  return <div>
    <div className="mb-4 flex flex-wrap gap-4">
      {metrics.map((metric) => {
        const latest = [...ordered].reverse().find((item) => metric.getValue(item));
        const value = latest ? metric.getValue(latest) : undefined;
        return <div key={metric.key} className="flex items-center gap-2 text-xs"><span className="size-2.5 rounded-full" style={{ backgroundColor: metric.color }} /><span className="text-[var(--muted)]">{metric.label}</span>{value !== undefined && <strong>{formatValue(value, metric.unit)}</strong>}</div>;
      })}
    </div>
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label="Gráfico de evolução percentual das medidas selecionadas">
        {[-changeLimit, -changeLimit / 2, 0, changeLimit / 2, changeLimit].map((change) => <g key={change}><line x1={padding.left} x2={width - padding.right} y1={y(change)} y2={y(change)} stroke={change === 0 ? "var(--muted)" : "var(--border)"} strokeWidth={change === 0 ? "1.5" : "1"} /><text x={padding.left - 8} y={y(change) + 4} fill="var(--muted)" fontSize="10" textAnchor="end">{change > 0 ? "+" : ""}{change}%</text></g>)}
        {ordered.map((assessment, index) => <text key={assessment.id} x={x(index)} y={height - 16} fill="var(--muted)" fontSize="11" textAnchor="middle">{assessment.date.slice(0, 5)}</text>)}
        {series.map(({ metric, points }, seriesIndex) => {
          if (!points.length) return null;
          const path = points.map((point, position) => `${position === 0 ? "M" : "L"} ${x(point.index)} ${y(point.change)}`).join(" ");
          return <g key={metric.key}>{points.length > 1 && <path d={path} fill="none" stroke={metric.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}{points.map((point) => { const labelY = y(point.change) - 12 - seriesIndex * 13; return <g key={`${metric.key}-${point.index}`}><circle cx={x(point.index)} cy={y(point.change)} r="5" fill={metric.color} stroke="var(--surface)" strokeWidth="3" /><text x={x(point.index)} y={labelY} fill={metric.color} fontSize="10" fontWeight="700" textAnchor="middle">{point.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</text></g>; })}</g>;
        })}
      </svg>
    </div>
    <p className="mt-3 text-xs text-[var(--muted)]">As linhas mostram a variação percentual desde a primeira avaliação. Os números junto aos pontos são os valores reais de cada medida.</p>
  </div>;
}
