import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { rowToBooking, rowToHub, rowToTripBatch } from "@/lib/mappers";
import type { DayPart, Hub } from "@/lib/types";
import { sendWithDedup } from "@/lib/email/dispatch";
import { scheduledDropoff, readyAndScheduled } from "@/lib/email/templates";

// Owner batch actions: confirm | reschedule | cancel. Manual override always wins
// over the nightly greedy plan. Cancelling re-pools member bookings for next run.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ssr = await createServerSupabase();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let action: string;
  let tripDate: string | undefined;
  let dayPart: DayPart | undefined;
  try {
    const body = (await req.json()) as { action: string; tripDate?: string; dayPart?: DayPart };
    action = body.action;
    tripDate = body.tripDate;
    dayPart = body.dayPart;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: bRow } = await supabase.from("trip_batches").select("*").eq("id", id).maybeSingle();
  if (!bRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const batch = rowToTripBatch(bRow);

  const fkCol = batch.phase === "dropoff" ? "dropoff_batch_id" : "pickup_batch_id";

  if (action === "confirm") {
    await supabase
      .from("trip_batches")
      .update({ status: "confirmed", updated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    await supabase
      .from("trip_batches")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id);
    const revertStatus = batch.phase === "dropoff" ? "confirmed" : "ready";
    const scheduledStatus = batch.phase === "dropoff" ? "dropoff_scheduled" : "return_scheduled";
    await supabase
      .from("bookings")
      .update({ [fkCol]: null, status: revertStatus, updated_at: new Date().toISOString() })
      .eq(fkCol, id)
      .eq("status", scheduledStatus);
    return NextResponse.json({ ok: true });
  }

  if (action === "reschedule") {
    if (!tripDate) return NextResponse.json({ error: "tripDate required" }, { status: 400 });
    await supabase
      .from("trip_batches")
      .update({ trip_date: tripDate, day_part: dayPart ?? batch.dayPart, updated_at: new Date().toISOString() })
      .eq("id", id);

    const updated = rowToTripBatch({ ...bRow, trip_date: tripDate, day_part: dayPart ?? batch.dayPart });

    // Re-notify members. dedup_key includes the date so a real reschedule re-sends.
    let hub: Hub | null = null;
    const { data: h } = await supabase.from("hubs").select("*").eq("id", batch.hubId).maybeSingle();
    hub = h ? rowToHub(h) : null;

    const { data: members } = await supabase.from("bookings").select("*").eq(fkCol, id);
    for (const m of members ?? []) {
      const booking = rowToBooking(m);
      const tpl =
        batch.phase === "dropoff"
          ? scheduledDropoff({ booking, hub, batch: updated })
          : readyAndScheduled({ booking, hub, batch: updated, amountDueCents: booking.priceQuoteCents });
      const kind = batch.phase === "dropoff" ? "scheduled_dropoff" : "ready_and_scheduled";
      await sendWithDedup(supabase, {
        bookingId: booking.id,
        kind,
        to: booking.customerEmail,
        dedupKey: `${kind}:${booking.id}:${tripDate}`,
        ...tpl,
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
