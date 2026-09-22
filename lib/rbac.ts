export const roles = ["admin", "ceo", "manager", "worker"] as const;

export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  ceo: "CEO",
  manager: "Jefe de Área",
  worker: "Trabajador",
};

export const roleDescriptions: Record<Role, string> = {
  admin: "Acceso total: usuarios, estructura, equipos y tareas.",
  ceo: "Lectura global y gestión del ciclo de vida de las tareas.",
  manager: "Podés ver los trabajadores de tu área y crear nuevos trabajadores allí; no podés cambiar roles, eliminar usuarios ni modificar la estructura.",
  worker: "Tus tareas y las de tu equipo; solo podés actualizar tareas asignadas.",
};

export const roleHierarchy: Record<Role, number> = {
  admin: 4,
  ceo: 3,
  manager: 2,
  worker: 1,
};

export const dashboardRouteByRole: Record<Role, string> = {
  admin: "/dashboard/admin",
  ceo: "/dashboard/ceo",
  manager: "/dashboard/manager",
  worker: "/dashboard/worker",
};

export const roleOptions = roles.map((role) => ({
  value: role,
  label: roleLabels[role],
}));

export function isValidRole(value: string): value is Role {
  return roles.includes(value as Role);
}

export function normalizeRole(value: string | null | undefined): Role {
  if (value && isValidRole(value)) return value;
  return "worker";
}

export function canAccessRole(userRole: Role, targetRole: Role) {
  return roleHierarchy[userRole] >= roleHierarchy[targetRole];
}
