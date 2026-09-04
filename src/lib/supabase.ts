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

  // Read SUPABASE_URL first. This value is only ever used on the server, so it
  // must NOT depend on a NEXT_PUBLIC_ variable: those are inlined at build time,
  // and a host that withholds build-time access to secrets (Vercel's "Sensitive"
  // flag, for one) compiles them to undefined. NEXT_PUBLIC_SUPABASE_URL is kept
  // as a fallback so existing local .env files keep working.
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) {
    const missing = [
      !url ? "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)" : null,
      !key ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ].filter(Boolean).join(" and ");
    throw new Error(`Supabase is not configured — missing ${missing}.`);
  }

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    throw new Error(
      `SUPABASE_URL does not look like a project URL: "${url}". ` +
      "It must be https://<project-ref>.supabase.co with no trailing slash or path."
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      // Next.js patches global fetch and caches GET responses by default.
      // supabase-js talks to PostgREST over fetch, so without this every query
      // can be served from Next's cache instead of the database - which shows
      // up as stale rows, and as "not found" for records that plainly exist.
      // `export const dynamic = "force-dynamic"` governs rendering, not fetch,
      // so it does not cover this. This is an operations dashboard: every read
      // must be live.
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
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
