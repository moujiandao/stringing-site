import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rowToTripBatch, rowToHub } from "@/lib/mappers";
import { DAY_PARTS } from "@/lib/constants";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function BatchesPage() {
  const supabase = await createClient();

  const [{ data: bRows }, { data: hRows }, { data: bookRows }] = await Promise.all([
    supabase.from("trip_batches").select("*").neq("status", "cancelled").order("trip_date"),
    supabase.from("hubs").select("*"),
    supabase.from("bookings").select("id, dropoff_batch_id, pickup_batch_id"),
  ]);

  const batches = (bRows ?? []).map(rowToTripBatch);
  const hubName = new Map((hRows ?? []).map((h) => [h.id, rowToHub(h).name]));
  const count = new Map<string, number>();
  for (const b of bookRows ?? []) {
    for (const fk of [b.dropoff_batch_id, b.pickup_batch_id]) {
      if (fk) count.set(fk, (count.get(fk) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Trip batches</h1>
      {batches.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No trips yet. The nightly batcher creates these from pending bookings.
        </p>
      ) : (
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/admin/batches/${b.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50"
            >
              <span>
                <span className="font-medium capitalize">{b.phase}</span> ·{" "}
                {hubName.get(b.hubId) ?? "hub"} · {fmtDate(b.tripDate)}{" "}
                {b.dayPart ? `(${DAY_PARTS.find((d) => d.value === b.dayPart)?.label})` : ""}
              </span>
              <span className="text-zinc-500">
                {count.get(b.id) ?? 0} racquet(s) · {b.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
