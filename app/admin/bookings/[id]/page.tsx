import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rowToBooking, rowToHub, rowToAvailability } from "@/lib/mappers";
import { SERVICES, STATUS_LABELS, WEEKDAYS, DAY_PARTS, formatCents } from "@/lib/constants";
import TransitionButtons from "@/components/admin/TransitionButtons";

export const dynamic = "force-dynamic";

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!row) {
    return <p className="text-zinc-500">Booking not found.</p>;
  }
  const booking = rowToBooking(row);

  const [{ data: hubRow }, { data: availRows }] = await Promise.all([
    booking.hubId
      ? supabase.from("hubs").select("*").eq("id", booking.hubId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("booking_availability").select("*").eq("booking_id", id),
  ]);

  const hub = hubRow ? rowToHub(hubRow) : null;
  const availability = (availRows ?? []).map(rowToAvailability);
  const availText = availability
    .map(
      (w) =>
        `${WEEKDAYS.find((d) => d.value === w.weekday)?.short} ${
          DAY_PARTS.find((d) => d.value === w.dayPart)?.label
        }`
    )
    .join(", ");

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{booking.customerName}</h1>
        <p className="text-zinc-500">
          {STATUS_LABELS[booking.status]}
          {booking.outOfRange ? " · out of range" : ""}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">
          Racquets{booking.racquets.length ? ` (${booking.racquets.length})` : ""}
        </h2>
        <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white text-sm">
          {booking.racquets.length === 0 ? (
            <p className="px-4 py-3 text-zinc-500">
              {(SERVICES[booking.serviceType]?.label ?? booking.serviceType)}
              {booking.racquetLabel ? ` · ${booking.racquetLabel}` : ""}
            </p>
          ) : (
            booking.racquets.map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">{r.name || `Racquet ${i + 1}`}</p>
                  <p className="text-zinc-500">
                    {SERVICES[r.serviceType].label}
                    {r.serviceType === "hybrid"
                      ? ` · ${r.stringName ?? "?"} (mains) / ${r.crossesName ?? "?"} (crosses)`
                      : r.stringName
                        ? ` · ${r.stringName}`
                        : ""}
                    {r.regrip ? " · + regrip" : ""}
                  </p>
                </div>
                <span className="font-medium">{formatCents(r.priceCents)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <dl className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Email</dt>
          <dd>{booking.customerEmail}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Phone</dt>
          <dd>{booking.customerPhone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Quote</dt>
          <dd>{formatCents(booking.priceQuoteCents)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Hub</dt>
          <dd>{hub?.name ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Availability</dt>
          <dd>{availText || "—"}</dd>
        </div>
        {booking.notes && (
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Notes</dt>
            <dd>{booking.notes}</dd>
          </div>
        )}
      </dl>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">Actions</h2>
        <TransitionButtons bookingId={booking.id} status={booking.status} />
      </div>
    </div>
  );
}
