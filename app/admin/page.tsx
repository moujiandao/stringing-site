import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rowToBooking } from "@/lib/mappers";
import { STATUS_LABELS, SERVICES } from "@/lib/constants";
import type { Booking, BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const QUEUES: { status: BookingStatus; title: string }[] = [
  { status: "submitted", title: "New — awaiting your acceptance" },
  { status: "confirmed", title: "Confirmed — awaiting drop-off batch" },
  { status: "dropoff_scheduled", title: "Drop-off scheduled" },
  { status: "picked_up", title: "Stringing" },
  { status: "ready", title: "Ready — awaiting return batch" },
  { status: "return_scheduled", title: "Return scheduled" },
];

function Row({ b }: { b: Booking }) {
  return (
    <Link
      href={`/admin/bookings/${b.id}`}
      className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
    >
      <span>
        <span className="font-medium">{b.customerName}</span>
        <span className="text-zinc-500"> · {SERVICES[b.serviceType].label}</span>
      </span>
      <span className="text-zinc-400">{b.racquetLabel ?? ""}</span>
    </Link>
  );
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: true });
  const bookings = (rows ?? []).map(rowToBooking);

  const byStatus = (s: BookingStatus) => bookings.filter((b) => b.status === s && !b.outOfRange);
  const outOfRange = bookings.filter((b) => b.outOfRange && b.status === "submitted");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {outOfRange.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-700">
            Out of range — handle manually ({outOfRange.length})
          </h2>
          <div className="space-y-1">
            {outOfRange.map((b) => (
              <Row key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}

      {QUEUES.map((q) => {
        const items = byStatus(q.status);
        return (
          <section key={q.status} className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-700">
              {q.title} ({items.length})
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-zinc-400">None.</p>
            ) : (
              <div className="space-y-1">
                {items.map((b) => (
                  <Row key={b.id} b={b} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <p className="text-xs text-zinc-400">
        Completed and cancelled bookings are hidden. Statuses: {Object.values(STATUS_LABELS).join(", ")}.
      </p>
    </div>
  );
}
