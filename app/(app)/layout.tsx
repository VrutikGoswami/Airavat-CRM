import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <WorkspaceProvider initialUserId={user.id}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
