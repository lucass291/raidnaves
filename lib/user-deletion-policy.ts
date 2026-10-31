import type { Role } from "./rbac";

type UserDeletionPolicyInput = {
  requesterRole: string | null;
  requesterId: string;
  targetId: string;
  targetRole: string | null;
};

export function canDeleteUser({
  requesterRole,
  requesterId,
  targetId,
  targetRole,
}: UserDeletionPolicyInput): boolean {
  if (requesterRole !== "admin" && requesterRole !== "ceo") return false;
  if (requesterId === targetId) return false;
  if (requesterRole === "ceo" && targetRole === "admin") return false;
  return true;
}

export function isPrivilegedRole(role: string | null): role is Extract<Role, "admin" | "ceo"> {
  return role === "admin" || role === "ceo";
}
