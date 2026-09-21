import { notFound } from "next/navigation";
import { RoleDashboard } from "@/components/role-dashboard";
import { isValidRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role } = await params;

  if (!isValidRole(role)) {
    notFound();
  }

  return <RoleDashboard role={role} />;
}
