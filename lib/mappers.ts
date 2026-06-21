// snake_case (Supabase rows) -> camelCase (app types). One place so queries
// across routes and pages don't each reinvent the mapping.
import type {
  Hub,
  StringItem,
  RacquetForSale,
  Booking,
  TripBatch,
  AvailabilityWindow,
  ServiceType,
  BookingStatus,
  BatchPhase,
  BatchStatus,
  DayPart,
  Weekday,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function rowToHub(r: any): Hub {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    sortOrder: r.sort_order ?? 0,
    active: r.active,
  };
}

export function rowToString(r: any): StringItem {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand ?? null,
    gauge: r.gauge ?? null,
    color: r.color ?? null,
    priceCents: r.price_cents ?? 0,
    inStock: r.in_stock,
    sortOrder: r.sort_order ?? 0,
    active: r.active,
  };
}

export function rowToRacquet(r: any): RacquetForSale {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand ?? null,
    priceCents: r.price_cents ?? 0,
    description: r.description ?? null,
    photoUrl: r.photo_url ?? null,
    inStock: r.in_stock,
    sortOrder: r.sort_order ?? 0,
    active: r.active,
  };
}

export function rowToBooking(r: any): Booking {
  return {
    id: r.id,
    publicToken: r.public_token,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone ?? null,
    serviceType: r.service_type as ServiceType,
    stringId: r.string_id ?? null,
    gripQty: r.grip_qty ?? 0,
    racquetLabel: r.racquet_label ?? null,
    notes: r.notes ?? null,
    hubId: r.hub_id ?? null,
    outOfRange: r.out_of_range ?? false,
    status: r.status as BookingStatus,
    priceQuoteCents: r.price_quote_cents ?? null,
    dropoffBatchId: r.dropoff_batch_id ?? null,
    pickupBatchId: r.pickup_batch_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToTripBatch(r: any): TripBatch {
  return {
    id: r.id,
    hubId: r.hub_id,
    phase: r.phase as BatchPhase,
    tripDate: r.trip_date,
    dayPart: (r.day_part ?? null) as DayPart | null,
    status: r.status as BatchStatus,
    digestMessageId: r.digest_message_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function rowToAvailability(r: any): AvailabilityWindow {
  return { weekday: r.weekday as Weekday, dayPart: r.day_part as DayPart };
}
