"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError("Falta configurar Supabase.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setIsSaving(true);
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setError(`No se pudo actualizar la contraseña: ${passwordError.message}`);
      setIsSaving(false);
      return;
    }

    const { error: profileError } = await supabase.rpc("complete_password_change");
    if (profileError) {
      setError(`La contraseña se actualizó, pero no se pudo completar el perfil: ${profileError.message}`);
      setIsSaving(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
      .maybeSingle();
    const destination =
      profile?.role === "admin" || profile?.role === "ceo" || profile?.role === "manager" || profile?.role === "worker"
        ? `/dashboard/${profile.role}`
        : "/login";
    router.replace(destination);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0D10] px-4 py-8 text-[#F5F5F5]">
      <section className="w-full max-w-md rounded-2xl border border-[#252A31] bg-[#14171C] p-6 sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00C878]/15 text-[#00C878]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Raidnaves</p>
            <h1 className="text-xl font-semibold">Actualizar contraseña</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-6 text-[#9CA3AF]">
          Estás usando una contraseña provisoria. Elegí una nueva para continuar.
        </p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block text-sm font-medium">
            Nueva contraseña
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-[#252A31] bg-[#0B0D10] px-4 py-3">
              <Lock className="h-4 w-4 text-[#9CA3AF]" />
              <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Mínimo 8 caracteres" />
            </span>
          </label>
          <label className="block text-sm font-medium">
            Repetir contraseña
            <input required minLength={8} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-[#252A31] bg-[#0B0D10] px-4 py-3 outline-none focus:border-[#00C878]" placeholder="Repetí la contraseña" />
          </label>
          {error ? <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200">{error}</p> : null}
          <button type="submit" disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00C878] px-4 py-3 font-semibold text-[#0B0D10] disabled:opacity-60">
            {isSaving ? "Guardando..." : "Guardar contraseña"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  );
}
