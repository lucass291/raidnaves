import { describe, expect, it } from "vitest";
import { canAccessRole, isValidRole, normalizeRole } from "./rbac";

describe("role access", () => {
  it("recognizes only the supported roles", () => {
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("manager")).toBe(true);
    expect(isValidRole("unknown")).toBe(false);
  });

  it("normalizes missing or unsupported roles to worker", () => {
    expect(normalizeRole(null)).toBe("worker");
    expect(normalizeRole("unsupported")).toBe("worker");
    expect(normalizeRole("ceo")).toBe("ceo");
  });

  it("allows roles to access only equal or lower-ranked roles", () => {
    expect(canAccessRole("admin", "worker")).toBe(true);
    expect(canAccessRole("manager", "manager")).toBe(true);
    expect(canAccessRole("manager", "ceo")).toBe(false);
    expect(canAccessRole("worker", "admin")).toBe(false);
  });
});
