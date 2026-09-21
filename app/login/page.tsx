"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInvitation, setIsInvitation] = useState(() => {
    if (typeof window === "undefined") return false;
    const currentUrl = new URL(window.location.href);
    return (
      currentUrl.searchParams.get("type") === "invite" ||
      currentUrl.searchParams.has("code") ||
      currentUrl.searchParams.has("token_hash") ||
      currentUrl.hash.includes("type=invite") ||
      currentUrl.hash.includes("access_token=")
    );
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const hasInvitationMarker = () => {
      const currentUrl = new URL(window.location.href);
      return (
        currentUrl.searchParams.get("type") === "invite" ||
        currentUrl.searchParams.has("code") ||
        currentUrl.searchParams.has("token_hash") ||
        currentUrl.hash.includes("type=invite") ||
        currentUrl.hash.includes("access_token=")
      );
    };

    const exchangeInvitationCode = async () => {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get("code");
      const tokenHash = currentUrl.searchParams.get("token_hash");
      let error;

      if (code) {
        ({ error } = await client.auth.exchangeCodeForSession(code));
      } else if (tokenHash && currentUrl.searchParams.get("type") === "invite") {
        ({ error } = await client.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite",
        }));
      } else {
        return;
      }

      if (error) {
        setError(`No se pudo validar la invitación: ${error.message}`);
        return;
      }

      setIsInvitation(true);
      currentUrl.searchParams.delete("code");
      currentUrl.searchParams.delete("token_hash");
      currentUrl.searchParams.delete("type");
      window.history.replaceState({}, "", currentUrl.toString());
    };

    void exchangeInvitationCode();

    const { data: authListener } = client.auth.onAuthStateChange((event) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && hasInvitationMarker()) {
        setIsInvitation(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!supabase || !hasSupabaseConfig) {
      setError("Falta configurar Supabase. Crea un archivo .env.local con las variables indicadas en .env.example.");
      return;
    }

    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(`No se pudo iniciar sesión: ${signInError.message}`);
      setIsSubmitting(false);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (userError || !userId) {
      setError("La sesión se creó, pero no se pudo identificar el usuario.");
      setIsSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      setError(`No se pudo leer el perfil de usuario: ${profileError.message}`);
      setIsSubmitting(false);
      return;
    }

    const role = profile?.role;
    if (role === "admin" || role === "ceo" || role === "manager" || role === "worker") {
      router.push(`/dashboard/${role}`);
      return;
    }

    setError("Tu usuario no tiene un perfil con rol asignado. Creá el perfil en Supabase antes de continuar.");
    setIsSubmitting(false);
  };

  const handleInvitationPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError("Falta configurar Supabase.");
      return;
    }

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(`No se pudo guardar la contraseña: ${updateError.message}`);
      setIsSubmitting(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setError("No se pudo identificar el usuario invitado.");
      setIsSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    const role = profile?.role;

    if (role === "admin" || role === "ceo" || role === "manager" || role === "worker") {
      router.push(`/dashboard/${role}`);
      return;
    }

    setError("La contraseña se guardó, pero el perfil todavía no tiene un rol asignado.");
    setIsSubmitting(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0D10] px-3 py-5 text-[#F5F5F5] sm:px-4 sm:py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-2xl border border-[#252A31] bg-[#14171C] shadow-[0_0_0_1px_rgba(0,200,120,0.08)] sm:rounded-[28px] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden border-b border-[#252A31] bg-[radial-gradient(circle_at_top_left,_rgba(0,200,120,0.18),_transparent_35%),_linear-gradient(135deg,#101418,#14171C_55%,#0B0D10)] p-5 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-[#00C878]/10 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C878]/15 text-[#00C878]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#9CA3AF]">Internal platform</p>
                <h1 className="text-2xl font-semibold">Raidnaves</h1>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-[#00C878]/30 bg-[#00C878]/10 px-3 py-1 text-xs font-medium text-[#00C878]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Multi-Área · Gobierno interno
                </p>
                <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  Control operacional para cada área del negocio.
                </h2>
              </div>

              <p className="max-w-md text-base leading-7 text-[#9CA3AF]">
                Un sistema de gestión interno pensado para supervisar equipos, operaciones y desempeño sin depender de una sola línea de negocio.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Áreas", value: "7" },
                  { label: "Equipos", value: "24" },
                  { label: "KPI", value: "96%" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-[#252A31] bg-[#0B0D10]/80 p-4">
                    <p className="text-2xl font-semibold text-[#F5F5F5]">{stat.value}</p>
                    <p className="mt-1 text-sm text-[#9CA3AF]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="p-5 sm:p-8">
          <div className="mb-6 sm:mb-8">
            <p className="text-sm uppercase tracking-[0.2em] text-[#9CA3AF]">Acceso</p>
            <h3 className="mt-2 text-2xl font-semibold sm:text-3xl">
              {isInvitation ? "Crear contraseña" : "Iniciar sesión"}
            </h3>
          </div>

          {isInvitation ? (
            <form className="space-y-5" onSubmit={handleInvitationPassword}>
              <p className="text-sm leading-6 text-[#9CA3AF]">
                Tu invitación fue aceptada. Creá una contraseña para acceder a Raidnaves.
              </p>
              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-[#F5F5F5]">
                  Nueva contraseña
                </label>
                <input
                  id="new-password"
                  required
                  minLength={8}
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-xl border border-[#252A31] bg-[#0B0D10] px-4 py-3 text-sm text-[#F5F5F5] outline-none transition focus:border-[#00C878]"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-[#F5F5F5]">
                  Repetir contraseña
                </label>
                <input
                  id="confirm-password"
                  required
                  minLength={8}
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-[#252A31] bg-[#0B0D10] px-4 py-3 text-sm text-[#F5F5F5] outline-none transition focus:border-[#00C878]"
                  placeholder="Repetí la contraseña"
                />
              </div>
              {error ? (
                <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00C878] px-4 py-3 text-sm font-semibold text-[#0B0D10] transition hover:bg-[#00b56f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Guardando..." : "Crear contraseña"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#F5F5F5]">
                Correo institucional
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-[#252A31] bg-[#0B0D10] px-4 py-3 text-sm text-[#F5F5F5] outline-none ring-0 transition focus:border-[#00C878]"
                placeholder="usuario@empresa.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#F5F5F5]">
                Contraseña
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-[#252A31] bg-[#0B0D10] px-4 py-3">
                <Lock className="h-4 w-4 text-[#9CA3AF]" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full bg-transparent text-sm text-[#F5F5F5] outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00C878] px-4 py-3 text-sm font-semibold text-[#0B0D10] transition hover:bg-[#00b56f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Ingresando..." : "Iniciar sesión"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          )}
        </section>
      </div>
    </main>
  );
}
