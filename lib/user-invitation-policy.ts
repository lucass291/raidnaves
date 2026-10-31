import type { Role } from "./rbac";

type InvitationPolicyInput = {
  requesterRole: Role;
  requestedRole: Role;
  requesterAreaId: string | null;
  requestedAreaId: string | null;
};

type InvitationPolicyResult =
  | { allowed: true; role: Role; areaId: string | null }
  | { allowed: false; status: 403; error: string };

export function resolveInvitationPolicy({
  requesterRole,
  requestedRole,
  requesterAreaId,
  requestedAreaId,
}: InvitationPolicyInput): InvitationPolicyResult {
  if (requesterRole === "ceo" && requestedRole === "admin") {
    return {
      allowed: false,
      status: 403,
      error: "Un CEO no puede crear usuarios Administradores.",
    };
  }

  if (requesterRole === "manager") {
    if (!requesterAreaId) {
      return {
        allowed: false,
        status: 403,
        error: "El jefe de área no tiene un área asignada.",
      };
    }

    if (requestedAreaId && requestedAreaId !== requesterAreaId) {
      return {
        allowed: false,
        status: 403,
        error: "No podés asignar usuarios fuera de tu área.",
      };
    }

    return { allowed: true, role: "worker", areaId: requesterAreaId };
  }

  return { allowed: true, role: requestedRole, areaId: requestedAreaId };
}
