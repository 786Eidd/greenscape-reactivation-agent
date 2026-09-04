import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { money, shortDate, monthsAgo, LEAD_STATUS_STYLE, MESSAGE_STATUS_STYLE } from "@/lib/format";
import { LOST_REASON_LABEL, type Lead, type Message, type EventRow } from "@/lib/types";
import DraftReview from "./DraftReview";

export const dynamic = "force-dynamic";

export default async function LeadPage({ params }: { params: { id: string } }) {
  let lead: Lead | null = null;
  let messages: Message[] = [];
  let events: EventRow[] = [];
  let loadError: string | null = null;

  try {
    const db = supabaseAdmin();

    // maybeSingle, not single: "no row" is a normal outcome here and should
    // render a readable message, not surface as an opaque query error.
    const { data, error } = await db
      .from("leads")
      .select("*")
      .eq("id", params.id)
      .maybeSingle<Lead>();
    if (error) throw new Error(`${error.code ?? "db"}: ${error.message}`);
    lead = data;


    if (lead) {
      const { data: messageRows, error: mErr } = await db
        .from("messages")
        .select("*")
        .eq("lead_id", params.id)
        .order("created_at", { ascending: false });
      if (mErr) throw new Error(`messages ${mErr.code ?? ""}: ${mErr.message}`);

      const { data: eventRows, error: eErr } = await db
        .from("events")
        .select("*")
        .eq("lead_id", params.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (eErr) throw new Error(`events ${eErr.code ?? ""}: ${eErr.message}`);

      messages = (messageRows ?? []) as Message[];
      events = (eventRows ?? []) as EventRow[];
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown database error";
  }

  if (loadError || !lead) {
    return (
      <div className="card p-6">
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">
          &larr; Back to queue
        </Link>
        <h1 className="mt-3 text-lg font-semibold">
          {loadError ? "Could not load this lead" : "Lead not found"}
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          {loadError ?? "No lead with this id exists in the connected database."}
        </p>
        <p className="mt-3 text-xs text-ink/45">
          Requested id: <code className="rounded bg-black/5 px-1">{params.id}</code>
        </p>
      </div>
    );
  }

  const pendingDraft = messages.find((m) => m.status === "draft") ?? null;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-ink/50 hover:text-ink">
        ← Back to queue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {lead.project_interest} · {money(lead.estimated_value)} · {lead.city}
          </p>
        </div>
        <span className={`badge ${LEAD_STATUS_STYLE[lead.status]}`}>{lead.status}</span>
      </div>

      {lead.status === "suppressed" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Do not contact.</strong> {lead.suppressed_reason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <DraftReview
            leadId={lead.id}
            leadStatus={lead.status}
            draft={
              pendingDraft
                ? {
                    id: pendingDraft.id,
                    subject: pendingDraft.subject ?? "",
                    body: pendingDraft.body ?? "",
                    model: pendingDraft.model,
                    costUsd: pendingDraft.cost_usd,
                    inputTokens: pendingDraft.input_tokens,
                    outputTokens: pendingDraft.output_tokens,
                  }
                : null
            }
          />

          {messages.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold">Message history</h2>
              <ul className="mt-4 space-y-4">
                {messages.map((m) => (
                  <li key={m.id} className="border-l-2 border-black/10 pl-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`badge ${MESSAGE_STATUS_STYLE[m.status]}`}>{m.status}</span>
                      <span className="text-ink/45">{shortDate(m.created_at)}</span>
                      {m.edited_by_human && (
                        <span className="text-ink/45">· edited before sending</span>
                      )}
                      {m.approved_by && <span className="text-ink/45">· approved by {m.approved_by}</span>}
                    </div>
                    {m.subject && <div className="mt-1.5 text-sm font-medium">{m.subject}</div>}
                    {m.failure_reason && (
                      <div className="mt-1.5 rounded bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
                        {m.failure_reason}
                      </div>
                    )}
                    {m.body && (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink/70">{m.body}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Lead file</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Email" value={lead.email ?? "—"} />
              <Row label="Phone" value={lead.phone ?? "—"} />
              <Row label="GHL ID" value={lead.ghl_contact_id ?? "—"} />
              <Row
                label="Lost because"
                value={lead.lost_reason ? LOST_REASON_LABEL[lead.lost_reason] : "—"}
              />
              <Row label="Last contact" value={`${shortDate(lead.last_contact_at)} (${monthsAgo(lead.last_contact_at)})`} />
            </dl>
            {lead.notes && (
              <>
                <div className="mt-4 text-xs uppercase tracking-wide text-ink/45">CRM notes</div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink/70">{lead.notes}</p>
              </>
            )}
          </section>

          {events.length > 0 && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold">Audit trail</h2>
              <ul className="mt-3 space-y-2 text-xs">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="shrink-0 text-ink/40">{shortDate(e.created_at)}</span>
                    <span className="text-ink/70">
                      <span className="font-medium">{e.kind}</span>
                      {e.detail ? ` — ${e.detail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-ink/45">{label}</dt>
      <dd className="text-right text-ink/80 break-all">{value}</dd>
    </div>
  );
}
