"use client";

import { useEffect } from "react";

export default function Header({ onMenu }: { onMenu: () => void }) {
  const currentDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  useEffect(() => {
    const saved = localStorage.getItem("personalflow-theme");
    const isDark = saved !== "light";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, []);
  function toggleTheme() {
    const next = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("personalflow-theme", next ? "dark" : "light");
  }
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[color:var(--background)]/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button onClick={onMenu} className="rounded-lg border border-[var(--border)] px-3 py-2 lg:hidden" aria-label="Abrir menu">☰</button>
      <div className="hidden sm:block"><p className="text-sm capitalize text-[var(--muted)]">{currentDate}</p></div>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={toggleTheme} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] transition hover:bg-[var(--surface-raised)]" aria-label="Alternar tema">◐</button>
        <button className="relative grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)]" aria-label="Notificações">♢<span className="absolute right-2 top-2 size-2 rounded-full bg-blue-500" /></button>
      </div>
    </header>
  );
}
