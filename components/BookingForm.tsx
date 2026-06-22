"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { rowToHub, rowToString } from "@/lib/mappers";
import { SERVICES, SERVICE_TYPES, WEEKDAYS, DAY_PARTS, formatCents } from "@/lib/constants";
import type { Hub, StringItem, ServiceType, AvailabilityWindow, Weekday, DayPart } from "@/lib/types";

const NONE = "__none__";
const TOTAL_STEPS = 4;

function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <legend className="flex w-full items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-court text-xs font-semibold text-white">
        {n}
      </span>
      <span className="font-display text-base font-semibold text-ink">{title}</span>
      <span className="ml-auto text-xs text-stone">
        Step {n} of {TOTAL_STEPS}
      </span>
    </legend>
  );
}

export default function BookingForm() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [strings, setStrings] = useState<StringItem[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("byo_string");
  const [stringId, setStringId] = useState("");
  const [gripQty, setGripQty] = useState(1);
  const [racquetLabel, setRacquetLabel] = useState("");
  const [hubId, setHubId] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<Set<Weekday>>(new Set());
  const [times, setTimes] = useState<Set<DayPart>>(new Set());

  // Guided flow: `step` is the furthest-revealed step (1..TOTAL_STEPS).
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const ref2 = useRef<HTMLFieldSetElement>(null);
  const ref3 = useRef<HTMLFieldSetElement>(null);
  const ref4 = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    const svc = new URLSearchParams(window.location.search).get("service");
    if (svc && (SERVICE_TYPES as readonly string[]).includes(svc)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setServiceType(svc as ServiceType);
    }
    const supabase = createClient();
    (async () => {
      const [{ data: h }, { data: s }] = await Promise.all([
        supabase.from("hubs").select("*").eq("active", true).order("sort_order"),
        supabase.from("string_catalog").select("*").eq("active", true).eq("in_stock", true).order("sort_order"),
      ]);
      setHubs((h ?? []).map(rowToHub));
      setStrings((s ?? []).map(rowToString));
    })();
  }, []);

  // When a new step reveals, slide it into view (below the sticky nav).
  useEffect(() => {
    const refs: Record<number, React.RefObject<HTMLFieldSetElement | null>> = { 2: ref2, 3: ref3, 4: ref4 };
    if (step > 1) refs[step]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  function advance(to: number) {
    setError(null);
    setStep((s) => Math.max(s, to));
  }
  function next1() {
    if (!name.trim() || !email.trim()) return setError("Name and email are required.");
    advance(2);
  }
  function next2() {
    if (serviceType === "full_service" && !stringId) return setError("Pick a string for full service.");
    advance(3);
  }
  function next3() {
    if (!hubId) return setError("Pick a meetup spot (or 'none near me').");
    advance(4);
  }

  function toggleDay(w: Weekday) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });
  }
  function toggleTime(t: DayPart) {
    setTimes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) return setError("Name and email are required.");
    if (serviceType === "full_service" && !stringId) return setError("Pick a string for full service.");
    if (!hubId) return setError("Pick a meetup spot (or 'none near me').");
    if (days.size === 0 || times.size === 0)
      return setError("Pick at least one day and one time window.");

    const outOfRange = hubId === NONE;
    const availability: AvailabilityWindow[] = [];
    for (const w of days) for (const t of times) availability.push({ weekday: w, dayPart: t });

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          serviceType,
          stringId: serviceType === "full_service" ? stringId : null,
          gripQty: serviceType === "regrip" ? gripQty : 0,
          racquetLabel,
          notes,
          hubId: outOfRange ? null : hubId,
          outOfRange,
          availability,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit booking.");
      setToken(data.publicToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (token) {
    return (
      <div className="rounded-2xl border border-court bg-court-tint p-6 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-ink">Request received</h2>
        <p className="mt-2 text-stone">
          I&apos;ll review it and email you to confirm and schedule a meetup. Keep this link to track status:
        </p>
        <Link
          href={`/status/${token}`}
          className="mt-4 inline-flex items-center rounded-lg bg-court px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-court-deep"
        >
          View booking status
        </Link>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-stone/70 transition focus:border-court focus:outline-none focus:ring-2 focus:ring-court/30";
  const label = "block text-sm font-medium text-ink";
  const card = "rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-6 scroll-mt-24";
  const continueBtn =
    "mt-5 inline-flex items-center gap-1 rounded-lg bg-court px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-court-deep";

  const selectedHub = hubId && hubId !== NONE ? hubs.find((h) => h.id === hubId) ?? null : null;
  const mapQuery = selectedHub
    ? selectedHub.lat != null && selectedHub.lng != null
      ? `${selectedHub.lat},${selectedHub.lng}`
      : selectedHub.description || selectedHub.name
    : null;

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Step 1 — Your info */}
      <fieldset className={card}>
        <StepHead n={1} title="Your info" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={label}>Name</label>
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className={label}>Email</label>
            <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className={label}>Phone (optional)</label>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className={label}>Racquet (so I can ID it)</label>
            <input
              className={field}
              value={racquetLabel}
              onChange={(e) => setRacquetLabel(e.target.value)}
              placeholder="e.g. Wilson Blade, blue dampener"
            />
          </div>
        </div>
        {step === 1 && (
          <button type="button" onClick={next1} className={continueBtn}>
            Continue →
          </button>
        )}
      </fieldset>

      {/* Step 2 — Service */}
      {step >= 2 && (
        <fieldset ref={ref2} className={`${card} step-in`}>
          <StepHead n={2} title="Service" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {SERVICE_TYPES.map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center rounded-lg border p-3 text-sm transition ${
                  serviceType === t
                    ? "border-court bg-court-tint text-ink"
                    : "border-line bg-paper text-ink hover:border-court/40"
                }`}
              >
                <input
                  type="radio"
                  name="service"
                  className="mr-2 accent-court"
                  checked={serviceType === t}
                  onChange={() => setServiceType(t)}
                />
                <span>
                  {SERVICES[t].label} <span className="text-stone">— {formatCents(SERVICES[t].laborCents)}</span>
                </span>
              </label>
            ))}
          </div>

          {serviceType === "full_service" && (
            <div className="mt-4 space-y-1.5">
              <label className={label}>String</label>
              <select className={field} value={stringId} onChange={(e) => setStringId(e.target.value)}>
                <option value="">Select a string…</option>
                {strings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.color ? `, ${s.color}` : ""} {s.gauge ? `(${s.gauge})` : ""} — {formatCents(s.priceCents)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {serviceType === "regrip" && (
            <div className="mt-4 space-y-1.5">
              <label className={label}>Number of grips</label>
              <input
                className={`${field} max-w-32`}
                type="number"
                min={1}
                value={gripQty}
                onChange={(e) => setGripQty(Math.max(1, Number(e.target.value)))}
              />
            </div>
          )}
          {step === 2 && (
            <button type="button" onClick={next2} className={continueBtn}>
              Continue →
            </button>
          )}
        </fieldset>
      )}

      {/* Step 3 — Meetup spot */}
      {step >= 3 && (
        <fieldset ref={ref3} className={`${card} step-in`}>
          <StepHead n={3} title="Meetup spot" />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_17rem]">
            <div className="space-y-2">
              {hubs.map((h) => (
                <label
                  key={h.id}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition ${
                    hubId === h.id ? "border-court bg-court-tint" : "border-line bg-paper hover:border-court/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="hub"
                    className="mt-0.5 accent-court"
                    checked={hubId === h.id}
                    onChange={() => setHubId(h.id)}
                  />
                  <span>
                    <span className="font-medium text-ink">{h.name}</span>
                    {h.description ? <span className="block text-stone">{h.description}</span> : null}
                  </span>
                </label>
              ))}
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition ${
                  hubId === NONE ? "border-court bg-court-tint" : "border-line bg-paper hover:border-court/40"
                }`}
              >
                <input
                  type="radio"
                  name="hub"
                  className="accent-court"
                  checked={hubId === NONE}
                  onChange={() => setHubId(NONE)}
                />
                <span className="text-ink">None of these are near me</span>
              </label>
            </div>

            <div className="min-h-44 overflow-hidden rounded-lg border border-line bg-sand/40">
              {selectedHub && mapQuery ? (
                <iframe
                  key={mapQuery}
                  title={`Map of ${selectedHub.name}`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full min-h-44 w-full border-0"
                />
              ) : (
                <div className="flex h-full min-h-44 items-center justify-center p-4 text-center text-xs text-stone">
                  {hubId === NONE
                    ? "No problem — I'll reach out to arrange a spot."
                    : "Select a meetup spot to see it on the map."}
                </div>
              )}
            </div>
          </div>
          {step === 3 && (
            <button type="button" onClick={next3} className={continueBtn}>
              Continue →
            </button>
          )}
        </fieldset>
      )}

      {/* Step 4 — When */}
      {step >= 4 && (
        <fieldset ref={ref4} className={`${card} step-in`}>
          <StepHead n={4} title="When are you free?" />
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <span className={label}>Which days work? (pick any)</span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((w) => {
                  const on = days.has(w.value);
                  return (
                    <button
                      type="button"
                      key={w.value}
                      onClick={() => toggleDay(w.value)}
                      aria-pressed={on}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        on ? "border-court bg-court text-white" : "border-line bg-paper text-ink hover:border-court/40"
                      }`}
                    >
                      {w.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className={label}>Which times? (I meet 12–8pm — pick any)</span>
              <div className="flex flex-wrap gap-2">
                {DAY_PARTS.map((t) => {
                  const on = times.has(t.value);
                  return (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => toggleTime(t.value)}
                      aria-pressed={on}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        on ? "border-court bg-court text-white" : "border-line bg-paper text-ink hover:border-court/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={label}>Notes (optional)</label>
              <textarea className={field} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 rounded-lg bg-court px-5 py-2.5 font-medium text-white transition-colors hover:bg-court-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit booking"}
          </button>
        </fieldset>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </form>
  );
}
