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
  X,
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
import { dashboardRouteByRole, isValidRole, roleDescriptions, roleLabels, roleOptions, type Role } from "@/lib/rbac";
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
  area_id: string | null;
  area_name: string | null;
  team_id: string | null;
  team_name: string | null;
  created_at: string;
};

type Area = {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  manager_name: string | null;
  manager_role: string | null;
};
type Team = {
  id: string;
  area_id: string;
  name: string;
  description: string | null;
  responsible_id: string | null;
  responsible_name: string | null;
  responsible_role: string | null;
};
type Task = {
  id: string; title: string; description: string | null; status: string; priority: string;
  area_id: string | null; area_name: string | null; team_id: string | null; team_name: string | null;
  assignee_id: string | null; assignee_name: string | null; created_by: string; creator_name: string | null;
  due_date: string | null; created_at: string; updated_at: string;
};
type TaskOption = { id: string; name: string; area_id?: string; team_id?: string };

export function RoleDashboard({ role }: { role: Role }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersError, setUsersError] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("worker");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [structureError, setStructureError] = useState("");
  const [areaName, setAreaName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamAreaId, setTeamAreaId] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskError, setTaskError] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskAreaId, setTaskAreaId] = useState("");
  const [taskTeamId, setTaskTeamId] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAreas, setTaskAreas] = useState<TaskOption[]>([]);
  const [taskTeams, setTaskTeams] = useState<TaskOption[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<TaskOption[]>([]);
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

      const [{ data: profile }, { data: authProfile }] = await Promise.all([
        client.from("profiles").select("role, full_name, must_change_password").eq("id", data.user.id).maybeSingle(),
        client.rpc("get_my_profile").maybeSingle(),
      ]);

      if (profile?.must_change_password) {
        router.replace("/account/change-password");
        return;
      }

      const effectiveRole = (authProfile as { role?: string } | null)?.role ?? profile?.role;
      if (effectiveRole && effectiveRole !== role && effectiveRole in dashboardRouteByRole) {
        router.replace(dashboardRouteByRole[effectiveRole as Role]);
        return;
      }

      setEmail(data.user.email ?? "");
      setCurrentUserId(data.user.id);
      const [{ data: taskData, error: taskQueryError }, { data: optionData }] = await Promise.all([
        client.rpc("list_tasks"),
        client.rpc("list_task_options"),
      ]);
      if (taskQueryError) setTaskError(taskQueryError.message);
      else setTasks((taskData ?? []) as Task[]);
      setTaskAreas((optionData?.areas ?? []) as TaskOption[]);
      setTaskTeams((optionData?.teams ?? []) as TaskOption[]);
      setTaskAssignees((optionData?.assignees ?? []) as TaskOption[]);

      if (role === "admin") {
        const { data: adminUsers, error: usersQueryError } = await client.rpc("list_admin_users");
        if (usersQueryError) {
          setUsersError(usersQueryError.message);
        } else {
          setUsers((adminUsers ?? []) as AdminUser[]);
        }
        const { data: structure, error: structureQueryError } = await client.rpc("list_admin_structure");
        if (structureQueryError) {
          setStructureError(structureQueryError.message);
        } else {
          setAreas((structure?.areas ?? []) as Area[]);
          setTeams((structure?.teams ?? []) as Team[]);
          setTeamAreaId((structure?.areas?.[0]?.id as string | undefined) ?? "");
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

  const handleAssignmentChange = async (userId: string, areaId: string) => {
    if (!supabase) return;

    setSavingUserId(userId);
    setUsersError("");
    const user = users.find((item) => item.id === userId);
    const selectedTeamId = user?.team_id && teams.some((team) => team.id === user.team_id && team.area_id === areaId)
      ? user.team_id
      : null;
    const { error: updateError } = await supabase.rpc("update_user_assignment", {
      target_user_id: userId,
      new_area_id: areaId || null,
      new_team_id: selectedTeamId,
    });

    if (updateError) {
      setUsersError(updateError.message);
    } else {
      const area = areas.find((item) => item.id === areaId);
      const team = selectedTeamId ? teams.find((item) => item.id === selectedTeamId) : undefined;
      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === userId
            ? { ...item, area_id: areaId || null, area_name: area?.name ?? null, team_id: selectedTeamId, team_name: team?.name ?? null }
            : item,
        ),
      );
    }
    setSavingUserId("");
  };

  const handleTeamAssignmentChange = async (userId: string, teamId: string) => {
    if (!supabase) return;

    const user = users.find((item) => item.id === userId);
    const team = teams.find((item) => item.id === teamId);
    if (!user || !team) return;

    setSavingUserId(userId);
    setUsersError("");
    const { error: updateError } = await supabase.rpc("update_user_assignment", {
      target_user_id: userId,
      new_area_id: team.area_id,
      new_team_id: team.id,
    });

    if (updateError) {
      setUsersError(updateError.message);
    } else {
      const area = areas.find((item) => item.id === team.area_id);
      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === userId
            ? { ...item, area_id: team.area_id, area_name: area?.name ?? null, team_id: team.id, team_name: team.name }
            : item,
        ),
      );
    }
    setSavingUserId("");
  };

  const handleInviteUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;

    setIsInviting(true);
    setInviteMessage("");
    setUsersError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setUsersError("La sesión expiró. Volvé a iniciar sesión.");
      setIsInviting(false);
      return;
    }

    const response = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: newUserEmail,
        fullName: newUserName,
        role: newUserRole,
        temporaryPassword,
      }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      setUsersError(result.error ?? "No se pudo enviar la invitación.");
    } else {
      setInviteMessage("Invitación enviada correctamente.");
      setNewUserEmail("");
      setNewUserName("");
      setNewUserRole("worker");
      setTemporaryPassword("");
      const { data: refreshedUsers } = await supabase.rpc("list_admin_users");
      setUsers((refreshedUsers ?? []) as AdminUser[]);
    }
    setIsInviting(false);
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!supabase || currentUserId === user.id) return;
    const confirmed = window.confirm(`¿Eliminar a ${user.email ?? "este usuario"}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setDeletingUserId(user.id);
    setUsersError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setUsersError("La sesión expiró. Volvé a iniciar sesión.");
      setDeletingUserId("");
      return;
    }

    const response = await fetch("/api/admin/invite-user", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: user.id }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      setUsersError(result.error ?? "No se pudo eliminar el usuario.");
    } else {
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.id !== user.id));
    }
    setDeletingUserId("");
  };

  const refreshStructure = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("list_admin_structure");
    if (error) {
      setStructureError(error.message);
      return;
    }
    const refreshedAreas = (data?.areas ?? []) as Area[];
    setAreas(refreshedAreas);
    setTeams((data?.teams ?? []) as Team[]);
    setTeamAreaId((currentAreaId) =>
      refreshedAreas.some((area) => area.id === currentAreaId)
        ? currentAreaId
        : (refreshedAreas[0]?.id ?? ""),
    );
  };

  const handleCreateArea = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !areaName.trim()) return;
    setStructureError("");
    const { error } = await supabase.rpc("create_area", { area_name: areaName, area_description: null });
    if (error) setStructureError(error.message);
    else {
      setAreaName("");
      await refreshStructure();
    }
  };

  const handleCreateTeam = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !teamAreaId || !teamName.trim()) return;
    setStructureError("");
    const { error } = await supabase.rpc("create_team", {
      team_area_id: teamAreaId,
      team_name: teamName,
      team_description: null,
    });
    if (error) setStructureError(error.message);
    else {
      setTeamName("");
      await refreshStructure();
    }
  };

  const handleDeleteStructureItem = async (kind: "area" | "team", id: string) => {
    if (!supabase) return;
    const confirmed = window.confirm("¿Eliminar este elemento? Esta acción no se puede deshacer.");
    if (!confirmed) return;
    const { error } = await supabase.rpc(kind === "area" ? "delete_area" : "delete_team", {
      [kind === "area" ? "area_id" : "team_id"]: id,
    });
    if (error) setStructureError(error.message);
    else await refreshStructure();
  };

  const handleAreaManagerChange = async (areaId: string, userId: string) => {
    if (!supabase) return;
    setStructureError("");
    const { error } = await supabase.rpc("update_area_manager", {
      area_id: areaId,
      target_user_id: userId || null,
    });
    if (error) {
      setStructureError(error.message);
      return;
    }
    const manager = users.find((user) => user.id === userId);
    setAreas((currentAreas) =>
      currentAreas.map((area) =>
        area.id === areaId
          ? { ...area, manager_id: userId || null, manager_name: manager?.full_name ?? null, manager_role: manager?.role ?? null }
          : area,
      ),
    );
  };

  const handleTeamResponsibleChange = async (teamId: string, userId: string) => {
    if (!supabase) return;
    setStructureError("");
    const { error } = await supabase.rpc("update_team_responsible", {
      team_id: teamId,
      target_user_id: userId || null,
    });
    if (error) {
      setStructureError(error.message);
      return;
    }
    const responsible = users.find((user) => user.id === userId);
    setTeams((currentTeams) =>
      currentTeams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              responsible_id: userId || null,
              responsible_name: responsible?.full_name ?? null,
              responsible_role: responsible?.role ?? null,
            }
          : team,
      ),
    );
  };

  const refreshTasks = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("list_tasks");
    if (error) setTaskError(error.message);
    else setTasks((data ?? []) as Task[]);
  };

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !taskTitle.trim()) return;
    setTaskError("");
    const { error } = await supabase.rpc("create_task", {
      task_title: taskTitle, task_description: taskDescription || null, task_status: "pending",
      task_priority: taskPriority, task_area_id: taskAreaId || null, task_team_id: taskTeamId || null,
      task_assignee_id: taskAssigneeId || null, task_due_date: taskDueDate || null,
    });
    if (error) setTaskError(error.message);
    else {
      setTaskTitle(""); setTaskDescription(""); setTaskDueDate(""); setTaskAssigneeId("");
      await refreshTasks();
    }
  };

  const handleTaskStatus = async (taskId: string, status: string) => {
    if (!supabase) return;
    setTaskError("");
    const { error } = await supabase.rpc("update_task_status", { task_id: taskId, new_status: status });
    if (error) setTaskError(error.message);
    else await refreshTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!supabase || role !== "admin") return;
    if (!window.confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
    setTaskError("");
    const { error } = await supabase.rpc("delete_task", { task_id: taskId });
    if (error) setTaskError(error.message);
    else await refreshTasks();
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
      <div className="mx-auto flex max-w-[1600px] gap-3 px-3 py-3 sm:gap-6 sm:px-4 sm:py-6 md:px-6 xl:px-8">
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
            <p className="mt-1 text-sm text-[#9CA3AF]">{roleDescriptions[role]}</p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 rounded-2xl border border-[#252A31] bg-[#14171C] p-3 sm:p-4 md:p-6">
          <nav className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Navegación principal">
            {[
              { label: "Inicio", icon: LayoutDashboard },
              { label: "Operaciones", icon: BriefcaseBusiness },
              { label: "Equipos", icon: Users },
              { label: "Reportes", icon: TrendingUp },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="flex shrink-0 items-center gap-2 rounded-xl border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-xs text-[#9CA3AF] transition hover:border-[#00C878]/40 hover:text-white"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>

          <header className="mb-5 flex flex-col gap-4 border-b border-[#252A31] pb-4 sm:mb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#9CA3AF]">Panel interno</p>
              <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Bienvenido, {currentRole}</h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#252A31] bg-[#0B0D10] text-[#F5F5F5]"
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#252A31] bg-[#0B0D10] px-3 py-2 sm:flex-none">
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
                <span className="text-2xl font-semibold sm:text-3xl">{summary.value}</span>
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

          <section className="mb-6 rounded-2xl border border-[#00C878]/20 bg-[#00C878]/5 p-5" aria-labelledby="permissions-heading">
            <p className="text-xs uppercase tracking-[0.2em] text-[#00C878]">Permisos de tu rol</p>
            <h3 id="permissions-heading" className="mt-1 text-lg font-semibold">{currentRole}</h3>
            <p className="mt-2 max-w-3xl text-sm text-[#C5CBD3]">{roleDescriptions[role]}</p>
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
                  <h3 className="text-base font-semibold sm:text-lg">Distribución por área</h3>
                  <span className="text-sm text-[#9CA3AF]">Mes actual</span>
                </div>
                <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                  <div className="h-56 sm:h-72">
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

                  <div className="h-64 sm:h-72">
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

          <section className="mt-6 rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Operaciones</p>
                <h3 className="mt-1 text-lg font-semibold">Tareas</h3>
              </div>
              <select value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)} className="rounded-lg border border-[#252A31] bg-[#14171C] px-3 py-2 text-sm text-[#F5F5F5]">
                <option value="all">Todos los estados</option>
                <option value="pending">Pendientes</option>
                <option value="in_progress">En curso</option>
                <option value="completed">Completadas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>

            {role !== "worker" ? (
              <form onSubmit={handleCreateTask} className="mt-4 grid gap-3 rounded-xl border border-[#252A31] bg-[#14171C] p-4 md:grid-cols-2 xl:grid-cols-4">
                <input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Título de la tarea" className="rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm outline-none focus:border-[#00C878] md:col-span-2" />
                <input value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Descripción (opcional)" className="rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm outline-none focus:border-[#00C878] md:col-span-2" />
                <select value={taskPriority} onChange={(event) => setTaskPriority(event.target.value)} className="rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm">
                  <option value="low">Prioridad baja</option><option value="medium">Prioridad media</option><option value="high">Prioridad alta</option><option value="urgent">Urgente</option>
                </select>
                <select value={taskAreaId} onChange={(event) => { setTaskAreaId(event.target.value); setTaskTeamId(""); }} className="rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm">
                  <option value="">Sin área</option>{taskAreas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={taskTeamId} onChange={(event) => setTaskTeamId(event.target.value)} className="rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm">
                  <option value="">Sin equipo</option>{taskTeams.filter((item) => !taskAreaId || item.area_id === taskAreaId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={taskAssigneeId} onChange={(event) => setTaskAssigneeId(event.target.value)} className="rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm">
                  <option value="">Sin asignar</option>{taskAssignees.filter((item) => (!taskAreaId || item.area_id === taskAreaId) && (!taskTeamId || item.team_id === taskTeamId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className="rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm" />
                <button type="submit" className="rounded-lg bg-[#00C878] px-4 py-2 text-sm font-semibold text-[#0B0D10]">Crear tarea</button>
              </form>
            ) : null}

            {taskError ? <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{taskError}</p> : null}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {tasks.filter((task) => taskFilter === "all" || task.status === taskFilter).map((task) => (
                <article key={task.id} className="rounded-xl border border-[#252A31] bg-[#14171C] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h4 className="truncate font-medium">{task.title}</h4><p className="mt-1 text-sm text-[#9CA3AF]">{task.description || "Sin descripción"}</p></div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${task.priority === "urgent" ? "bg-red-400/15 text-red-300" : "bg-[#00C878]/10 text-[#00C878]"}`}>{task.priority}</span>
                  </div>
                  <p className="mt-3 text-xs text-[#9CA3AF]">{task.area_name || "Sin área"} · {task.team_name || "Sin equipo"} · {task.assignee_name || "Sin asignar"}{task.due_date ? ` · vence ${new Date(`${task.due_date}T00:00:00`).toLocaleDateString("es-AR")}` : ""}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <select value={task.status} disabled={role === "worker" && task.assignee_id !== currentUserId} onChange={(event) => void handleTaskStatus(task.id, event.target.value)} className="rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-xs text-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-50">
                      <option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completada</option><option value="cancelled">Cancelada</option>
                    </select>
                    {role === "admin" ? (
                      <button type="button" onClick={() => void handleDeleteTask(task.id)} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10">
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
              {!tasks.some((task) => taskFilter === "all" || task.status === taskFilter) ? <p className="text-sm text-[#9CA3AF]">No hay tareas disponibles para tu alcance.</p> : null}
            </div>
          </section>

          {role === "admin" ? (
            <section className="mt-6 rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Organización</p>
                  <h3 className="mt-1 text-lg font-semibold">Áreas y equipos</h3>
                </div>
                <span className="text-sm text-[#9CA3AF]">{areas.length} áreas · {teams.length} equipos</span>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <form onSubmit={handleCreateArea} className="flex gap-2">
                  <input
                    required
                    value={areaName}
                    onChange={(event) => setAreaName(event.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-[#252A31] bg-[#14171C] px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#00C878]"
                    placeholder="Nueva área"
                  />
                  <button type="submit" className="rounded-lg bg-[#00C878] px-4 py-2 text-sm font-semibold text-[#0B0D10]">
                    Crear área
                  </button>
                </form>
                <form onSubmit={handleCreateTeam} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <select
                    required
                    value={teamAreaId}
                    onChange={(event) => setTeamAreaId(event.target.value)}
                    className="rounded-lg border border-[#252A31] bg-[#14171C] px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#00C878]"
                  >
                    <option value="" disabled>Elegí un área</option>
                    {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  </select>
                  <input
                    required
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    className="rounded-lg border border-[#252A31] bg-[#14171C] px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#00C878]"
                    placeholder="Nuevo equipo"
                  />
                  <button type="submit" className="rounded-lg bg-[#00C878] px-4 py-2 text-sm font-semibold text-[#0B0D10]">
                    Crear equipo
                  </button>
                </form>
              </div>

              {structureError ? (
                <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  No se pudo actualizar la estructura: {structureError}
                </p>
              ) : null}

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {areas.map((area) => (
                  <div key={area.id} className="rounded-xl border border-[#252A31] bg-[#14171C] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{area.name}</p>
                        <select
                          aria-label={`Responsable de ${area.name}`}
                          value={area.manager_id ?? ""}
                          onChange={(event) => void handleAreaManagerChange(area.id, event.target.value)}
                          className="mt-2 max-w-52 rounded-lg border border-[#252A31] bg-[#0B0D10] px-2 py-1.5 text-xs text-[#F5F5F5] outline-none focus:border-[#00C878]"
                        >
                          <option value="">Sin manager</option>
                          {users.filter((user) => user.area_id === area.id && (user.role === "ceo" || user.role === "manager")).map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.full_name || user.email || "Sin nombre"}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button type="button" onClick={() => void handleDeleteStructureItem("area", area.id)} className="text-xs text-red-300 hover:text-red-200">
                        Eliminar
                      </button>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {teams.filter((team) => team.area_id === area.id).map((team) => (
                        <li key={team.id} className="flex items-center justify-between rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-sm text-[#9CA3AF]">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{team.name}</span>
                            <select
                              aria-label={`Responsable de ${team.name}`}
                              value={team.responsible_id ?? ""}
                              onChange={(event) => void handleTeamResponsibleChange(team.id, event.target.value)}
                              className="max-w-44 rounded-lg border border-[#252A31] bg-[#14171C] px-2 py-1 text-xs text-[#F5F5F5] outline-none focus:border-[#00C878]"
                            >
                              <option value="">Sin responsable</option>
                              {users.filter((user) => user.team_id === team.id && (user.role === "ceo" || user.role === "manager")).map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.full_name || user.email || "Sin nombre"}
                                </option>
                              ))}
                            </select>
                          </span>
                          <button type="button" onClick={() => void handleDeleteStructureItem("team", team.id)} className="text-xs text-red-300 hover:text-red-200">
                            Eliminar
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {role === "admin" ? (
            <section className="mt-6 rounded-2xl border border-[#252A31] bg-[#0B0D10] p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[#9CA3AF]">Administración</p>
                  <h3 className="mt-1 text-lg font-semibold">Usuarios y roles</h3>
                </div>
                <span className="text-sm text-[#9CA3AF]">{users.length} usuarios registrados</span>
              </div>

              <form onSubmit={handleInviteUser} className="mt-5 grid gap-3 rounded-xl border border-[#252A31] bg-[#14171C] p-4 md:grid-cols-[1fr_1fr_0.8fr_1fr_auto] md:items-end">
                <label className="text-sm text-[#9CA3AF]">
                  Nombre
                  <input
                    value={newUserName}
                    onChange={(event) => setNewUserName(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-[#F5F5F5] outline-none focus:border-[#00C878]"
                    placeholder="Nombre completo"
                  />
                </label>
                <label className="text-sm text-[#9CA3AF]">
                  Email
                  <input
                    required
                    type="email"
                    value={newUserEmail}
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-[#F5F5F5] outline-none focus:border-[#00C878]"
                    placeholder="usuario@empresa.com"
                  />
                </label>
                <label className="text-sm text-[#9CA3AF]">
                  Rol inicial
                  <select
                    value={newUserRole}
                    onChange={(event) => setNewUserRole(event.target.value as Role)}
                    className="mt-2 w-full rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-[#F5F5F5] outline-none focus:border-[#00C878]"
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-[#9CA3AF]">
                  Contraseña provisoria
                  <input
                    required
                    minLength={8}
                    type="password"
                    value={temporaryPassword}
                    onChange={(event) => setTemporaryPassword(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#252A31] bg-[#0B0D10] px-3 py-2 text-[#F5F5F5] outline-none focus:border-[#00C878]"
                    placeholder="Mínimo 8 caracteres"
                  />
                </label>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="rounded-lg bg-[#00C878] px-4 py-2 text-sm font-semibold text-[#0B0D10] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isInviting ? "Enviando..." : "Invitar"}
                </button>
              </form>
              {inviteMessage ? <p className="mt-3 text-sm text-[#00C878]">{inviteMessage}</p> : null}

              {usersError ? (
                <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                  No se pudo actualizar la gestión de usuarios: {usersError}
                </p>
              ) : null}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-[#252A31] text-xs uppercase tracking-[0.12em] text-[#9CA3AF]">
                    <tr>
                      <th className="px-3 py-3 font-medium">Usuario</th>
                      <th className="px-3 py-3 font-medium">Nombre</th>
                      <th className="px-3 py-3 font-medium">Rol</th>
                      <th className="px-3 py-3 font-medium">Área</th>
                      <th className="px-3 py-3 font-medium">Equipo</th>
                      <th className="px-3 py-3 font-medium">Alta</th>
                      <th className="px-3 py-3 text-right font-medium">Acción</th>
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
                        <td className="px-3 py-4">
                          <select
                            value={user.area_id ?? ""}
                            disabled={savingUserId === user.id}
                            onChange={(event) => void handleAssignmentChange(user.id, event.target.value)}
                            className="max-w-40 rounded-lg border border-[#252A31] bg-[#14171C] px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#00C878] disabled:opacity-60"
                          >
                            <option value="">Sin área</option>
                            {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-4">
                          <select
                            value={user.team_id ?? ""}
                            disabled={savingUserId === user.id || !user.area_id}
                            onChange={(event) => void handleTeamAssignmentChange(user.id, event.target.value)}
                            className="max-w-40 rounded-lg border border-[#252A31] bg-[#14171C] px-3 py-2 text-sm text-[#F5F5F5] outline-none focus:border-[#00C878] disabled:opacity-60"
                          >
                            <option value="">Sin equipo</option>
                            {teams.filter((team) => team.area_id === user.area_id).map((team) => (
                              <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-4 text-[#9CA3AF]">
                          {new Date(user.created_at).toLocaleDateString("es-AR")}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <button
                            type="button"
                            aria-label={`Eliminar a ${user.email ?? "este usuario"}`}
                            title={currentUserId === user.id ? "No podés eliminarte a vos mismo" : "Eliminar usuario"}
                            disabled={currentUserId === user.id || deletingUserId === user.id}
                            onClick={() => void handleDeleteUser(user)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/30 text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <X className="h-4 w-4" />
                          </button>
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
