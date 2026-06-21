import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToBooking, rowToHub, rowToTripBatch, rowToAvailability } from "@/lib/mappers";

// Public status lookup by unguessable token. Service role (token is the secret).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: row } = await supabase.from("bookings").select("*").eq("public_token", token).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const booking = rowToBooking(row);

  const [availRes, hubRes, dropRes, pickRes] = await Promise.all([
    supabase.from("booking_availability").select("*").eq("booking_id", booking.id),
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

  return NextResponse.json({
    booking,
    availability: (availRes.data ?? []).map(rowToAvailability),
    hub: hubRes.data ? rowToHub(hubRes.data) : null,
    dropoffBatch: dropRes.data ? rowToTripBatch(dropRes.data) : null,
    pickupBatch: pickRes.data ? rowToTripBatch(pickRes.data) : null,
  });
}
