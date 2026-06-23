// Pure email template functions — one per EmailKind. Each returns
// { subject, html, text }. No sending here (lib/email/send.ts does that) and no
// DB access. Callers pass the data each template needs.
import type { Booking, Hub, TripBatch } from "@/lib/types";
import { formatCents, SERVICES, DAY_PARTS, STATUS_LABELS } from "@/lib/constants";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const statusUrl = (token: string) => `${SITE}/status/${token}`;
const adminBatchUrl = (id: string) => `${SITE}/admin/batches/${id}`;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtDayPart(dp: string | null): string {
  return DAY_PARTS.find((x) => x.value === dp)?.label ?? "";
}

function serviceLabel(t: Booking["serviceType"]): string {
  return SERVICES[t].label;
}

function layout(title: string, bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;line-height:1.5">
  <h2 style="margin:0 0 16px;font-size:20px">${esc(title)}</h2>
  ${bodyHtml}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#999;font-size:12px;margin:0">Local racquet stringing</p>
</div>`;
}

function btn(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${esc(href)}" style="background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;display:inline-block">${esc(label)}</a></p>`;
}

function textBody(lines: string[]): string {
  return `${lines.join("\n")}\n\n— Local racquet stringing`;
}

type Tpl = { subject: string; html: string; text: string };

// --- Customer emails ---------------------------------------------------

export function bookingConfirmed({ booking, hub }: { booking: Booking; hub: Hub | null }): Tpl {
  const subject = "Booking confirmed — racquet stringing";
  const where = hub ? `meetup hub: ${hub.name}` : "your preferred meetup";
  const html = layout(
    "You're booked in",
    `<p>Hi ${esc(booking.customerName)},</p>
     <p>Got your request for <strong>${esc(serviceLabel(booking.serviceType))}</strong>. ${esc(where ? `Your ${where}.` : "")}</p>
     <p>I'll group you into the next trip to your hub and email you the meetup date and time. Track your booking anytime:</p>
     ${btn(statusUrl(booking.publicToken), "View booking status")}`
  );
  const text = textBody([
    `Hi ${booking.customerName},`,
    `Got your request for ${serviceLabel(booking.serviceType)}. ${where ? `Your ${where}.` : ""}`,
    `I'll group you into the next trip and email you the meetup details.`,
    `Status: ${statusUrl(booking.publicToken)}`,
  ]);
  return { subject, html, text };
}

export function bookingDeclined({ booking }: { booking: Booking }): Tpl {
  const subject = "About your stringing request";
  const html = layout(
    "Sorry — can't take this one",
    `<p>Hi ${esc(booking.customerName)},</p>
     <p>Unfortunately I can't take this request right now (it may be outside my meetup range). Feel free to reach out directly to sort something out.</p>`
  );
  const text = textBody([
    `Hi ${booking.customerName},`,
    `Unfortunately I can't take this request right now (it may be outside my meetup range). Reach out directly and we'll sort something out.`,
  ]);
  return { subject, html, text };
}

export function scheduledDropoff({
  booking,
  hub,
  batch,
}: {
  booking: Booking;
  hub: Hub | null;
  batch: TripBatch;
}): Tpl {
  const when = `${fmtDate(batch.tripDate)}${batch.dayPart ? ` (${fmtDayPart(batch.dayPart)})` : ""}`;
  const subject = `Drop-off scheduled — ${when}`;
  const html = layout(
    "Time to hand off your racquet",
    `<p>Hi ${esc(booking.customerName)},</p>
     <p>Meet me at <strong>${esc(hub?.name ?? "the meetup hub")}</strong> on <strong>${esc(when)}</strong> to hand off your racquet.</p>
     ${hub?.description ? `<p style="color:#555">${esc(hub.description)}</p>` : ""}
     ${btn(statusUrl(booking.publicToken), "View booking status")}`
  );
  const text = textBody([
    `Hi ${booking.customerName},`,
    `Meet me at ${hub?.name ?? "the meetup hub"} on ${when} to hand off your racquet.`,
    hub?.description ? hub.description : "",
    `Status: ${statusUrl(booking.publicToken)}`,
  ]);
  return { subject, html, text };
}

