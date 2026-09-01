import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { MODEL } from "@/lib/anthropic";
import { isDryRun } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Reports which integrations are actually wired, so a reviewer cloning this
 * repo can see at a glance what is configured without reading the env file.
 */
export async function GET() {
  let database: "ok" | "unreachable" | "not_configured" = "not_configured";

  try {
    const { error } = await supabaseAdmin()
      .from("leads")
      .select("id", { count: "exact", head: true });
    database = error ? "unreachable" : "ok";
  } catch {
    database = "not_configured";
  }

  return NextResponse.json({
    status: database === "ok" ? "ok" : "degraded",
    database,
    anthropic: process.env.ANTHROPIC_API_KEY ? `configured (${MODEL})` : "missing",
    email: isDryRun() ? "dry-run (no RESEND_API_KEY)" : "configured (resend)",
    slack: process.env.SLACK_WEBHOOK_URL ? "configured" : "not configured",
    timestamp: new Date().toISOString(),
  });
}
