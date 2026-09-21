import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidRole, type Role } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !serviceRoleKey || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Configuración de invitaciones incompleta." }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const accessToken = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  const { data: requester, error: requesterError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError || requester?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede invitar usuarios." }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; fullName?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim() ?? "";
  const role = body.role;

  if (!email || !email.includes("@") || !role || !isValidRole(role)) {
    return NextResponse.json({ error: "Completá un email válido y un rol válido." }, { status: 400 });
  }

  const { data: invitedUser, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });

  if (inviteError || !invitedUser.user) {
    return NextResponse.json({ error: inviteError?.message ?? "No se pudo enviar la invitación." }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: invitedUser.user.id,
    full_name: fullName,
    role: role as Role,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
