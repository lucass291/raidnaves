"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const client = supabase;
    if (!client) {
      router.replace("/login?invite=1&error=config");
      return;
    }

    const exchangeCode = async () => {
      const currentUrl = new URL(window.location.href);
      const searchParams = currentUrl.searchParams;
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace(`/login?invite=1&error=${encodeURIComponent(error.message)}`);
          return;
        }
      } else if (tokenHash) {
        const { error } = await client.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite",
        });
        if (error) {
          router.replace(`/login?invite=1&error=${encodeURIComponent(error.message)}`);
          return;
        }
      }

      window.sessionStorage.setItem("raidnaves-invitation", "1");
      router.replace("/login?invite=1");
    };

    void exchangeCode();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0B0D10] text-sm text-[#9CA3AF]">
      Validando invitación...
    </main>
  );
}
