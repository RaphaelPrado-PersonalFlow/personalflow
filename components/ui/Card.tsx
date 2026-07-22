import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode; title?: string; value?: string | number };

export default function Card({ children, title, value, className = "", ...props }: CardProps) {
  return <div className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm ${className}`} {...props}>{children ?? <><p className="text-sm text-[var(--muted)]">{title}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p></>}</div>;
}
