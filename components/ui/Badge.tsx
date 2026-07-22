import type { ReactNode } from "react";
export default function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "info" }) {
  const tones = { neutral: "bg-slate-500/10 text-slate-400", success: "bg-emerald-500/10 text-emerald-500", warning: "bg-amber-500/10 text-amber-500", info: "bg-blue-500/10 text-blue-500" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
