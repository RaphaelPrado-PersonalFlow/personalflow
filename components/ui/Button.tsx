import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };
export default function Button({ variant = "primary", className = "", ...props }: Props) {
  const styles = { primary: "bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20", secondary: "border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)]", ghost: "text-[var(--muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]" };
  return <button className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:opacity-50 ${styles[variant]} ${className}`} {...props} />;
}
