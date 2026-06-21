// Idempotent send: claim a slot in email_log (unique dedup_key) BEFORE sending.
// A duplicate insert hits Postgres 23505 and we skip — so cron re-runs and retried
// transitions never double-send. Mirrors propmanager's cron idempotency pattern.
import { sendEmail } from "./send";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function sendWithDedup(
  supabase: any,
  args: {
    bookingId: string | null;
    kind: string;
    to: string;
    dedupKey: string;
    subject: string;
    html: string;
    text: string;
  }
): Promise<{ id?: string; skipped?: boolean; error?: string }> {
  const { bookingId, kind, to, dedupKey, subject, html, text } = args;

  const { data: row, error: insErr } = await supabase
    .from("email_log")
    .insert({
      booking_id: bookingId,
      kind,
      to_email: to,
      subject,
      body_html: html,
      body_text: text,
      status: "queued",
      dedup_key: dedupKey,
    })
    .select("id")
    .single();

  if (insErr) {
    if (insErr.code === "23505") return { skipped: true }; // already sent
    return { error: insErr.message };
  }

  const sent = await sendEmail({ to, subject, html, text });
  await supabase
    .from("email_log")
    .update({
      resend_message_id: sent.id ?? null,
      status: sent.error ? "failed" : "sent",
    })
    .eq("id", row.id);

  return sent.error ? { error: sent.error } : { id: sent.id };
}