export function readyAndScheduled({
  booking,
  hub,
  batch,
  amountDueCents,
}: {
  booking: Booking;
  hub: Hub | null;
  batch: TripBatch;
  amountDueCents: number | null;
}): Tpl {
  const when = `${fmtDate(batch.tripDate)}${batch.dayPart ? ` (${fmtDayPart(batch.dayPart)})` : ""}`;
  const subject = `Strung & ready — pickup ${when}`;
  const due = amountDueCents != null ? formatCents(amountDueCents) : null;
  const html = layout(
    "Your racquet is strung",
    `<p>Hi ${esc(booking.customerName)},</p>
     <p>All done. Meet me at <strong>${esc(hub?.name ?? "the meetup hub")}</strong> on <strong>${esc(when)}</strong> to pick it up.</p>
     ${due ? `<p>Please bring <strong>${esc(due)}</strong> — cash, Venmo, or Zelle.</p>` : ""}
     ${hub?.description ? `<p style="color:#555">${esc(hub.description)}</p>` : ""}
     ${btn(statusUrl(booking.publicToken), "View booking status")}`
  );
  const text = textBody([
    `Hi ${booking.customerName},`,
    `All done. Meet me at ${hub?.name ?? "the meetup hub"} on ${when} to pick it up.`,
    due ? `Please bring ${due} — cash, Venmo, or Zelle.` : "",
    `Status: ${statusUrl(booking.publicToken)}`,
  ]);
  return { subject, html, text };
}

export function completed({ booking }: { booking: Booking }): Tpl {
  const subject = "Thanks — all set";
  const amt = booking.priceQuoteCents != null ? formatCents(booking.priceQuoteCents) : null;
  const html = layout(
    "Thanks for stringing with me",
    `<p>Hi ${esc(booking.customerName)},</p>
     <p>Hope the new strings feel great. Here's your receipt:</p>
     <ul>
       <li>Service: ${esc(serviceLabel(booking.serviceType))}</li>
       ${amt ? `<li>Total: ${esc(amt)}</li>` : ""}
     </ul>
     <p>See you next restring.</p>`
  );
  const text = textBody([
    `Hi ${booking.customerName},`,
    `Hope the new strings feel great. Receipt:`,
    `Service: ${serviceLabel(booking.serviceType)}`,
    amt ? `Total: ${amt}` : "",
    `See you next restring.`,
  ]);
  return { subject, html, text };
}

export function bookingCancelled({ booking }: { booking: Booking }): Tpl {
  const subject = "Your booking was cancelled";
  const html = layout(
    "Booking cancelled",
    `<p>Hi ${esc(booking.customerName)},</p>
     <p>Your stringing booking has been cancelled. If this is a mistake, just book again or reach out.</p>`
  );
  const text = textBody([
    `Hi ${booking.customerName},`,
    `Your stringing booking has been cancelled. If this is a mistake, book again or reach out.`,
  ]);
  return { subject, html, text };
}

// --- Owner trip digest -------------------------------------------------

export interface OwnerDigestRow {
  customerName: string;
  racquetLabel: string | null;
  serviceType: Booking["serviceType"];
  stringName: string | null;
  gripQty: number;
  customerPhone: string | null;
  amountDueCents: number | null;
  otherAvailability: string;
}

