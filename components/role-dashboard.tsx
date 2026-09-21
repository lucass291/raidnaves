"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dashboardRouteByRole, isValidRole, roleLabels, roleOptions, type Role } from "@/lib/rbac";
import { supabase } from "@/lib/supabase";

const overviewByRole: Record<Role, { label: string; value: string; trend: string; detail: string }> = {
  admin: {
    label: "Operaciones globales",
    value: "184",
    trend: "+18.4%",
    detail: "esta semana",
  },
  ceo: {
    label: "Visión del negocio",
    value: "96.2%",
    trend: "+9.1%",
    detail: "eficiencia general",
  },
  manager: {
    label: "Equipos asignados",
    value: "12",
    trend: "+5.7%",
    detail: "áreas activas",
  },
  worker: {
    label: "Tareas completadas",
    value: "43",
    trend: "+11.2%",
    detail: "hoy",
  },
};

const kpis: Record<Role, { title: string; value: string; change: string; icon: typeof TrendingUp }[]> = {
  admin: [
    { title: "Incidencias abiertas", value: "24", change: "+3", icon: BriefcaseBusiness },
    { title: "Tiempo medio", value: "6.4h", change: "-12%", icon: TrendingUp },
    { title: "Equipo activo", value: "214", change: "+18", icon: Users },
  ],
  ceo: [
    { title: "SLA de áreas", value: "94%", change: "+2.8%", icon: ShieldCheck },
    { title: "Productividad", value: "89%", change: "+6.1%", icon: TrendingUp },
    { title: "Visión total", value: "7 áreas", change: "+1", icon: LayoutDashboard },
  ],
  manager: [
    { title: "Tareas por equipo", value: "52", change: "+8", icon: BriefcaseBusiness },
    { title: "Cumplimiento", value: "91%", change: "+4%", icon: CheckCircle2 },
    { title: "Reuniones", value: "4", change: "-1", icon: CalendarDays },
  ],
  worker: [
    { title: "Progreso semanal", value: "76%", change: "+9%", icon: TrendingUp },
    { title: "Pendientes", value: "12", change: "-3", icon: BriefcaseBusiness },
    { title: "Colaboración", value: "8", change: "+2", icon: Users },
  ],
};

const performanceData = [
  { day: "L", value: 28 },
  { day: "M", value: 36 },
  { day: "X", value: 33 },
  { day: "J", value: 48 },
  { day: "V", value: 41 },
  { day: "S", value: 56 },
  { day: "D", value: 64 },
];

const workloadData = [
  { name: "Operación", value: 40 },
  { name: "Atención", value: 25 },
  { name: "Análisis", value: 20 },
  { name: "Administración", value: 15 },
];

const pieColors = ["#00C878", "#2A9D8F", "#9CA3AF", "#252A31"];

const teamFeed = [
  "El equipo de operaciones cerró 14 tareas hoy.",
  "Se revisó la asignación de áreas con mayor carga del mes.",
  "Se aprobó la planificación de la próxima semana.",
];

const priorityItems = [
  { name: "Ajuste de turnos", owner: "J. Gómez", status: "Pendiente" },
  { name: "Revisión de métricas", owner: "E. Ruiz", status: "En curso" },
  { name: "Cierre de incidencias", owner: "M. Díaz", status: "Listo" },
];

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  created_at: string;
};

