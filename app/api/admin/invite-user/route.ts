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
    .select("role, area_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError) {
    return NextResponse.json({ error: `No se pudo verificar el rol: ${requesterError.message}` }, { status: 500 });
  }

  if (!requester || (requester.role !== "admin" && requester.role !== "ceo" && requester.role !== "manager")) {
    return NextResponse.json({ error: "Solo un administrador, CEO o jefe de área puede invitar usuarios." }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: string;
    fullName?: string;
    role?: string;
    temporaryPassword?: string;
    areaId?: string;
    teamId?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim() ?? "";
  const role = requester.role === "manager" ? "worker" : body.role;
  const temporaryPassword = body.temporaryPassword;

  if (!email || !email.includes("@") || !role || !isValidRole(role) || !temporaryPassword || temporaryPassword.length < 8) {
    return NextResponse.json({ error: "Completá un email, un rol y una contraseña provisoria de al menos 8 caracteres." }, { status: 400 });
  }
  if (requester.role === "ceo" && role === "admin") {
    return NextResponse.json({ error: "Un CEO no puede crear usuarios Administradores." }, { status: 403 });
  }

  let areaId = body.areaId?.trim() || null;
  const teamId = body.teamId?.trim() || null;
  if (requester.role === "manager") {
    if (!requester.area_id) return NextResponse.json({ error: "El jefe de área no tiene un área asignada." }, { status: 403 });
    if (body.areaId && body.areaId !== requester.area_id) {
      return NextResponse.json({ error: "No podés asignar usuarios fuera de tu área." }, { status: 403 });
    }
    areaId = requester.area_id;
  }
  if (teamId) {
    const { data: team } = await adminClient.from("teams").select("area_id").eq("id", teamId).maybeSingle();
    if (!team || team.area_id !== areaId) {
      return NextResponse.json({ error: "El equipo seleccionado no pertenece al área asignada." }, { status: 400 });
    }
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
    area_id: areaId,
    team_id: teamId,
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

  if (requesterError || (requester?.role !== "admin" && requester?.role !== "ceo")) {
    return NextResponse.json({ error: "Solo un administrador o CEO puede eliminar usuarios." }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string };
  const userId = body.userId?.trim();

  if (!userId || userId === authData.user.id) {
    return NextResponse.json({ error: "No podés eliminar tu propio usuario." }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (requester.role === "ceo") {
    const { data: target } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (target?.role === "admin") {
      return NextResponse.json({ error: "El CEO no puede modificar al administrador." }, { status: 403 });
    }
  }
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
