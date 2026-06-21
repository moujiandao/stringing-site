"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OWNER_TRANSITIONS, STATUS_LABELS } from "@/lib/constants";
import type { BookingStatus } from "@/lib/types";

export default function TransitionButtons({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowed = OWNER_TRANSITIONS[status] ?? [];

  async function move(to: BookingStatus) {
    if (to === "cancelled" && !confirm("Cancel this booking?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "Failed");
    }
    router.refresh();
  }

  if (allowed.length === 0) return <p className="text-sm text-zinc-400">No further actions.</p>;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {allowed.map((to) => (
          <button
            key={to}
            disabled={busy}
            onClick={() => move(to)}
            className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${
              to === "cancelled"
                ? "border border-red-300 text-red-600 hover:bg-red-50"
                : "bg-zinc-900 text-white hover:bg-zinc-700"
            }`}
          >
            {to === "cancelled" ? "Cancel" : `Mark ${STATUS_LABELS[to]}`}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
