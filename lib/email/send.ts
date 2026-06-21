// Single Resend send wrapper used by every outbound email (customer status
// updates + owner trip digest) so they share identical From / headers.
// Ported from propmanager's lib/email/send.js.
import { Resend } from "resend";

// Lazy so importing this module never throws when RESEND_API_KEY is unset
// (e.g. during build-time page-data collection).
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_NAME = process.env.RESEND_FROM_NAME || "Stringing";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Record<string, string>;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  tags,
}: SendEmailOpts): Promise<{ id?: string; error?: string }> {
  if (!to || !subject) return { error: "missing to/subject" };

  const resend = getResend();
  if (!resend) return { error: "RESEND_API_KEY not configured" };

  const payload: Parameters<typeof resend.emails.send>[0] = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text: text || undefined,
  };
  if (tags) {
    payload.tags = Object.entries(tags).map(([name, value]) => ({
      name,
      value: String(value),
    }));
  }

  try {
    const { data, error } = await resend.emails.send(payload);
    if (error) return { error: error.message || String(error) };
    return { id: data?.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
