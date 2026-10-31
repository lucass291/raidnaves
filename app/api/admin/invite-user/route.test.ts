import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import { DELETE } from "./route";

function profileQuery(result: { data: unknown; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { from, select, eq, maybeSingle };
}

function requestToDeleteUser(userId = "target-1") {
  return new Request("http://localhost/api/admin/invite-user", {
    method: "DELETE",
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

function configureClients({
  requesterRole,
  requesterError = null,
  targetRole = null,
  targetError = null,
}: {
  requesterRole: string | null;
  requesterError?: { message: string } | null;
  targetRole?: string | null;
  targetError?: { message: string } | null;
}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: "requester-1" } },
    error: null,
  });
  const requester = profileQuery({
    data: requesterRole ? { role: requesterRole } : null,
    error: requesterError,
  });
  const target = profileQuery({
    data: targetRole ? { role: targetRole } : null,
    error: targetError,
  });
  const deleteUser = vi.fn().mockResolvedValue({ error: null });

  createClientMock
    .mockReturnValueOnce({ auth: { getUser } })
    .mockReturnValueOnce({ from: requester.from })
    .mockReturnValueOnce({
      auth: { admin: { deleteUser } },
      from: target.from,
    });

  return { deleteUser, requester, target };
}

describe("DELETE /api/admin/invite-user", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  });

  it("returns an explicit server error when requester role lookup fails", async () => {
    const { deleteUser } = configureClients({
      requesterRole: null,
      requesterError: { message: "profile query failed" },
    });

    const response = await DELETE(requestToDeleteUser());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "No se pudo verificar el rol: profile query failed",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not delete a user when a CEO cannot verify the target role", async () => {
    const { deleteUser } = configureClients({
      requesterRole: "ceo",
      targetError: { message: "target query failed" },
    });

    const response = await DELETE(requestToDeleteUser());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "No se pudo verificar el usuario: target query failed",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("prevents a CEO from deleting an administrator account", async () => {
    const { deleteUser } = configureClients({
      requesterRole: "ceo",
      targetRole: "admin",
    });

    const response = await DELETE(requestToDeleteUser());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "El CEO no puede modificar al administrador.",
    });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
