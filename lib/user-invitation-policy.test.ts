import { describe, expect, it } from "vitest";
import { resolveInvitationPolicy } from "./user-invitation-policy";

describe("user invitation policy", () => {
  it("allows an administrator to invite an administrator", () => {
    expect(
      resolveInvitationPolicy({
        requesterRole: "admin",
        requestedRole: "admin",
        requesterAreaId: null,
        requestedAreaId: "area-a",
      }),
    ).toEqual({ allowed: true, role: "admin", areaId: "area-a" });
  });

  it("prevents a CEO from creating an administrator", () => {
    expect(
      resolveInvitationPolicy({
        requesterRole: "ceo",
        requestedRole: "admin",
        requesterAreaId: null,
        requestedAreaId: null,
      }),
    ).toEqual({
      allowed: false,
      status: 403,
      error: "Un CEO no puede crear usuarios Administradores.",
    });
  });

  it("limits a manager invitation to a worker in the manager's area", () => {
    expect(
      resolveInvitationPolicy({
        requesterRole: "manager",
        requestedRole: "ceo",
        requesterAreaId: "area-a",
        requestedAreaId: null,
      }),
    ).toEqual({ allowed: true, role: "worker", areaId: "area-a" });
  });

  it("rejects a manager without an assigned area", () => {
    expect(
      resolveInvitationPolicy({
        requesterRole: "manager",
        requestedRole: "worker",
        requesterAreaId: null,
        requestedAreaId: null,
      }),
    ).toMatchObject({ allowed: false, status: 403 });
  });

  it("rejects a manager request targeting another area", () => {
    expect(
      resolveInvitationPolicy({
        requesterRole: "manager",
        requestedRole: "worker",
        requesterAreaId: "area-a",
        requestedAreaId: "area-b",
      }),
    ).toMatchObject({ allowed: false, status: 403 });
  });
});