export function RoleDashboard({ role }: { role: Role }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const currentRole = roleLabels[role];
  const summary = overviewByRole[role];

  useEffect(() => {
    const client = supabase;
    if (!client) {
      router.replace("/login");
      return;
    }

    let isMounted = true;

    void client.auth.getUser().then(async ({ data, error }) => {
      if (!isMounted) return;

      if (error || !data.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await client
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.role && profile.role !== role && profile.role in dashboardRouteByRole) {
        router.replace(dashboardRouteByRole[profile.role as Role]);
        return;
      }

      setEmail(data.user.email ?? "");
      setCurrentUserId(data.user.id);

      if (role === "admin") {
        const { data: adminUsers, error: usersQueryError } = await client.rpc("list_admin_users");
        if (usersQueryError) {
          setUsersError(usersQueryError.message);
        } else {
          setUsers((adminUsers ?? []) as AdminUser[]);
        }
      }

      setIsCheckingSession(false);
    });

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [role, router]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!supabase || !isValidRole(newRole)) return;

    setSavingUserId(userId);
    setUsersError("");
    const { error: updateError } = await supabase.rpc("update_user_role", {
      target_user_id: userId,
      new_role: newRole,
    });

    if (updateError) {
      setUsersError(updateError.message);
    } else {
      setUsers((currentUsers) =>
        currentUsers.map((user) => (user.id === userId ? { ...user, role: newRole } : user)),
      );
    }
    setSavingUserId("");
  };

  if (isCheckingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0D10] text-sm text-[#9CA3AF]">
        Verificando sesión...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0D10] text-[#F5F5F5]">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 md:px-6 xl:px-8">
        <aside className="hidden w-72 rounded-2xl border border-[#252A31] bg-[#14171C] p-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00C878]/15 text-[#00C878]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Sistema</p>
              <h1 className="text-lg font-semibold">Raidnaves</h1>
            </div>
          </div>

          <nav className="space-y-2">
            {[
              { label: "Dashboard", active: true, icon: LayoutDashboard },
              { label: "Operaciones", active: false, icon: BriefcaseBusiness },
              { label: "Equipos", active: false, icon: Users },
              { label: "Reporte", active: false, icon: TrendingUp },
              { label: "Configuración", active: false, icon: Settings },
            ].map(({ label, active, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "border-[#00C878]/40 bg-[#00C878]/10 text-white"
                    : "border-transparent bg-transparent text-[#9CA3AF] hover:border-[#252A31] hover:bg-[#1B1F25]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ))}
          </nav>

          <div className="mt-8 rounded-xl border border-[#252A31] bg-[#0B0D10] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Acceso</p>
            <p className="mt-2 text-lg font-semibold">{currentRole}</p>
            <p className="mt-1 text-sm text-[#9CA3AF]">Ruta: {dashboardRouteByRole[role]}</p>
          </div>
        </aside>

        <main className="flex-1 rounded-2xl border border-[#252A31] bg-[#14171C] p-4 md:p-6">
          <header className="mb-6 flex flex-col gap-4 border-b border-[#252A31] pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#9CA3AF]">Panel interno</p>
              <h2 className="mt-1 text-2xl font-semibold">Bienvenido, {currentRole}</h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#252A31] bg-[#0B0D10] text-[#F5F5F5]"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 rounded-xl border border-[#252A31] bg-[#0B0D10] px-3 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00C878]/20 text-sm font-semibold text-[#00C878]">
                  AR
                </div>
                <div className="hidden text-left sm:block">
                  <p className="max-w-48 truncate text-sm font-medium">{email}</p>
                  <p className="text-xs text-[#9CA3AF]">{currentRole}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-xl border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm text-[#9CA3AF] transition hover:border-[#00C878]/40 hover:text-white"
              >
                Salir
              </button>
            </div>
          </header>

          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5">
              <p className="text-sm text-[#9CA3AF]">{summary.label}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <span className="text-3xl font-semibold">{summary.value}</span>
                <span className="rounded-full bg-[#00C878]/10 px-2 py-1 text-xs font-medium text-[#00C878]">
                  {summary.trend}
                </span>
              </div>
              <p className="mt-3 text-sm text-[#9CA3AF]">{summary.detail}</p>
            </div>

            <div className="rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5 md:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#9CA3AF]">Rendimiento semanal</p>
                <button type="button" className="text-sm text-[#00C878]">
                  Ver detalle
                </button>
              </div>
              <div className="mt-4 h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="performanceFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#00C878" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#00C878" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#252A31" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0B0D10",
                        border: "1px solid #252A31",
                        borderRadius: "12px",
                        color: "#F5F5F5",
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#00C878" strokeWidth={3} fill="url(#performanceFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {kpis[role].map(({ title, value, change, icon: Icon }) => (
                  <div key={title} className="rounded-2xl border border-[#252A31] bg-[#0B0D10] p-4">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-sm text-[#9CA3AF]">{title}</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00C878]/10 text-[#00C878]">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <span className="text-2xl font-semibold">{value}</span>
                      <span className="text-xs text-[#00C878]">{change}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Distribución por área</h3>
                  <span className="text-sm text-[#9CA3AF]">Mes actual</span>
                </div>
                <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData}>
                        <CartesianGrid stroke="#252A31" vertical={false} />
                        <XAxis dataKey="day" tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0B0D10",
                            border: "1px solid #252A31",
                            borderRadius: "12px",
                            color: "#F5F5F5",
                          }}
                        />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#00C878" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={workloadData} innerRadius={46} outerRadius={68} dataKey="value" paddingAngle={2}>
                          {workloadData.map((entry, index) => (
                            <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0B0D10",
                            border: "1px solid #252A31",
                            borderRadius: "12px",
                            color: "#F5F5F5",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-2">
                      {workloadData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-[#9CA3AF]">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pieColors[index] }} />
                            {item.name}
                          </span>
                          <span>{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Actividad reciente</h3>
                  <ArrowRight className="h-4 w-4 text-[#9CA3AF]" />
                </div>
                <ul className="mt-4 space-y-3">
                  {teamFeed.map((item, index) => (
                    <li key={item} className="flex gap-3 rounded-xl border border-[#252A31] bg-[#14171C] p-3">
                      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[#00C878]" />
                      <p className="text-sm text-[#F5F5F5]">
                        {item}
                        <span className="mt-1 block text-xs text-[#9CA3AF]">Hace {index + 1}h</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5">
                <h3 className="text-lg font-semibold">Prioridades</h3>
                <ul className="mt-4 space-y-3">
                  {priorityItems.map((item) => (
                    <li key={item.name} className="flex items-center justify-between rounded-xl border border-[#252A31] bg-[#14171C] p-3">
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-[#9CA3AF]">{item.owner}</p>
                      </div>
                      <span className="rounded-full bg-[#00C878]/10 px-2 py-1 text-xs text-[#00C878]">{item.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {role === "admin" ? (
            <section className="mt-6 rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Administración</p>
                  <h3 className="mt-1 text-lg font-semibold">Usuarios y roles</h3>
                </div>
                <span className="text-sm text-[#9CA3AF]">{users.length} usuarios registrados</span>
              </div>

              {usersError ? (
                <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  No se pudo actualizar la gestión de usuarios: {usersError}
                </p>
              ) : null}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="border-b border-[#252A31] text-xs uppercase tracking-[0.12em] text-[#9CA3AF]">
                    <tr>
                      <th className="px-3 py-3 font-medium">Usuario</th>
                      <th className="px-3 py-3 font-medium">Nombre</th>
                      <th className="px-3 py-3 font-medium">Rol</th>
                      <th className="px-3 py-3 font-medium">Alta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-[#252A31] last:border-0">
                        <td className="px-3 py-4 text-[#F5F5F5]">{user.email ?? "Sin correo"}</td>
                        <td className="px-3 py-4 text-[#9CA3AF]">{user.full_name || "Sin nombre"}</td>
                        <td className="px-3 py-4">
                          <select
                            value={user.role && isValidRole(user.role) ? user.role : "worker"}
                            disabled={savingUserId === user.id || currentUserId === user.id}
                            onChange={(event) => void handleRoleChange(user.id, event.target.value)}
                            title={currentUserId === user.id ? "No podés cambiar tu propio rol" : undefined}
                            className="rounded-lg border border-[#252A31] bg-[#14171C] px-3 py-2 text-sm text-[#F5F5F5] outline-none transition focus:border-[#00C878] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-4 text-[#9CA3AF]">
                          {new Date(user.created_at).toLocaleDateString("es-AR")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
