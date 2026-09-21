import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidRole, type Role } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Configuración de invitaciones incompleta." }, { status: 500 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const accessToken = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  const sessionClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: requester, error: requesterError } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError) {
    return NextResponse.json({ error: `No se pudo verificar el rol: ${requesterError.message}` }, { status: 500 });
  }

  if (requester?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede invitar usuarios." }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; fullName?: string; role?: string; temporaryPassword?: string };
  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim() ?? "";
  const role = body.role;
  const temporaryPassword = body.temporaryPassword;

  if (!email || !email.includes("@") || !role || !isValidRole(role) || !temporaryPassword || temporaryPassword.length < 8) {
    return NextResponse.json({ error: "Completá un email, un rol y una contraseña provisoria de al menos 8 caracteres." }, { status: 400 });
  }

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !createdUser.user) {
    return NextResponse.json({ error: createError?.message ?? "No se pudo crear el usuario." }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: createdUser.user.id,
    full_name: fullName,
    role: role as Role,
    must_change_password: true,
  });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Configuración de administración incompleta." }, { status: 500 });
  }

  const accessToken = authorization.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  const sessionClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: requester, error: requesterError } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError || requester?.role !== "admin") {
    return NextResponse.json({ error: "Solo un administrador puede eliminar usuarios." }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string };
  const userId = body.userId?.trim();

  if (!userId || userId === authData.user.id) {
    return NextResponse.json({ error: "No podés eliminar tu propio usuario." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
