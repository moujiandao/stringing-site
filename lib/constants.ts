// =====================================================================
// Pricing, labels, and batching knobs. Shared by UI + server + batcher.
// =====================================================================
import type { ServiceType, BookingStatus, DayPart, Weekday, BatchPhase } from "./types";

// --- Services ----------------------------------------------------------
// Labor in cents. Full service adds the chosen string's price; regrip adds
// grip cost handled per-grip in person. Mirrors the competitor's tiers but
// stripped of fluff.
export const SERVICES: Record<
  ServiceType,
  { label: string; laborCents: number; blurb: string; priceNote: string; needsString: boolean; needsGrip: boolean }
> = {
  byo_string: {
    label: "Bring Your Own String",
    laborCents: 2000,
    blurb: "You supply the string. I string it. $20 labor.",
    priceNote: "labor only",
    needsString: false,
    needsGrip: false,
  },
  full_service: {
    label: "Stringing + Pick your String",
    laborCents: 2000,
    blurb: "Pick a string from the catalog. $20 labor + string cost.",
    priceNote: "+ string cost",
    needsString: true,
    needsGrip: false,
  },
  hybrid: {
    label: "Hybrid (two strings)",
    laborCents: 2000,
    blurb: "Different string on the mains and the crosses. $20 labor + half of each string.",
    priceNote: "+ ½ of each string",
    needsString: false,
    needsGrip: false,
  },
  regrip: {
    label: "Regrip",
    laborCents: 300,
    blurb: "Fresh overgrip of your choice, installed. $3 flat.",
    priceNote: "incl. overgrip",
    needsString: false,
    needsGrip: false,
  },
};

export const SERVICE_TYPES = Object.keys(SERVICES) as ServiceType[];

// Shared price quote (in cents). Used by BOTH the booking form (live estimate)
// and the API (price_quote_cents) so the shown total and the saved quote match.
// full_service: labor + string. hybrid: labor + half of each string. else: labor.
export function quoteCents(
  serviceType: ServiceType,
  opts: {
    stringPriceCents?: number | null;
    mainsPriceCents?: number | null;
    crossesPriceCents?: number | null;
  } = {}
): number {
  const labor = SERVICES[serviceType].laborCents;
  if (serviceType === "full_service") return labor + (opts.stringPriceCents ?? 0);
  if (serviceType === "hybrid")
    return (
      labor +
      Math.round((opts.mainsPriceCents ?? 0) / 2) +
      Math.round((opts.crossesPriceCents ?? 0) / 2)
    );
  return labor; // byo_string, regrip
}

// --- Availability labels ----------------------------------------------
export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

// Bookable 1.5-hour meetup windows (owner is available 12pm–8pm daily).
export const DAY_PARTS: { value: DayPart; label: string }[] = [
  { value: "1200", label: "12:00–1:30 PM" },
  { value: "1330", label: "1:30–3:00 PM" },
  { value: "1500", label: "3:00–4:30 PM" },
  { value: "1630", label: "4:30–6:00 PM" },
  { value: "1800", label: "6:00–7:30 PM" },
];

// --- Booking status display -------------------------------------------
export const STATUS_LABELS: Record<BookingStatus, string> = {
  submitted: "Submitted",
  confirmed: "Confirmed",
  dropoff_scheduled: "Drop-off scheduled",
  picked_up: "Picked up — stringing",
  ready: "Strung & ready",
  return_scheduled: "Return scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Owner-driven transitions allowed from each status (UI guards + server checks).
// Batcher-driven transitions (confirmed→dropoff_scheduled, ready→return_scheduled)
// are NOT in this map — only the cron sets those.
export const OWNER_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  submitted: ["confirmed", "cancelled"],
  confirmed: ["cancelled"],
  dropoff_scheduled: ["picked_up", "confirmed", "cancelled"],
  picked_up: ["ready", "cancelled"],
  ready: ["cancelled"],
  return_scheduled: ["completed", "ready", "cancelled"],
  completed: [],
  cancelled: [],
};

// Which eligible status feeds each batching phase.
export const PHASE_ELIGIBLE_STATUS: Record<BatchPhase, BookingStatus> = {
  dropoff: "confirmed",
  pickup: "ready",
};

// --- Batching knobs (the trip-minimization tuning levers) -------------
export const MIN_BATCH_SIZE = 1; // smallest trip the batcher will schedule unprompted
export const STRAGGLER_MAX_DAYS = 7; // force a solo trip after a booking waits this long
export const TRIP_LEAD_DAYS = 2; // soonest a proposed trip date can be from "today"

// --- Money helper ------------------------------------------------------
export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
