import { describe, expect, it } from "vitest";
import { canDeleteUser, isPrivilegedRole } from "./user-deletion-policy";

describe("user deletion policy", () => {
  it("allows administrators to delete other users", () => {
    expect(
      canDeleteUser({
        requesterRole: "admin",
        requesterId: "admin-1",
        targetId: "user-1",
        targetRole: "admin",
      }),
    ).toBe(true);
  });

  it("prevents administrators and CEOs from deleting themselves", () => {
    for (const requesterRole of ["admin", "ceo"]) {
      expect(
        canDeleteUser({
          requesterRole,
          requesterId: "user-1",
          targetId: "user-1",
          targetRole: requesterRole,
        }),
      ).toBe(false);
    }
  });

  it("prevents CEOs from deleting administrators", () => {
    expect(
      canDeleteUser({
        requesterRole: "ceo",
        requesterId: "ceo-1",
        targetId: "admin-1",
        targetRole: "admin",
      }),
    ).toBe(false);
  });

  it("allows CEOs to delete non-administrator users", () => {
    expect(
      canDeleteUser({
        requesterRole: "ceo",
        requesterId: "ceo-1",
        targetId: "manager-1",
        targetRole: "manager",
      }),
    ).toBe(true);
  });

  it("recognizes only administrator and CEO roles as privileged", () => {
    expect(isPrivilegedRole("admin")).toBe(true);
    expect(isPrivilegedRole("ceo")).toBe(true);
    expect(isPrivilegedRole("manager")).toBe(false);
    expect(isPrivilegedRole(null)).toBe(false);
  });
});
