// Typed facade over lib/batching/core.mjs. No logic here — it imports the single
// implementation and re-exports it with TypeScript types, and pins the runtime
// tuning knobs from lib/constants.ts so callers don't have to.
import type { Weekday, DayPart, AvailabilityWindow } from "@/lib/types";
import { MIN_BATCH_SIZE, STRAGGLER_MAX_DAYS, TRIP_LEAD_DAYS } from "@/lib/constants";
import { planTrips as corePlanTrips, nextDateForWeekday as coreNextDate } from "./core.mjs";

export interface PlanInputBooking {
  id: string;
  hubId: string;
  createdAt: string;
  availability: AvailabilityWindow[];
}

export interface TripPlan {
  hubId: string;
  weekday: Weekday;
  dayPart: DayPart;
  tripDate: string; // ISO yyyy-mm-dd
  bookingIds: string[];
}

export interface PlanOpts {
  minBatchSize?: number;
  stragglerMaxDays?: number;
  tripLeadDays?: number;
}

export function nextDateForWeekday(weekday: Weekday, from: Date, leadDays: number): string {
  return coreNextDate(weekday, from, leadDays);
}

export function planTrips(
  bookings: PlanInputBooking[],
  today: Date,
  opts: PlanOpts = {}
): TripPlan[] {
  return corePlanTrips(bookings, today, {
    minBatchSize: MIN_BATCH_SIZE,
    stragglerMaxDays: STRAGGLER_MAX_DAYS,
    tripLeadDays: TRIP_LEAD_DAYS,
    ...opts,
  });
}
