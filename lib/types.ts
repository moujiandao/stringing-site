// =====================================================================
// Domain contract — the single source of truth for every shared shape.
// Public pages, admin pages, API routes, the batcher, and email templates
// all import from here so nothing drifts. Mirror this against scripts/schema.sql.
// =====================================================================

// --- Service catalog ---------------------------------------------------
// hybrid = different string on mains vs. crosses (each charged at half price).
// regrip is no longer a standalone service — it's a per-racquet add-on — but the
// SERVICES entry stays as the source of the $3 add-on price.
export type ServiceType = "byo_string" | "full_service" | "hybrid" | "regrip";

// The stringing services a racquet can have (regrip is an add-on, not a service).
export type StringingService = Exclude<ServiceType, "regrip">;

// One racquet in a booking. Stored as a snapshot in bookings.racquets (jsonb):
// names/prices are captured at submit time so display needs no joins.
export interface BookingRacquet {
  name: string;
  serviceType: StringingService;
  stringId: string | null; // full_service: the string; hybrid: the mains
  stringName: string | null;
  stringPriceCents: number | null;
  crossesStringId: string | null; // hybrid crosses
  crossesName: string | null;
  crossesPriceCents: number | null;
  mainsTension: number | null; // lbs; null = "go with recommended"
  crossesTension: number | null; // lbs; hybrid only
  regrip: boolean; // +$3 add-on (your choice of overgrip)
  priceCents: number; // this racquet's line total (stringing + regrip)
}

// What the booking form submits per racquet (server resolves names/prices).
export interface RacquetInput {
  name: string;
  serviceType: StringingService;
  stringId?: string | null;
  crossesStringId?: string | null;
  mainsTension?: number | null;
  crossesTension?: number | null;
  regrip: boolean;
}

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
  photoUrl: string | null;
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
  racquets: BookingRacquet[]; // source of truth for what's being strung
  // Legacy single-racquet columns (kept for old bookings / list views).
  serviceType: ServiceType;
  stringId: string | null;
  crossesStringId: string | null;
  gripQty: number;
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
  racquets: RacquetInput[];
  notes?: string;
  hubId?: string | null;
  outOfRange?: boolean;
  availability: AvailabilityWindow[];
}
