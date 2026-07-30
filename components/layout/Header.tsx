"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type HeaderProps = { onMenu?: () => void };

export default function Header({ onMenu }: HeaderProps) {
  const { profile, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const currentDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
  const initials = profile?.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase() || "PF";

  useEffect(() => {
    document.documentElement.dataset.theme =
      localStorage.getItem("personalflow-theme") || "dark";
  }, []);

  useEffect(() => {
    function closeProfileMenu(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", closeProfileMenu);
    return () => document.removeEventListener("mousedown", closeProfileMenu);
  }, []);

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("personalflow-theme", nextTheme);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onMenu} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] lg:hidden" aria-label="Abrir menu">☰</button>
        <span className="truncate text-sm capitalize text-[var(--muted)]">{currentDate}</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggleTheme} className="grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)]" aria-label="Alternar tema">◐</button>
        <button type="button" className="relative grid size-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)]" aria-label="Notificações">♢<span className="absolute right-2 top-2 size-2 rounded-full bg-blue-500" /></button>
        <div ref={profileMenuRef} className="relative">
          <button type="button" onClick={() => setProfileOpen((open) => !open)} className="grid size-10 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white" aria-label="Abrir menu da conta" aria-expanded={profileOpen}>{initials}</button>
          {profileOpen ? (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl">
              <p className="truncate text-sm font-semibold">{profile?.fullName || "Personal trainer"}</p>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">{profile?.email}</p>
              <button type="button" onClick={() => void signOut()} className="mt-3 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-raised)]">Sair da conta</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