export function ownerDigest({
  batch,
  hub,
  rows,
}: {
  batch: TripBatch;
  hub: Hub | null;
  rows: OwnerDigestRow[];
}): Tpl {
  const phaseWord = batch.phase === "dropoff" ? "Collect" : "Return";
  const when = `${fmtDate(batch.tripDate)}${batch.dayPart ? ` (${fmtDayPart(batch.dayPart)})` : ""}`;
  const subject = `Trip plan — ${phaseWord} ${rows.length} at ${hub?.name ?? "hub"}, ${when}`;

  const totalDue =
    batch.phase === "pickup"
      ? rows.reduce((sum, r) => sum + (r.amountDueCents ?? 0), 0)
      : null;

  const rowHtml = rows
    .map((r, i) => {
      const parts = [
        `<strong>${esc(r.customerName)}</strong>`,
        esc(r.racquetLabel || "racquet"),
        esc(serviceLabel(r.serviceType)),
        r.stringName ? esc(r.stringName) : "",
        r.gripQty ? `grip ×${r.gripQty}` : "",
        r.customerPhone ? esc(r.customerPhone) : "",
        batch.phase === "pickup" && r.amountDueCents != null
          ? `collect ${esc(formatCents(r.amountDueCents))}`
          : "",
      ].filter(Boolean);
      return `<li style="margin:6px 0">${i + 1}. ${parts.join(" · ")}${
        r.otherAvailability ? `<br/><span style="color:#888;font-size:12px">also free: ${esc(r.otherAvailability)}</span>` : ""
      }</li>`;
    })
    .join("");

  const html = layout(
    `${phaseWord} ${rows.length} racquet${rows.length === 1 ? "" : "s"}`,
    `<p><strong>${esc(hub?.name ?? "Hub")}</strong>${hub?.description ? ` — ${esc(hub.description)}` : ""}</p>
     <p>Proposed: <strong>${esc(when)}</strong></p>
     <ol style="padding-left:18px;list-style:none">${rowHtml}</ol>
     ${totalDue != null ? `<p>Total to collect: <strong>${esc(formatCents(totalDue))}</strong></p>` : ""}
     ${btn(adminBatchUrl(batch.id), "Confirm / reschedule trip")}`
  );

  const textRows = rows.map((r, i) => {
    const parts = [
      r.customerName,
      r.racquetLabel || "racquet",
      serviceLabel(r.serviceType),
      r.stringName || "",
      r.gripQty ? `grip x${r.gripQty}` : "",
      r.customerPhone || "",
      batch.phase === "pickup" && r.amountDueCents != null ? `collect ${formatCents(r.amountDueCents)}` : "",
    ].filter(Boolean);
    return `${i + 1}. ${parts.join(" | ")}`;
  });
  const text = textBody([
    `${phaseWord} ${rows.length} racquet(s) at ${hub?.name ?? "hub"}`,
    `Proposed: ${when}`,
    ...textRows,
    totalDue != null ? `Total to collect: ${formatCents(totalDue)}` : "",
    `Manage: ${adminBatchUrl(batch.id)}`,
  ]);

  return { subject, html, text };
}

// --- Owner: new booking notification ----------------------------------
export interface NewBookingOwnerRacquet {
  name: string;
  serviceLabel: string;
  strings: string; // "" for BYO, or "Tour Bite", or "X (mains) / Y (crosses)"
  regrip: boolean;
  priceCents: number;
}
export interface NewBookingOwnerData {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  hubName: string;
  totalCents: number;
  daysText: string;
  timesText: string;
  notes: string | null;
  racquets: NewBookingOwnerRacquet[];
}

function racquetLineText(r: NewBookingOwnerRacquet): string {
  const bits = [r.serviceLabel, r.strings, r.regrip ? "+ regrip" : ""].filter(Boolean);
  return `${r.name}: ${bits.join(" · ")} — ${formatCents(r.priceCents)}`;
}

export function newBookingOwner(o: NewBookingOwnerData): Tpl {
  const adminUrl = `${SITE}/admin/bookings/${o.bookingId}`;
  const n = o.racquets.length;
  const subject = `New booking — ${o.customerName} (${n} racquet${n === 1 ? "" : "s"})`;

  const racquetHtml = o.racquets
    .map((r) => `<li style="margin:4px 0">${esc(racquetLineText(r))}</li>`)
    .join("");

  const rows: [string, string][] = [
    ["Customer", `${o.customerName} · ${o.customerEmail}${o.customerPhone ? ` · ${o.customerPhone}` : ""}`],
    ["Meetup", o.hubName],
    ["Days", o.daysText || "—"],
    ["Times", o.timesText || "—"],
    ["Total", formatCents(o.totalCents)],
  ];
  if (o.notes) rows.push(["Notes", o.notes]);
  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#888;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`
    )
    .join("");

  const html = layout(
    "New booking request",
    `<p>A new booking just came in — review and accept it to start scheduling.</p>
     <p style="margin:12px 0 4px;font-weight:600">Racquets</p>
     <ul style="margin:0 0 12px;padding-left:18px;font-size:14px">${racquetHtml}</ul>
     <table style="border-collapse:collapse;font-size:14px">${rowHtml}</table>
     ${btn(adminUrl, "Review & accept")}`
  );
  const text = textBody([
    "New booking request:",
    ...o.racquets.map(racquetLineText),
    ...rows.map(([k, v]) => `${k}: ${v}`),
    `Review & accept: ${adminUrl}`,
  ]);
  return { subject, html, text };
}

// Re-export for callers that map a status to a label in emails.
export { STATUS_LABELS };
