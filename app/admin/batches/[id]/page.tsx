import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rowToTripBatch, rowToHub, rowToBooking } from "@/lib/mappers";
import { SERVICES, DAY_PARTS, formatCents } from "@/lib/constants";
import BatchActions from "@/components/admin/BatchActions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function BatchDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase.from("trip_batches").select("*").eq("id", id).maybeSingle();
  if (!row) return <p className="text-zinc-500">Batch not found.</p>;
  const batch = rowToTripBatch(row);
  const fkCol = batch.phase === "dropoff" ? "dropoff_batch_id" : "pickup_batch_id";

  const [{ data: hubRow }, { data: memberRows }] = await Promise.all([
    supabase.from("hubs").select("*").eq("id", batch.hubId).maybeSingle(),
    supabase.from("bookings").select("*").eq(fkCol, id),
  ]);

  const hub = hubRow ? rowToHub(hubRow) : null;
  const members = (memberRows ?? []).map(rowToBooking);
  const total = members.reduce((sum, m) => sum + (m.priceQuoteCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <Link href="/admin/batches" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Batches
      </Link>

      <div>
        <h1 className="text-2xl font-semibold capitalize tracking-tight">
          {batch.phase} · {hub?.name ?? "hub"}
        </h1>
        <p className="text-zinc-500">
          {fmtDate(batch.tripDate)}{" "}
          {batch.dayPart ? `(${DAY_PARTS.find((d) => d.value === batch.dayPart)?.label})` : ""} · {batch.status}
        </p>
        {hub?.description ? <p className="text-sm text-zinc-500">{hub.description}</p> : null}
      </div>

      <BatchActions batchId={batch.id} tripDate={batch.tripDate} dayPart={batch.dayPart} status={batch.status} />

      <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {members.map((m) => (
          <Link
            key={m.id}
            href={`/admin/bookings/${m.id}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-zinc-50"
          >
            <span>
              <span className="font-medium">{m.customerName}</span> · {SERVICES[m.serviceType].label}
              {m.racquetLabel ? ` · ${m.racquetLabel}` : ""}
              {m.customerPhone ? ` · ${m.customerPhone}` : ""}
            </span>
            {batch.phase === "pickup" && <span className="text-zinc-500">{formatCents(m.priceQuoteCents)}</span>}
          </Link>
        ))}
        {members.length === 0 && <p className="px-4 py-3 text-sm text-zinc-400">No bookings in this batch.</p>}
      </div>

      {batch.phase === "pickup" && members.length > 0 && (
        <p className="text-sm text-zinc-600">Total to collect: {formatCents(total)}</p>
      )}
    </div>
  );
}
