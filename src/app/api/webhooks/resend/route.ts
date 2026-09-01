import { NextResponse } from "next/server";
import { supabaseAdmin, recordEvent } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend
 *
 * Closes the loop on deliverability. A reactivation campaign against a
 * three-year-old lead list will hit dead addresses — those must come out of
 * the pool automatically, or sender reputation degrades and the mail that
 * matters stops landing.
 *
 * Configure in Resend → Webhooks, pointing at this URL, and set
 * RESEND_WEBHOOK_SECRET to a random string passed as ?secret= on the URL.
 *
 * Scope note: this handles delivery events, NOT customer replies. Reply
 * capture (flipping a lead to 'responded', which is the metric that actually
 * matters) needs an inbound mail route and is the first thing I would build
 * next. See README → Known limitations.
 */
export async function POST(request: Request) {
  const expected = process.env.RESEND_WEBHOOK_SECRET;
  if (expected) {
    const url = new URL(request.url);
    if (url.searchParams.get("secret") !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: { type?: string; data?: { email_id?: string; to?: string[] } };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = payload.type ?? "";
  const emailId = payload.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ ok: true, ignored: "no email_id" });
  }

  const db = supabaseAdmin();
  const { data: message } = await db
    .from("messages")
    .select("id, lead_id")
    .eq("provider_message_id", emailId)
    .maybeSingle();

  if (!message) {
    return NextResponse.json({ ok: true, ignored: "unknown email_id" });
  }

  if (type === "email.bounced" || type === "email.complained") {
    const reason =
      type === "email.complained"
        ? "Recipient marked the message as spam"
        : "Email hard bounced";

    await db.from("messages").update({ status: "bounced", failure_reason: reason }).eq("id", message.id);
    await db
      .from("leads")
      .update({ status: "suppressed", suppressed_reason: reason })
      .eq("id", message.lead_id);

    await recordEvent({
      leadId: message.lead_id,
      messageId: message.id,
      kind: type,
      detail: reason,
      actor: "resend",
    });

    return NextResponse.json({ ok: true, suppressed: true });
  }

  await recordEvent({
    leadId: message.lead_id,
    messageId: message.id,
    kind: type || "resend_event",
    actor: "resend",
  });

  return NextResponse.json({ ok: true });
}
