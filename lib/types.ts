// =====================================================================
// Domain contract — the single source of truth for every shared shape.
// Public pages, admin pages, API routes, the batcher, and email templates
// all import from here so nothing drifts. Mirror this against scripts/schema.sql.
// =====================================================================

// --- Service catalog ---------------------------------------------------
export type ServiceType = "byo_string" | "full_service" | "regrip";

// --- Booking lifecycle -------------------------------------------------
// 'stringing' is intentionally collapsed into 'picked_up' for v1.
export type BookingStatus =
  | "submitted" // customer just booked, awaiting owner acceptance
  | "confirmed" // owner accepted; eligible for a DROPOFF batch
  | "dropoff_scheduled" // placed in a dropoff trip (owner will collect)
  | "picked_up" // owner has the racquet; stringing in progress
  | "ready" // strung & ready; eligible for a PICKUP batch
  | "return_scheduled" // placed in a pickup trip (owner will return)
  | "completed" // returned & paid in person
  | "cancelled";

// --- Availability (the grouping signal) --------------------------------
// Coarse on purpose: grouping needs discrete, comparable slots to set-cover.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
// Bookable 1.5-hour meetup windows (owner meets 12pm–8pm). Stored in the
// `day_part` column; the batcher treats these as opaque discrete slots.
export type DayPart = "1200" | "1330" | "1500" | "1630" | "1800";

export interface AvailabilityWindow {
  weekday: Weekday;
  dayPart: DayPart;
}

// --- Trip batches (the batcher output) ---------------------------------
export type BatchPhase = "dropoff" | "pickup";
export type BatchStatus = "proposed" | "confirmed" | "completed" | "cancelled";

// --- Outbound email kinds (used for dedup keys + audit) ----------------
export type EmailKind =
  | "booking_confirmed"
  | "booking_declined"
  | "scheduled_dropoff"
  | "ready_and_scheduled"
  | "completed"
  | "booking_cancelled"
  | "owner_digest";

// =====================================================================
// Row shapes (camelCase app view of the snake_case Supabase tables).
// Keep field names aligned with scripts/schema.sql columns.
// =====================================================================
export interface Hub {
  id: string;
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  sortOrder: number;
  active: boolean;
}

export interface StringItem {
  id: string;
  name: string;
  brand: string | null;
  gauge: string | null;
  color: string | null;
  priceCents: number;
  inStock: boolean;
  sortOrder: number;
  active: boolean;
}

export interface RacquetForSale {
  id: string;
  name: string;
  brand: string | null;
  priceCents: number;
  description: string | null;
  photoUrl: string | null;
  inStock: boolean;
  sortOrder: number;
  active: boolean;
}

export interface Booking {
  id: string;
  publicToken: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  serviceType: ServiceType;
  stringId: string | null; // required iff full_service
  gripQty: number; // for regrip
  racquetLabel: string | null;
  notes: string | null;
  hubId: string | null;
  outOfRange: boolean;
  status: BookingStatus;
  priceQuoteCents: number | null;
  dropoffBatchId: string | null;
  pickupBatchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripBatch {
  id: string;
  hubId: string;
  phase: BatchPhase;
  tripDate: string; // ISO date
  dayPart: DayPart | null;
  status: BatchStatus;
  digestMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Booking with its availability windows (form payload + queries) ----
export interface BookingWithAvailability extends Booking {
  availability: AvailabilityWindow[];
}

// --- Public booking submission payload (POST /api/bookings) ------------
export interface BookingSubmission {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceType: ServiceType;
  stringId?: string | null;
  gripQty?: number;
  racquetLabel?: string;
  notes?: string;
  hubId?: string | null;
  outOfRange?: boolean;
  availability: AvailabilityWindow[];
}
