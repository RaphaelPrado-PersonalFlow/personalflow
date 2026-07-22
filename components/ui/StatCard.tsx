import Card from "./Card";
export default function StatCard({ title, value, detail, tone = "blue" }: { title: string; value: string | number; detail: string; tone?: "blue" | "green" | "amber" | "violet" }) {
  const tones = { blue: "bg-blue-500", green: "bg-emerald-500", amber: "bg-amber-500", violet: "bg-violet-500" };
  return <Card><div className="flex items-start justify-between"><div><p className="text-sm text-[var(--muted)]">{title}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p></div><span className={`mt-1 size-2.5 rounded-full ${tones[tone]}`} /></div><p className="mt-4 text-xs text-[var(--muted)]">{detail}</p></Card>;
}
