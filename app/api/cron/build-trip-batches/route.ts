import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planTrips } from "@/lib/batching/group";
import { PHASE_ELIGIBLE_STATUS, WEEKDAYS, DAY_PARTS } from "@/lib/constants";
import { rowToBooking, rowToHub, rowToTripBatch, rowToAvailability } from "@/lib/mappers";
import { sendWithDedup } from "@/lib/email/dispatch";
import {
  scheduledDropoff,
  readyAndScheduled,
  ownerDigest,
  type OwnerDigestRow,
} from "@/lib/email/templates";
import type { BatchPhase, Hub, AvailabilityWindow } from "@/lib/types";

export const dynamic = "force-dynamic";

function availText(windows: AvailabilityWindow[]): string {
  return windows
    .map((w) => {
      const day = WEEKDAYS.find((d) => d.value === w.weekday)?.short ?? String(w.weekday);
      const part = DAY_PARTS.find((d) => d.value === w.dayPart)?.label ?? w.dayPart;
      return `${day} ${part}`;
    })
    .join(", ");
}

// Nightly batcher (Vercel Cron). Groups un-batched eligible bookings by hub +
// availability into the fewest trips, schedules them, and emails customers +
// the owner digest. Idempotent: batch dedup index + email_log dedup keys make
// re-runs safe. Mirrors propmanager's cron auth + idempotency pattern.
async function handle(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date();
  const ownerEmail = process.env.OWNER_EMAIL || "";
  const result = {
    dropoffBatches: 0,
    pickupBatches: 0,
    bookingsScheduled: 0,
    emailed: 0,
    skipped: 0,
  };

  const phases: BatchPhase[] = ["dropoff", "pickup"];
  for (const phase of phases) {
    const eligibleStatus = PHASE_ELIGIBLE_STATUS[phase];
    const fkCol = phase === "dropoff" ? "dropoff_batch_id" : "pickup_batch_id";
    const newStatus = phase === "dropoff" ? "dropoff_scheduled" : "return_scheduled";

    const { data: bRows } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", eligibleStatus)
      .is(fkCol, null)
      .eq("out_of_range", false);

    const bookings = (bRows ?? []).map(rowToBooking).filter((b) => b.hubId);
    if (!bookings.length) continue;
    const bookingById = new Map(bookings.map((b) => [b.id, b]));

    // availability windows
    const ids = bookings.map((b) => b.id);
    const { data: aRows } = await supabase
      .from("booking_availability")
      .select("*")
      .in("booking_id", ids);
    const availMap = new Map<string, AvailabilityWindow[]>();
    for (const r of aRows ?? []) {
      const arr = availMap.get(r.booking_id) ?? [];
      arr.push(rowToAvailability(r));
      availMap.set(r.booking_id, arr);
    }


    const inputs = bookings.map((b) => ({
      id: b.id,
      hubId: b.hubId as string,
      createdAt: b.createdAt,
      availability: availMap.get(b.id) ?? [],
    }));
    const plans = planTrips(inputs, today);

    for (const plan of plans) {
      // create or reuse the live batch for (hub, phase, date)
      let batchRow;
      const ins = await supabase
        .from("trip_batches")
        .insert({
          hub_id: plan.hubId,
          phase,
          trip_date: plan.tripDate,
          day_part: plan.dayPart,
          status: "proposed",
        })
        .select("*")
        .single();

      if (ins.error) {
        if (ins.error.code === "23505") {
          const { data: existing } = await supabase
            .from("trip_batches")
            .select("*")
            .eq("hub_id", plan.hubId)
            .eq("phase", phase)
            .eq("trip_date", plan.tripDate)
            .neq("status", "cancelled")
            .maybeSingle();
          batchRow = existing;
        } else {
          continue;
        }
      } else {
        batchRow = ins.data;
        if (phase === "dropoff") result.dropoffBatches++;
        else result.pickupBatches++;
      }
      if (!batchRow) continue;
      const batch = rowToTripBatch(batchRow);

      // assign FK + transition the bookings. The status guard makes this safe on
      // batch reuse / races: only bookings still in the eligible state are moved.
      await supabase
        .from("bookings")
        .update({ [fkCol]: batch.id, status: newStatus, updated_at: new Date().toISOString() })
        .in("id", plan.bookingIds)
        .eq("status", eligibleStatus);
      result.bookingsScheduled += plan.bookingIds.length;

      const { data: h } = await supabase.from("hubs").select("*").eq("id", plan.hubId).maybeSingle();
      const hub: Hub | null = h ? rowToHub(h) : null;

      // customer scheduling emails
      for (const bid of plan.bookingIds) {
        const booking = bookingById.get(bid)!;
        booking.status = newStatus;
        const tpl =
          phase === "dropoff"
            ? scheduledDropoff({ booking, hub, batch })
            : readyAndScheduled({ booking, hub, batch, amountDueCents: booking.priceQuoteCents });
        const kind = phase === "dropoff" ? "scheduled_dropoff" : "ready_and_scheduled";
        const r = await sendWithDedup(supabase, {
          bookingId: bid,
          kind,
          to: booking.customerEmail,
          dedupKey: `${kind}:${bid}`,
          ...tpl,
        });
        if (r.skipped) result.skipped++;
        else if (!r.error) result.emailed++;
      }

      // owner trip digest (one per batch, deduped)
      if (ownerEmail) {
        const rows: OwnerDigestRow[] = plan.bookingIds.map((bid) => {
          const b = bookingById.get(bid)!;
          return {
            customerName: b.customerName,
            racquetLabel: b.racquetLabel,
            serviceType: b.serviceType,
            // Per-string detail lives in the admin booking page; the digest just
            // notes how many racquets so the owner knows what to carry.
            stringName: b.racquets.length > 1 ? `${b.racquets.length} racquets` : null,
            gripQty: b.gripQty,
            customerPhone: b.customerPhone,
            amountDueCents: phase === "pickup" ? b.priceQuoteCents : null,
            otherAvailability: availText(availMap.get(bid) ?? []),
          };
        });
        const tpl = ownerDigest({ batch, hub, rows });
        const r = await sendWithDedup(supabase, {
          bookingId: null,
          kind: "owner_digest",
          to: ownerEmail,
          dedupKey: `owner_digest:${batch.id}`,
          ...tpl,
        });
        if (r.skipped) result.skipped++;
        else if (!r.error) result.emailed++;
      }
    }
  }

  return Response.json({ ok: true, ranAt: today.toISOString(), ...result });
}

export const GET = handle;
export const POST = handle;
