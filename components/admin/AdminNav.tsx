"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/hubs", label: "Hubs" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/admin/login") return null;

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="mb-8 flex items-center justify-between border-b border-zinc-200 pb-3">
      <div className="flex gap-5 text-sm">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-zinc-600 hover:text-zinc-900">
            {l.label}
          </Link>
        ))}
      </div>
      <button onClick={signOut} className="text-sm text-zinc-500 hover:text-zinc-900">
        Sign out
      </button>
    </nav>
  );
}
