import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { rowToBooking, rowToHub } from "@/lib/mappers";
import { OWNER_TRANSITIONS } from "@/lib/constants";
import type { BookingStatus, Hub } from "@/lib/types";
import { sendWithDedup } from "@/lib/email/dispatch";
import {
  bookingConfirmed,
  bookingDeclined,
  bookingCancelled,
  completed,
} from "@/lib/email/templates";

// Owner-driven status transition. Validates against OWNER_TRANSITIONS and fires
// the matching customer email (idempotently). Authorized via the owner session.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const ssr = await createServerSupabase();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let to: BookingStatus;
  try {
    ({ to } = (await req.json()) as { to: BookingStatus });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: row } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const booking = rowToBooking(row);
  const allowed = OWNER_TRANSITIONS[booking.status] ?? [];
  if (!allowed.includes(to)) {
    return NextResponse.json(
      { error: `Cannot move from ${booking.status} to ${to}` },
      { status: 400 }
    );
  }

  const wasSubmitted = booking.status === "submitted";
  await supabase
    .from("bookings")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", id);
  booking.status = to;

  // Resolve hub for emails that mention it.
  let hub: Hub | null = null;
  if (booking.hubId) {
    const { data: h } = await supabase.from("hubs").select("*").eq("id", booking.hubId).maybeSingle();
    hub = h ? rowToHub(h) : null;
  }

  // Fire the matching email (picked_up / ready send nothing in v1).
  let tpl: { subject: string; html: string; text: string } | null = null;
  let kind = "";
  if (to === "confirmed") {
    tpl = bookingConfirmed({ booking, hub });
    kind = "booking_confirmed";
  } else if (to === "completed") {
    tpl = completed({ booking });
    kind = "completed";
  } else if (to === "cancelled") {
    tpl = wasSubmitted ? bookingDeclined({ booking }) : bookingCancelled({ booking });
    kind = wasSubmitted ? "booking_declined" : "booking_cancelled";
  }

  if (tpl) {
    await sendWithDedup(supabase, {
      bookingId: booking.id,
      kind,
      to: booking.customerEmail,
      dedupKey: `${kind}:${booking.id}`,
      ...tpl,
    });
  }

  return NextResponse.json({ booking });
}
