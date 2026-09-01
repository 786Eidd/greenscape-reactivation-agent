import { Resend } from "resend";

/**
 * Resend, not Twilio.
 *
 * The brief requires at least one external integration that touches the
 * outside world. SMS would be closer to how Greenscape actually reaches
 * people through GHL, but Twilio needs a provisioned number and A2P 10DLC
 * registration, which takes days and cannot be demoed inside 24 hours.
 * Resend needs one verified domain. The send interface below is deliberately
 * channel-shaped so swapping in GHL's SMS endpoint is a one-file change.
 *
 * DRY RUN: if RESEND_API_KEY is unset the app still works end-to-end — the
 * message is recorded as sent with a synthetic provider id. This keeps the
 * repo clonable and reviewable without handing out credentials.
 */

export interface SendResult {
  ok: boolean;
  providerMessageId?: string;
  dryRun: boolean;
  error?: string;
}

export function isDryRun(): boolean {
  return !process.env.RESEND_API_KEY;
}

export async function sendReactivationEmail(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  if (isDryRun()) {
    console.info(`[email] DRY RUN — would send to ${args.to}: ${args.subject}`);
    return { ok: true, dryRun: true, providerMessageId: `dryrun_${Date.now()}` };
  }

  const from = process.env.RESEND_FROM;
  if (!from) {
    return { ok: false, dryRun: false, error: "RESEND_FROM is not set" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from,
      to: [args.to],
      subject: args.subject,
      replyTo: process.env.RESEND_REPLY_TO || undefined,
      text: args.body,
      html: toHtml(args.body),
    });

    if (error) {
      return { ok: false, dryRun: false, error: error.message };
    }
    return { ok: true, dryRun: false, providerMessageId: data?.id };
  } catch (err) {
    return {
      ok: false,
      dryRun: false,
      error: err instanceof Error ? err.message : "Unknown send error",
    };
  }
}

/**
 * Plain paragraphs only. A reactivation email that is supposed to read as if
 * Marcus typed it must not arrive looking like a marketing template.
 */
function toHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`)
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px;">${paragraphs}</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
