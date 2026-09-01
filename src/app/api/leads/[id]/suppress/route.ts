import { NextResponse } from "next/server";
import { supabaseAdmin, recordEvent } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * POST /api/leads/:id/suppress
 *
 * Do-not-contact. The single most expensive mistake this agent can make is
 * emailing "are you still thinking about your backyard?" to somebody who
 * became a client eight months ago. Suppression is checked at draft time and
 * again at send time.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const db = supabaseAdmin();

  let reason = "Manually suppressed";
  try {
    const payload = await request.json();
    if (typeof payload?.reason === "string" && payload.reason.trim()) {
      reason = payload.reason.trim();
    }
  } catch {
    // default reason
  }

  const { data, error } = await db
    .from("leads")
    .update({ status: "suppressed", suppressed_reason: reason })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  await recordEvent({
    leadId: params.id,
    kind: "lead_suppressed",
    detail: reason,
    actor: process.env.APPROVER_EMAIL || "reviewer",
  });

  return NextResponse.json({ ok: true, lead: data });
}
