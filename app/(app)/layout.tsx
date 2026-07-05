import { getCurrentUser, demoUsers } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // ⚠️ TEMPORARY: authentication is disabled (see middleware.ts). When no one is
  // signed in we fall back to the admin demo profile so the whole CRM is
  // accessible without a login. TO RESTORE AUTH: revert this file to redirect
  // unauthenticated users to /login (`if (!user) redirect("/login")`).
  const user =
    (await getCurrentUser()) ??
    demoUsers().find((u) => u.role === "admin") ??
    demoUsers()[0];

  return (
    <WorkspaceProvider initialUserId={user.id}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
