"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("fullName") ?? "").trim();
    const supabase = createClient();

    if (mode === "sign-up") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: "professional" },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setMessage("Conta criada. Confirme o acesso pelo e-mail recebido.");
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("E-mail ou senha incorretos.");
      } else {
        router.replace("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4">
      <section className="w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-blue-600 font-bold text-white">
            PF
          </span>
          <div>
            <p className="text-xl font-bold">PersonalFlow</p>
            <p className="text-sm text-[var(--muted)]">Gestão inteligente</p>
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-500">
            {mode === "sign-in" ? "Acesso do profissional" : "Primeiro acesso"}
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            {mode === "sign-in" ? "Entre na sua conta" : "Crie sua conta"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Seus alunos, avaliações e treinos ficarão protegidos e disponíveis em
            todos os seus dispositivos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {mode === "sign-up" && (
            <label className="block text-sm font-medium">
              Nome completo
              <input
                name="fullName"
                required
                autoComplete="name"
                className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none focus:border-blue-500"
              />
            </label>
          )}

          <label className="block text-sm font-medium">
            E-mail
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none focus:border-blue-500"
            />
          </label>

          <label className="block text-sm font-medium">
            Senha
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 outline-none focus:border-blue-500"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
              {message}
            </p>
          )}

          <Button type="submit" disabled={loading} className="h-12 w-full">
            {loading
              ? "Aguarde..."
              : mode === "sign-in"
                ? "Entrar"
                : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((current) => current === "sign-in" ? "sign-up" : "sign-in");
            setError("");
            setMessage("");
          }}
          className="mt-5 w-full text-center text-sm font-semibold text-blue-500 hover:text-blue-400"
        >
          {mode === "sign-in"
            ? "Ainda não tenho uma conta"
            : "Já tenho uma conta"}
        </button>
      </section>
    </main>
  );
}
