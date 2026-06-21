import { createAdminClient } from "@/lib/supabase/admin";
import { rowToBooking, rowToHub, rowToTripBatch } from "@/lib/mappers";
import { STATUS_LABELS, DAY_PARTS, formatCents } from "@/lib/constants";
import type { BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TIMELINE: BookingStatus[] = [
  "submitted",
  "confirmed",
  "dropoff_scheduled",
  "picked_up",
  "ready",
  "return_scheduled",
  "completed",
];

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: row } = await supabase.from("bookings").select("*").eq("public_token", token).maybeSingle();
  if (!row) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-lg font-semibold">Booking not found</h1>
        <p className="mt-2 text-zinc-600">Double-check your link.</p>
      </div>
    );
  }

  const booking = rowToBooking(row);
  const cancelled = booking.status === "cancelled";

  const [{ data: hubRow }, { data: dropRow }, { data: pickRow }] = await Promise.all([
    booking.hubId
      ? supabase.from("hubs").select("*").eq("id", booking.hubId).maybeSingle()
      : Promise.resolve({ data: null }),
    booking.dropoffBatchId
      ? supabase.from("trip_batches").select("*").eq("id", booking.dropoffBatchId).maybeSingle()
      : Promise.resolve({ data: null }),
    booking.pickupBatchId
      ? supabase.from("trip_batches").select("*").eq("id", booking.pickupBatchId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const hub = hubRow ? rowToHub(hubRow) : null;
  const dropoff = dropRow ? rowToTripBatch(dropRow) : null;
  const pickup = pickRow ? rowToTripBatch(pickRow) : null;
  const activeIdx = TIMELINE.indexOf(booking.status);
  const dayPartLabel = (dp: string | null) => DAY_PARTS.find((d) => d.value === dp)?.label ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Booking status</h1>
        <p className="mt-1 text-zinc-600">{booking.customerName}</p>
      </div>

      {cancelled ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          This booking was cancelled.
        </div>
      ) : (
        <ol className="space-y-2">
          {TIMELINE.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  i <= activeIdx ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"
                }`}
              >
                {i < activeIdx ? "✓" : i === activeIdx ? "•" : ""}
              </span>
              <span className={i === activeIdx ? "font-semibold" : "text-zinc-500"}>
                {STATUS_LABELS[s]}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {hub && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm font-medium text-zinc-500">Meetup spot</p>
            <p className="font-medium">{hub.name}</p>
            {hub.description ? <p className="text-sm text-zinc-600">{hub.description}</p> : null}
          </div>
        )}
        {dropoff && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm font-medium text-zinc-500">Drop-off</p>
            <p className="font-medium">
              {fmtDate(dropoff.tripDate)} {dropoff.dayPart ? `(${dayPartLabel(dropoff.dayPart)})` : ""}
            </p>
          </div>
        )}
        {pickup && (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <p className="text-sm font-medium text-zinc-500">Pick-up</p>
            <p className="font-medium">
              {fmtDate(pickup.tripDate)} {pickup.dayPart ? `(${dayPartLabel(pickup.dayPart)})` : ""}
            </p>
            {booking.priceQuoteCents != null && (
              <p className="mt-1 text-sm text-zinc-600">
                Bring {formatCents(booking.priceQuoteCents)} — cash / Venmo / Zelle
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
