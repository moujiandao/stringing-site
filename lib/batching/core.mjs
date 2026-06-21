// Pure trip-grouping engine. ONE implementation lives here; group.ts is a thin
// typed facade over it. No new Date() / Date.now() in the core — `today` is always
// passed in, so the algorithm is deterministic and unit-testable under node --test.
//
// Defaults mirror lib/constants.ts (MIN_BATCH_SIZE / STRAGGLER_MAX_DAYS / TRIP_LEAD_DAYS).
// At runtime group.ts passes the constants explicitly, so these only apply to
// direct/test calls.
const DEFAULTS = { minBatchSize: 1, stragglerMaxDays: 7, tripLeadDays: 2 };

const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnight(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Soonest ISO yyyy-mm-dd on/after (from + leadDays) whose UTC weekday === weekday.
export function nextDateForWeekday(weekday, from, leadDays) {
  let ms = utcMidnight(from) + leadDays * DAY_MS;
  for (let i = 0; i < 7; i++) {
    if (new Date(ms).getUTCDay() === weekday) break;
    ms += DAY_MS;
  }
  return new Date(ms).toISOString().slice(0, 10);
}

function slotKey(weekday, dayPart) {
  return `${weekday}|${dayPart}`;
}

// Greedy max-coverage set-cover, per hub. Returns TripPlan[].
export function planTrips(bookings, today, opts = {}) {
  const { minBatchSize, stragglerMaxDays, tripLeadDays } = { ...DEFAULTS, ...opts };
  const plans = [];

  // group by hub; skip bookings with no availability (can't be scheduled — retry next run)
  const byHub = new Map();
  for (const b of bookings) {
    if (!b.availability || b.availability.length === 0) continue;
    if (!byHub.has(b.hubId)) byHub.set(b.hubId, []);
    byHub.get(b.hubId).push(b);
  }

  for (const [hubId, hubBookings] of byHub) {
    const remaining = new Set(hubBookings.map((b) => b.id));
    const byId = new Map(hubBookings.map((b) => [b.id, b]));

    while (remaining.size > 0) {
      // tally coverage per (weekday,dayPart) slot across the still-unassigned bookings
      const slotCover = new Map();
      for (const id of remaining) {
        for (const w of byId.get(id).availability) {
          const k = slotKey(w.weekday, w.dayPart);
          if (!slotCover.has(k)) slotCover.set(k, { weekday: w.weekday, dayPart: w.dayPart, ids: new Set() });
          slotCover.get(k).ids.add(id);
        }
      }
      if (slotCover.size === 0) break;

      // pick: most coverage, tie-break earliest tripDate, then slotKey (determinism)
      let best = null;
      for (const [k, v] of slotCover) {
        const tripDate = nextDateForWeekday(v.weekday, today, tripLeadDays);
        const cand = { key: k, weekday: v.weekday, dayPart: v.dayPart, ids: v.ids, tripDate };
        if (
          best === null ||
          cand.ids.size > best.ids.size ||
          (cand.ids.size === best.ids.size && cand.tripDate < best.tripDate) ||
          (cand.ids.size === best.ids.size && cand.tripDate === best.tripDate && cand.key < best.key)
        ) {
          best = cand;
        }
      }

      const ids = [...best.ids];

      // straggler rule: a sub-minBatchSize plan is only worth a trip if its oldest
      // booking has already waited too long; otherwise hold it for a future run.
      if (ids.length < minBatchSize) {
        const oldestMs = Math.min(...ids.map((id) => utcMidnight(new Date(byId.get(id).createdAt))));
        const ageDays = (utcMidnight(today) - oldestMs) / DAY_MS;
        if (ageDays < stragglerMaxDays) {
          for (const id of ids) remaining.delete(id);
          continue; // dropped this run, not emitted
        }
      }

      plans.push({ hubId, weekday: best.weekday, dayPart: best.dayPart, tripDate: best.tripDate, bookingIds: ids });
      for (const id of ids) remaining.delete(id);
    }
  }

  return plans;
}
