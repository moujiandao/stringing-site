"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DAY_PARTS } from "@/lib/constants";
import type { DayPart } from "@/lib/types";

export default function BatchActions({
  batchId,
  tripDate,
  dayPart,
  status,
}: {
  batchId: string;
  tripDate: string;
  dayPart: DayPart | null;
  status: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(tripDate);
  const [part, setPart] = useState<DayPart | "">(dayPart ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: string, extra?: Record<string, unknown>) {
    if (action === "cancel" && !confirm("Cancel this trip? Its bookings go back into the pool.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/batches/${batchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error || "Failed");
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "confirmed" && (
          <button
            disabled={busy}
            onClick={() => act("confirm")}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Confirm trip
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => act("cancel")}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Cancel trip
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <select
          className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
          value={part}
          onChange={(e) => setPart(e.target.value as DayPart)}
        >
          <option value="">(day part)</option>
          {DAY_PARTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <button
          disabled={busy}
          onClick={() => act("reschedule", { tripDate: date, dayPart: part || undefined })}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          Reschedule &amp; notify
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
