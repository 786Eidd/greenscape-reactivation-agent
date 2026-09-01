import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Uses the service role key, so it must only ever be imported from server
 * components and route handlers — never from a "use client" module. RLS is
 * enabled on every table with no public policies, so the service role is the
 * only way in; a leaked anon key reads nothing.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** Append-only audit trail. Never throws — logging must not break a request. */
export async function recordEvent(input: {
  leadId?: string | null;
  messageId?: string | null;
  kind: string;
  detail?: string | null;
  actor?: string | null;
}): Promise<void> {
  try {
    await supabaseAdmin().from("events").insert({
      lead_id: input.leadId ?? null,
      message_id: input.messageId ?? null,
      kind: input.kind,
      detail: input.detail ?? null,
      actor: input.actor ?? "system",
    });
  } catch (err) {
    console.error("[events] failed to record", input.kind, err);
  }
}
