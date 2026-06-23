"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { rowToHub, rowToString } from "@/lib/mappers";
import {
  SERVICES,
  SERVICE_TYPES,
  WEEKDAYS,
  DAY_PARTS,
  formatCents,
  racquetQuoteCents,
  REGRIP_ADDON_CENTS,
} from "@/lib/constants";
import type { Hub, StringItem, StringingService, AvailabilityWindow, Weekday, DayPart } from "@/lib/types";

const NONE = "__none__";
const TOTAL_STEPS = 4;
// Stringing services a racquet can have (regrip is an add-on, not a service).
const STRINGING_SERVICES = SERVICE_TYPES.filter((t) => t !== "regrip") as StringingService[];

type RacquetUI = {
  name: string;
  serviceType: StringingService;
  stringId: string;
  crossesStringId: string;
  regrip: boolean;
};
const emptyRacquet = (): RacquetUI => ({
  name: "",
  serviceType: "full_service",
  stringId: "",
  crossesStringId: "",
  regrip: false,
});

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
  const [racquets, setRacquets] = useState<RacquetUI[]>([emptyRacquet()]);
  const [hubId, setHubId] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<Set<Weekday>>(new Set());
  const [times, setTimes] = useState<Set<DayPart>>(new Set());

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const ref2 = useRef<HTMLFieldSetElement>(null);
  const ref3 = useRef<HTMLFieldSetElement>(null);
  const ref4 = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    const svc = new URLSearchParams(window.location.search).get("service");
    if (svc && svc !== "regrip" && (STRINGING_SERVICES as readonly string[]).includes(svc)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRacquets((rs) => rs.map((r, i) => (i === 0 ? { ...r, serviceType: svc as StringingService } : r)));
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
  function racquetsValid(): string | null {
    for (const r of racquets) {
      if (r.serviceType === "full_service" && !r.stringId) return "Pick a string for each Stringing racquet.";
      if (r.serviceType === "hybrid" && (!r.stringId || !r.crossesStringId))
        return "Pick both strings for each Hybrid racquet.";
    }
    return null;
  }
  function next2() {
    const err = racquetsValid();
    if (err) return setError(err);
    advance(3);
  }
  function next3() {
    if (!hubId) return setError("Pick a meetup spot (or 'none near me').");
    advance(4);
  }

  function updateRacquet(i: number, patch: Partial<RacquetUI>) {
    setRacquets((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRacquet() {
    setRacquets((rs) => [...rs, emptyRacquet()]);
  }
  function removeRacquet(i: number) {
    setRacquets((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));
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
    const rErr = racquetsValid();
    if (rErr) return setError(rErr);
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
          racquets: racquets.map((r) => ({
            name: r.name.trim(),
            serviceType: r.serviceType,
            stringId: r.serviceType === "byo_string" ? null : r.stringId || null,
            crossesStringId: r.serviceType === "hybrid" ? r.crossesStringId || null : null,
            regrip: r.regrip,
          })),
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
  const selectedQuery = selectedHub
    ? selectedHub.lat != null && selectedHub.lng != null
      ? `${selectedHub.lat},${selectedHub.lng}`
      : selectedHub.description || selectedHub.name
    : null;
  const mapQuery = selectedQuery || "San Francisco Bay Area, CA";
  const mapZoom = selectedQuery ? 15 : 9;

  const strLabel = (s: StringItem) =>
    `${s.name}${s.color ? `, ${s.color}` : ""} ${s.gauge ? `(${s.gauge})` : ""} — ${formatCents(s.priceCents)}`;

  const racquetLine = (r: RacquetUI): number => {
    const mains = strings.find((s) => s.id === r.stringId) ?? null;
    const crosses = strings.find((s) => s.id === r.crossesStringId) ?? null;
    return racquetQuoteCents({
      serviceType: r.serviceType,
      stringPriceCents: mains?.priceCents,
      mainsPriceCents: mains?.priceCents,
      crossesPriceCents: crosses?.priceCents,
      regrip: r.regrip,
    });
  };
  const estimate = racquets.reduce((sum, r) => sum + racquetLine(r), 0);

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
          <div className="space-y-1.5 sm:col-span-2">
            <label className={label}>Phone (optional)</label>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        {step === 1 && (
          <button type="button" onClick={next1} className={continueBtn}>
            Continue →
          </button>
        )}
      </fieldset>

      {/* Step 2 — Racquets */}
      {step >= 2 && (
        <fieldset ref={ref2} className={`${card} step-in`}>
          <StepHead n={2} title="Racquets" />

          <div className="mt-4 space-y-4">
            {racquets.map((r, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-line bg-cream/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-ink">Racquet {i + 1}</span>
                  {racquets.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRacquet(i)}
                      className="text-xs text-stone transition-colors hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className={label}>Racquet name</label>
                  <input
                    className={field}
                    value={r.name}
                    onChange={(e) => updateRacquet(i, { name: e.target.value })}
                    placeholder="e.g. Wilson Blade"
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {STRINGING_SERVICES.map((t) => (
                    <label
                      key={t}
                      className={`flex cursor-pointer items-center rounded-lg border p-3 text-sm transition ${
                        r.serviceType === t
                          ? "border-court bg-court-tint text-ink"
                          : "border-line bg-paper text-ink hover:border-court/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`service-${i}`}
                        className="mr-2 accent-court"
                        checked={r.serviceType === t}
                        onChange={() => updateRacquet(i, { serviceType: t })}
                      />
                      <span>
                        {SERVICES[t].label}{" "}
                        <span className="text-stone">— {formatCents(SERVICES[t].laborCents)}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {r.serviceType === "full_service" && (
                  <div className="space-y-1.5">
                    <label className={label}>String</label>
                    <select
                      className={field}
                      value={r.stringId}
                      onChange={(e) => updateRacquet(i, { stringId: e.target.value })}
                    >
                      <option value="">Select a string…</option>
                      {strings.map((s) => (
                        <option key={s.id} value={s.id}>
                          {strLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {r.serviceType === "hybrid" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={label}>Mains string</label>
                      <select
                        className={field}
                        value={r.stringId}
                        onChange={(e) => updateRacquet(i, { stringId: e.target.value })}
                      >
                        <option value="">Select…</option>
                        {strings.map((s) => (
                          <option key={s.id} value={s.id}>
                            {strLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>Crosses string</label>
                      <select
                        className={field}
                        value={r.crossesStringId}
                        onChange={(e) => updateRacquet(i, { crossesStringId: e.target.value })}
                      >
                        <option value="">Select…</option>
                        {strings.map((s) => (
                          <option key={s.id} value={s.id}>
                            {strLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-stone sm:col-span-2">Each string is charged at half its price.</p>
                  </div>
                )}

                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="accent-court"
                    checked={r.regrip}
                    onChange={(e) => updateRacquet(i, { regrip: e.target.checked })}
                  />
                  Add a regrip (+{formatCents(REGRIP_ADDON_CENTS)} · your choice of overgrip)
                </label>

                <div className="text-right text-sm text-stone">
                  Racquet total: <span className="font-medium text-ink">{formatCents(racquetLine(r))}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRacquet}
            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-dashed border-court/50 px-3 py-2 text-sm font-medium text-court transition-colors hover:bg-court-tint/50"
          >
            + Add another racquet
          </button>

          <div className="mt-4 flex items-center justify-between rounded-lg border border-court/30 bg-court-tint/50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">Estimated total</p>
              <p className="text-xs text-stone">
                {racquets.length} racquet{racquets.length === 1 ? "" : "s"} · paid in person
              </p>
            </div>
            <span className="font-display text-xl font-semibold text-ink">{formatCents(estimate)}</span>
          </div>

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
              {hubId === NONE ? (
                <div className="flex h-full min-h-44 items-center justify-center p-4 text-center text-xs text-stone">
                  No problem — I&apos;ll reach out to arrange a spot.
                </div>
              ) : (
                <iframe
                  key={`${mapQuery}-${mapZoom}`}
                  title={selectedHub ? `Map of ${selectedHub.name}` : "Service area map"}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=${mapZoom}&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-full min-h-44 w-full border-0"
                />
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
            {submitting ? "Submitting…" : `Submit booking · ${formatCents(estimate)}`}
          </button>
        </fieldset>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </form>
  );
}
