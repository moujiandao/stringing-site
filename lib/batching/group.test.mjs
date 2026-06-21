import { test } from "node:test";
import assert from "node:assert/strict";
import { planTrips, nextDateForWeekday } from "./core.mjs";

// Fixed reference points (all UTC). 2026-06-17 is a Wednesday; 2026-06-20 a Saturday.
const TODAY = new Date("2026-06-17T12:00:00Z");
const SAT = 6;
const SUN = 0;
const MON = 1;
const TUE = 2;

const mk = (id, hubId, availability, createdAt = "2026-06-16") => ({
  id,
  hubId,
  createdAt,
  availability,
});

test("nextDateForWeekday respects leadDays and weekday", () => {
  // Wed 06-17 + 2 lead = Fri 06-19, advance to Sat -> 06-20
  assert.equal(nextDateForWeekday(SAT, TODAY, 2), "2026-06-20");
  // Sunday after that window -> 06-21
  assert.equal(nextDateForWeekday(SUN, TODAY, 2), "2026-06-21");
});

test("same hub + same slot collapse into one trip", () => {
  const bookings = [
    mk("a", "hub1", [{ weekday: SAT, dayPart: "morning" }]),
    mk("b", "hub1", [{ weekday: SAT, dayPart: "morning" }]),
    mk("c", "hub1", [{ weekday: SAT, dayPart: "morning" }]),
  ];
  const plans = planTrips(bookings, TODAY);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].bookingIds.length, 3);
  assert.equal(plans[0].tripDate, "2026-06-20");
});

test("non-overlapping slots split into separate trips", () => {
  const bookings = [
    mk("a", "hub1", [{ weekday: SAT, dayPart: "morning" }]),
    mk("b", "hub1", [{ weekday: SUN, dayPart: "evening" }]),
  ];
  const plans = planTrips(bookings, TODAY);
  assert.equal(plans.length, 2);
});

test("greedy picks the highest-coverage slot first", () => {
  // Mon morning covers a,b,d (3); Tue morning covers a,c (2). a is flexible.
  const bookings = [
    mk("a", "hub1", [
      { weekday: MON, dayPart: "morning" },
      { weekday: TUE, dayPart: "morning" },
    ]),
    mk("b", "hub1", [{ weekday: MON, dayPart: "morning" }]),
    mk("c", "hub1", [{ weekday: TUE, dayPart: "morning" }]),
    mk("d", "hub1", [{ weekday: MON, dayPart: "morning" }]),
  ];
  const plans = planTrips(bookings, TODAY);
  // first plan is the Mon-morning batch of 3 (a,b,d); leftover c gets its own
  assert.equal(plans[0].bookingIds.length, 3);
  assert.ok(plans[0].bookingIds.includes("a"));
  assert.ok(plans[0].bookingIds.includes("b"));
  assert.ok(plans[0].bookingIds.includes("d"));
  assert.equal(plans.length, 2);
  assert.deepEqual(plans[1].bookingIds, ["c"]);
});

test("two hubs produce independent trips", () => {
  const bookings = [
    mk("a", "hub1", [{ weekday: SAT, dayPart: "morning" }]),
    mk("b", "hub2", [{ weekday: SAT, dayPart: "morning" }]),
  ];
  const plans = planTrips(bookings, TODAY);
  assert.equal(plans.length, 2);
  assert.notEqual(plans[0].hubId, plans[1].hubId);
});

test("straggler below minBatchSize is dropped when young", () => {
  const bookings = [
    mk("solo", "hub1", [{ weekday: SAT, dayPart: "morning" }], "2026-06-16"), // 1 day old
  ];
  const plans = planTrips(bookings, TODAY, { minBatchSize: 2, stragglerMaxDays: 7 });
  assert.equal(plans.length, 0);
});

test("straggler below minBatchSize is emitted once it has aged past the limit", () => {
  const bookings = [
    mk("solo", "hub1", [{ weekday: SAT, dayPart: "morning" }], "2026-06-05"), // 12 days old
  ];
  const plans = planTrips(bookings, TODAY, { minBatchSize: 2, stragglerMaxDays: 7 });
  assert.equal(plans.length, 1);
  assert.deepEqual(plans[0].bookingIds, ["solo"]);
});

test("bookings with no availability are skipped", () => {
  const bookings = [mk("a", "hub1", [])];
  const plans = planTrips(bookings, TODAY);
  assert.equal(plans.length, 0);
});
