import { NextResponse } from "next/server";
import { supabaseAdmin, recordEvent } from "@/lib/supabase";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/messages/:id/reject
 *
 * The other half of human-in-the-loop. An approval flow where the only button
 * is "approve" is not an approval flow. Rejections are kept, with the reason,
 * because the pattern in what Marcus rejects is the prompt's next revision.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const db = supabaseAdmin();

  let reason = "";
  try {
    const payload = await request.json();
    reason = typeof payload?.reason === "string" ? payload.reason.trim() : "";
  } catch {
    // reason is optional
  }

  const { data: message, error } = await db
    .from("messages")
    .select("*")
    .eq("id", params.id)
    .single<Message>();

  if (error || !message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  if (message.status === "sent") {
    return NextResponse.json(
      { error: "This message has already been sent and cannot be rejected." },
      { status: 409 }
    );
  }

  const { data: updated } = await db
    .from("messages")
    .update({
      status: "rejected",
      failure_reason: reason || "Rejected by reviewer",
    })
    .eq("id", message.id)
    .select()
    .single();

  // If nothing else is pending for this lead, hand them back to the queue.
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", message.lead_id)
    .in("status", ["draft", "sent"]);

  if (!count) {
    await db.from("leads").update({ status: "dormant" }).eq("id", message.lead_id);
  }

  await recordEvent({
    leadId: message.lead_id,
    messageId: message.id,
    kind: "draft_rejected",
    detail: reason || null,
    actor: process.env.APPROVER_EMAIL || "reviewer",
  });

  return NextResponse.json({ ok: true, message: updated });
}
