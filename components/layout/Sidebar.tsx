"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

const menuItems = [
  { label: "Visão geral", href: "/", icon: "⌂" },
  { label: "Agenda", href: "/agenda", icon: "◫" },
  { label: "Alunos", href: "/alunos", icon: "◎" },
  { label: "Avaliações", href: "/avaliacoes", icon: "◇" },
  { label: "Treinos", href: "/treinos", icon: "△" },
  { label: "Exercícios", href: "/exercicios", icon: "＋" },
  { label: "Relatórios", href: "/relatorios", icon: "▥" },
];

type SidebarProps = { open?: boolean; onClose?: () => void };

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const initials = profile?.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase() || "PF";

  return (
    <>
      {open && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-950/70 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-5 transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-3 px-3">
          <div className="grid size-10 place-items-center rounded-xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-600/20">PF</div>
          <div><p className="text-lg font-semibold tracking-tight">PersonalFlow</p><p className="text-xs text-[var(--muted)]">Gestão inteligente</p></div>
        </div>

        <p className="mb-3 mt-9 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Menu principal</p>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={onClose} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-[var(--muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--foreground)]"}`}>
                <span className="grid size-6 place-items-center text-base" aria-hidden>{item.icon}</span>{item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] pt-4">
          <Link href="/configuracoes" onClick={onClose} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${pathname === "/configuracoes" ? "bg-blue-600 text-white" : "text-[var(--muted)] hover:bg-[var(--surface-raised)]"}`}><span>⚙</span>Configurações</Link>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-[var(--surface-raised)] p-3">
            <div className="grid size-9 place-items-center rounded-full bg-blue-600/15 text-sm font-semibold text-blue-500">{initials}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{profile?.fullName || "Personal trainer"}</p><p className="truncate text-xs text-[var(--muted)]">{profile?.email || "Conta profissional"}</p></div>
            <button type="button" onClick={() => void signOut()} className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]" aria-label="Sair da conta" title="Sair">Sair</button>
          </div>
        </div>
      </aside>
    </>
  );
}
