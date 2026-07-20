import { getCurrentUser } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <WorkspaceProvider initialUserId={user?.id ?? "local-test-admin"}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
