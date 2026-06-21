"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { rowToHub, rowToString } from "@/lib/mappers";
import { SERVICES, SERVICE_TYPES, WEEKDAYS, DAY_PARTS, formatCents } from "@/lib/constants";
import type { Hub, StringItem, ServiceType, AvailabilityWindow, Weekday, DayPart } from "@/lib/types";

const NONE = "__none__";

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
  const [slots, setSlots] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
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

  const slotKey = (w: Weekday, d: DayPart) => `${w}|${d}`;
  function toggleSlot(w: Weekday, d: DayPart) {
    const k = slotKey(w, d);
    setSlots((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) return setError("Name and email are required.");
    if (serviceType === "full_service" && !stringId) return setError("Pick a string for full service.");
    if (!hubId) return setError("Pick a meetup spot (or 'none near me').");
    if (slots.size === 0) return setError("Pick at least one availability window.");

    const outOfRange = hubId === NONE;
    const availability: AvailabilityWindow[] = [...slots].map((k) => {
      const [w, d] = k.split("|");
      return { weekday: Number(w) as Weekday, dayPart: d as DayPart };
    });

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
  const sectionHeading = "font-display text-base font-semibold text-ink";
  const card = "rounded-2xl border border-line bg-paper p-5 shadow-sm sm:p-6";

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Your info */}
      <fieldset className={card}>
        <legend className={sectionHeading}>Your info</legend>
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
      </fieldset>

      {/* Service */}
      <fieldset className={card}>
        <legend className={sectionHeading}>Service</legend>
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
      </fieldset>

      {/* Where & when */}
      <fieldset className={card}>
        <legend className={sectionHeading}>Where &amp; when</legend>

        <div className="mt-4 space-y-2">
          <span className={label}>Meetup spot (closest to you)</span>
          <div className="space-y-2">
            {hubs.map((h) => (
              <label
                key={h.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition ${
                  hubId === h.id
                    ? "border-court bg-court-tint"
                    : "border-line bg-paper hover:border-court/40"
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
                hubId === NONE
                  ? "border-court bg-court-tint"
                  : "border-line bg-paper hover:border-court/40"
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
        </div>

        <div className="mt-5 space-y-2">
          <span className={label}>When are you free to meet?</span>
          <div className="overflow-x-auto rounded-lg border border-line bg-sand/40 p-2">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="p-1.5" />
                  {DAY_PARTS.map((d) => (
                    <th key={d.value} className="p-1.5 font-medium text-stone">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAYS.map((w) => (
                  <tr key={w.value}>
                    <td className="p-1.5 pr-3 font-medium text-stone">{w.short}</td>
                    {DAY_PARTS.map((d) => (
                      <td key={d.value} className="p-1.5 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-court"
                          checked={slots.has(slotKey(w.value, d.value))}
                          onChange={() => toggleSlot(w.value, d.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 space-y-1.5">
          <label className={label}>Notes (optional)</label>
          <textarea className={field} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-court px-5 py-2.5 font-medium text-white transition-colors hover:bg-court-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit booking"}
      </button>
    </form>
  );
}
