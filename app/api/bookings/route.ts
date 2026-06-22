import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SERVICES, WEEKDAYS, DAY_PARTS } from "@/lib/constants";
import { sendWithDedup } from "@/lib/email/dispatch";
import { newBookingOwner } from "@/lib/email/templates";
import type { BookingSubmission } from "@/lib/types";

// Public booking submit. Runs as service role (anon has no access to bookings).
// Validates, snapshots the price, and inserts the booking + availability windows.
// No customer email here (confirmation fires on owner accept) — but the owner
// gets a "new booking" notification.
export async function POST(req: NextRequest) {
  let body: BookingSubmission;
  try {
    body = (await req.json()) as BookingSubmission;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { customerName, customerEmail, serviceType } = body;
  if (!customerName?.trim() || !customerEmail?.trim() || !serviceType || !SERVICES[serviceType]) {
    return NextResponse.json({ error: "Missing name, email, or service type" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const svc = SERVICES[serviceType];
  let priceQuote = svc.laborCents;
  let stringId: string | null = null;

  if (serviceType === "full_service") {
    if (!body.stringId) {
      return NextResponse.json({ error: "Pick a string for full service" }, { status: 400 });
    }
    const { data: str } = await supabase
      .from("string_catalog")
      .select("id, price_cents, in_stock, active")
      .eq("id", body.stringId)
      .maybeSingle();
    if (!str || !str.active) {
      return NextResponse.json({ error: "That string isn't available" }, { status: 400 });
    }
    if (!str.in_stock) {
      return NextResponse.json({ error: "That string just sold out — please pick another" }, { status: 409 });
    }
    stringId = str.id;
    priceQuote += str.price_cents;
  }

  const outOfRange = Boolean(body.outOfRange);
  const hubId = outOfRange ? null : body.hubId ?? null;
  if (!outOfRange && !hubId) {
    return NextResponse.json({ error: "Pick a meetup hub (or mark none near you)" }, { status: 400 });
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim(),
      customer_phone: body.customerPhone?.trim() || null,
      service_type: serviceType,
      string_id: stringId,
      grip_qty: serviceType === "regrip" ? body.gripQty ?? 1 : 0,
      racquet_label: body.racquetLabel?.trim() || null,
      notes: body.notes?.trim() || null,
      hub_id: hubId,
      out_of_range: outOfRange,
      status: "submitted",
      price_quote_cents: priceQuote,
    })
    .select("id, public_token")
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: error?.message || "Could not save booking" }, { status: 500 });
  }

  const windows = (body.availability ?? []).filter((w) => w && w.weekday != null && w.dayPart);
  if (windows.length) {
    const { error: availErr } = await supabase.from("booking_availability").insert(
      windows.map((w) => ({ booking_id: booking.id, weekday: w.weekday, day_part: w.dayPart }))
    );
    if (availErr) {
      // Availability drives batching — a booking with none can never be scheduled.
      // Best-effort rollback rather than leave an un-schedulable orphan.
      await supabase.from("bookings").delete().eq("id", booking.id);
      return NextResponse.json(
        { error: "Could not save your availability — please try again." },
        { status: 500 }
      );
    }
  }

  // Notify the owner of the new booking (best-effort; never blocks the response).
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail) {
    let hubName = outOfRange ? "Out of range — none nearby" : "—";
    if (hubId) {
      const { data: h } = await supabase.from("hubs").select("name").eq("id", hubId).maybeSingle();
      if (h?.name) hubName = h.name;
    }
    let stringName: string | null = null;
    if (stringId) {
      const { data: st } = await supabase.from("string_catalog").select("name").eq("id", stringId).maybeSingle();
      stringName = st?.name ?? null;
    }
    const uniqDays = [...new Set(windows.map((w) => w.weekday))];
    const uniqTimes = [...new Set(windows.map((w) => w.dayPart))];
    const daysText = uniqDays.map((d) => WEEKDAYS.find((x) => x.value === d)?.short ?? String(d)).join(", ");
    const timesText = uniqTimes.map((t) => DAY_PARTS.find((x) => x.value === t)?.label ?? String(t)).join(", ");

    const tpl = newBookingOwner({
      bookingId: booking.id,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: body.customerPhone?.trim() || null,
      serviceLabel: svc.label,
      stringName,
      gripQty: serviceType === "regrip" ? body.gripQty ?? 1 : 0,
      racquetLabel: body.racquetLabel?.trim() || null,
      hubName,
      priceCents: priceQuote,
      daysText,
      timesText,
      notes: body.notes?.trim() || null,
    });
    await sendWithDedup(supabase, {
      bookingId: booking.id,
      kind: "new_booking_owner",
      to: ownerEmail,
      dedupKey: `new_booking_owner:${booking.id}`,
      ...tpl,
    });
  }

  return NextResponse.json({ publicToken: booking.public_token });
}
