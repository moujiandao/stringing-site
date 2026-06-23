import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SERVICES, WEEKDAYS, DAY_PARTS, racquetQuoteCents, MIN_TENSION, MAX_TENSION } from "@/lib/constants";
import { sendWithDedup } from "@/lib/email/dispatch";
import { newBookingOwner } from "@/lib/email/templates";
import type { BookingSubmission, BookingRacquet, StringingService } from "@/lib/types";

// Valid tension (lbs) or null ("go with recommended").
const cleanTension = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= MIN_TENSION && n <= MAX_TENSION ? Math.round(n) : null;
};

// Public booking submit. Runs as service role (anon has no access to bookings).
// Validates each racquet, snapshots names/prices, sums the quote, and inserts.
// No customer email here (confirmation fires on owner accept) — the owner gets
// a "new booking" notification.
export async function POST(req: NextRequest) {
  let body: BookingSubmission;
  try {
    body = (await req.json()) as BookingSubmission;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { customerName, customerEmail } = body;
  if (!customerName?.trim() || !customerEmail?.trim()) {
    return NextResponse.json({ error: "Missing name or email" }, { status: 400 });
  }
  const racquetsInput = Array.isArray(body.racquets) ? body.racquets : [];
  if (racquetsInput.length === 0) {
    return NextResponse.json({ error: "Add at least one racquet" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch every referenced string once.
  const ids = [
    ...new Set(racquetsInput.flatMap((r) => [r.stringId, r.crossesStringId]).filter(Boolean)),
  ] as string[];
  const strById = new Map<
    string,
    { id: string; name: string; price_cents: number; in_stock: boolean; active: boolean }
  >();
  if (ids.length) {
    const { data: rows } = await supabase
      .from("string_catalog")
      .select("id,name,price_cents,in_stock,active")
      .in("id", ids);
    for (const s of rows ?? []) strById.set(s.id, s);
  }

  const racquets: BookingRacquet[] = [];
  for (const r of racquetsInput) {
    const st = r.serviceType as StringingService;
    if (st !== "byo_string" && st !== "full_service" && st !== "hybrid") {
      return NextResponse.json({ error: "Invalid service for a racquet" }, { status: 400 });
    }

    let stringId: string | null = null;
    let stringName: string | null = null;
    let stringPriceCents: number | null = null;
    let crossesStringId: string | null = null;
    let crossesName: string | null = null;
    let crossesPriceCents: number | null = null;

    if (st === "full_service" || st === "hybrid") {
      const m = r.stringId ? strById.get(r.stringId) : null;
      if (!m || !m.active) return NextResponse.json({ error: "That string isn't available" }, { status: 400 });
      if (!m.in_stock)
        return NextResponse.json({ error: "That string just sold out — please pick another" }, { status: 409 });
      stringId = m.id;
      stringName = m.name;
      stringPriceCents = m.price_cents;
    }
    if (st === "hybrid") {
      const c = r.crossesStringId ? strById.get(r.crossesStringId) : null;
      if (!c || !c.active)
        return NextResponse.json({ error: "That crosses string isn't available" }, { status: 400 });
      if (!c.in_stock)
        return NextResponse.json({ error: "That crosses string just sold out — please pick another" }, { status: 409 });
      crossesStringId = c.id;
      crossesName = c.name;
      crossesPriceCents = c.price_cents;
    }

    const priceCents = racquetQuoteCents({
      serviceType: st,
      stringPriceCents,
      mainsPriceCents: stringPriceCents,
      crossesPriceCents,
      regrip: Boolean(r.regrip),
    });

    racquets.push({
      name: (r.name || "").trim(),
      serviceType: st,
      stringId,
      stringName,
      stringPriceCents,
      crossesStringId,
      crossesName,
      crossesPriceCents,
      mainsTension: cleanTension(r.mainsTension),
      crossesTension: st === "hybrid" ? cleanTension(r.crossesTension) : null,
      regrip: Boolean(r.regrip),
      priceCents,
    });
  }

  const priceQuote = racquets.reduce((sum, r) => sum + r.priceCents, 0);
  const racquetLabel = racquets.map((r, i) => r.name || `Racquet ${i + 1}`).join(", ");

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
      service_type: racquets[0].serviceType,
      racquets,
      racquet_label: racquetLabel,
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
      await supabase.from("bookings").delete().eq("id", booking.id);
      return NextResponse.json(
        { error: "Could not save your availability — please try again." },
        { status: 500 }
      );
    }
  }

  // Notify the owner (best-effort; never blocks the response).
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail) {
    let hubName = outOfRange ? "Out of range — none nearby" : "—";
    if (hubId) {
      const { data: h } = await supabase.from("hubs").select("name").eq("id", hubId).maybeSingle();
      if (h?.name) hubName = h.name;
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
      hubName,
      totalCents: priceQuote,
      daysText,
      timesText,
      notes: body.notes?.trim() || null,
      racquets: racquets.map((r, i) => ({
        name: r.name || `Racquet ${i + 1}`,
        serviceLabel: SERVICES[r.serviceType].label,
        strings:
          r.serviceType === "hybrid"
            ? `${r.stringName ?? "?"} (mains) / ${r.crossesName ?? "?"} (crosses)`
            : r.stringName ?? "",
        tension:
          r.serviceType === "hybrid"
            ? `${r.mainsTension != null ? `${r.mainsTension} lbs` : "rec."} mains / ${
                r.crossesTension != null ? `${r.crossesTension} lbs` : "rec."
              } crosses`
            : r.mainsTension != null
              ? `${r.mainsTension} lbs`
              : "recommended",
        regrip: r.regrip,
        priceCents: r.priceCents,
      })),
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
