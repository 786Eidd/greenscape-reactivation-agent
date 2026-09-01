import { NextResponse } from "next/server";
import { supabaseAdmin, recordEvent } from "@/lib/supabase";
import { sendReactivationEmail, isDryRun } from "@/lib/email";
import { assertSendable, MAX_BODY_CHARS, MIN_BODY_CHARS } from "@/lib/guardrails";
import { notifySent, notifyFailure } from "@/lib/slack";
import type { Lead, Message } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/messages/:id/send
 *
 * The ONLY path in the system that can put an email in front of a customer.
 * It requires an explicit human action in the dashboard, and re-checks
 * everything the generate route already checked. That redundancy is
 * intentional: this is the one irreversible operation here.
 *
 * Body: { subject?, body?, approvedBy? }
 * Subject and body may be edited by the reviewer before approval — a human who
 * can only rubber-stamp is not really in the loop.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const db = supabaseAdmin();

  let payload: { subject?: string; body?: string; approvedBy?: string } = {};
  try {
    payload = await request.json();
  } catch {
    // An empty body is fine — approve the draft exactly as generated.
  }

  const { data: message, error: messageError } = await db
    .from("messages")
    .select("*")
    .eq("id", params.id)
    .single<Message>();

  if (messageError || !message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  // Guardrail: only a draft can be sent. Not a failed one, not one already
  // sent, not one a human rejected.
  if (message.status !== "draft") {
    return NextResponse.json(
      { error: `Message is '${message.status}' and cannot be sent. Only drafts are sendable.` },
      { status: 409 }
    );
  }

  const { data: lead, error: leadError } = await db
    .from("leads")
    .select("*")
    .eq("id", message.lead_id)
    .single<Lead>();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const sendable = assertSendable(lead);
  if (!sendable.ok) {
    return NextResponse.json({ error: sendable.reason }, { status: 409 });
  }

  const subject = (payload.subject ?? message.subject ?? "").trim();
  const body = (payload.body ?? message.body ?? "").trim();
  const edited =
    subject !== (message.subject ?? "").trim() || body !== (message.body ?? "").trim();

  // A human can edit, but not into something obviously broken.
  if (!subject) {
    return NextResponse.json({ error: "Subject cannot be empty" }, { status: 400 });
  }
  if (body.length < MIN_BODY_CHARS || body.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { error: `Body must be between ${MIN_BODY_CHARS} and ${MAX_BODY_CHARS} characters` },
      { status: 400 }
    );
  }

  const approvedBy = payload.approvedBy || process.env.APPROVER_EMAIL || "unknown";
  const leadName = `${lead.first_name} ${lead.last_name ?? ""}`.trim();

  const result = await sendReactivationEmail({
    to: lead.email as string,
    subject,
    body,
  });

  if (!result.ok) {
    await db
      .from("messages")
      .update({ status: "failed", failure_reason: `Send failed: ${result.error}` })
      .eq("id", message.id);

    await recordEvent({
      leadId: lead.id,
      messageId: message.id,
      kind: "send_failed",
      detail: result.error ?? "unknown",
      actor: approvedBy,
    });
    await notifyFailure({ leadName, stage: "send", reason: result.error ?? "unknown" });

    return NextResponse.json({ error: `Send failed: ${result.error}` }, { status: 502 });
  }

  const sentAt = new Date().toISOString();

  const { data: updated } = await db
    .from("messages")
    .update({
      subject,
      body,
      edited_by_human: edited,
      status: "sent",
      approved_by: approvedBy,
      sent_at: sentAt,
      provider_message_id: result.providerMessageId ?? null,
    })
    .eq("id", message.id)
    .select()
    .single();

  await db
    .from("leads")
    .update({ status: "contacted", last_contact_at: sentAt })
    .eq("id", lead.id);

  await recordEvent({
    leadId: lead.id,
    messageId: message.id,
    kind: result.dryRun ? "sent_dry_run" : "sent",
    detail: `to ${lead.email}${edited ? " (edited by reviewer)" : ""}`,
    actor: approvedBy,
  });

  await notifySent({ leadName, email: lead.email as string, approvedBy });

  return NextResponse.json({
    ok: true,
    dryRun: result.dryRun,
    message: updated,
    note: isDryRun()
      ? "RESEND_API_KEY is not set — recorded as sent, but no email actually left the system."
      : undefined,
  });
}
