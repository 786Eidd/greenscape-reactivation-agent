import { NextResponse } from "next/server";
import { supabaseAdmin, recordEvent } from "@/lib/supabase";
import { generateDraft } from "@/lib/anthropic";
import { validateDraft, assertSendable } from "@/lib/guardrails";
import { notifyDraftReady, notifyFailure } from "@/lib/slack";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/leads/:id/generate
 *
 * Generates one AI draft for one lead and stores it. This endpoint can never
 * send anything — it only ever writes a row with status 'draft' or 'failed'.
 * Sending lives behind a separate endpoint that requires a human action.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const db = supabaseAdmin();

  const { data: lead, error: leadError } = await db
    .from("leads")
    .select("*")
    .eq("id", params.id)
    .single<Lead>();

  if (leadError || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Refuse to spend tokens on someone we could never send to anyway.
  const sendable = assertSendable(lead);
  if (!sendable.ok) {
    return NextResponse.json(
      { error: `Cannot draft for this lead — ${sendable.reason}` },
      { status: 409 }
    );
  }

  let generation;
  try {
    generation = await generateDraft(lead);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Unknown model error";
    await recordEvent({
      leadId: lead.id,
      kind: "generation_error",
      detail: reason,
    });
    await notifyFailure({
      leadName: `${lead.first_name} ${lead.last_name ?? ""}`.trim(),
      stage: "generation",
      reason,
    });
    return NextResponse.json(
      { error: `Model call failed: ${reason}` },
      { status: 502 }
    );
  }

  const validation = validateDraft(generation.raw, lead);

  // A draft that fails validation is still persisted, deliberately. Silently
  // discarding it would hide the failure rate, and the failure rate is exactly
  // what you need to know before pointing this at 1,400 real customers.
  const row = {
    lead_id: lead.id,
    channel: "email" as const,
    subject: validation.ok ? validation.draft.subject : null,
    body: validation.ok ? validation.draft.body : generation.raw.slice(0, 2000),
    status: validation.ok ? ("draft" as const) : ("failed" as const),
    failure_reason: validation.ok ? null : validation.reason,
    model: generation.model,
    input_tokens: generation.inputTokens,
    output_tokens: generation.outputTokens,
    cost_usd: generation.costUsd,
  };

  const { data: message, error: insertError } = await db
    .from("messages")
    .insert(row)
    .select()
    .single();

  if (insertError || !message) {
    return NextResponse.json(
      { error: `Could not save draft: ${insertError?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  if (!validation.ok) {
    await recordEvent({
      leadId: lead.id,
      messageId: message.id,
      kind: "draft_failed_guardrail",
      detail: validation.reason,
    });
    await notifyFailure({
      leadName: `${lead.first_name} ${lead.last_name ?? ""}`.trim(),
      stage: "generation",
      reason: validation.reason,
    });
    return NextResponse.json(
      { ok: false, message, failureReason: validation.reason },
      { status: 422 }
    );
  }

  // Only move the lead forward once a usable draft exists.
  if (lead.status === "dormant") {
    await db.from("leads").update({ status: "drafted" }).eq("id", lead.id);
  }

  await recordEvent({
    leadId: lead.id,
    messageId: message.id,
    kind: "draft_generated",
    detail: `${generation.model} · ${generation.inputTokens}in/${generation.outputTokens}out · $${generation.costUsd.toFixed(5)}`,
  });

  await notifyDraftReady({
    leadId: lead.id,
    leadName: `${lead.first_name} ${lead.last_name ?? ""}`.trim(),
    projectInterest: lead.project_interest,
    estimatedValue: lead.estimated_value,
    subject: validation.draft.subject,
  });

  return NextResponse.json({ ok: true, message });
}
