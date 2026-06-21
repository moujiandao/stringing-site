import AdminNav from "@/components/admin/AdminNav";

// Auth is enforced by middleware.ts (redirects unauthenticated /admin/* to login).
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminNav />
      {children}
    </div>
  );
}
