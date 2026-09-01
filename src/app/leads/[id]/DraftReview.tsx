"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LeadStatus } from "@/lib/types";

interface Draft {
  id: string;
  subject: string;
  body: string;
  model: string | null;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * The human-in-the-loop surface.
 *
 * The reviewer can edit both the subject and the body before approving. An
 * approval flow where the only option is "approve" is theatre — Marcus needs
 * to be able to fix the one sentence that is slightly off and send it, which
 * is what he would do with a real assistant's draft.
 */
export default function DraftReview({
  leadId,
  leadStatus,
  draft,
}: {
  leadId: string;
  leadStatus: LeadStatus;
  draft: Draft | null;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [busy, setBusy] = useState<null | "generate" | "send" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const blocked = leadStatus === "suppressed" || leadStatus === "converted";

  async function call(url: string, payload?: unknown) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || json.failureReason || `Request failed (${res.status})`);
    return json;
  }

  async function onGenerate() {
    setBusy("generate");
    setError(null);
    setNotice(null);
    try {
      const json = await call(`/api/leads/${leadId}/generate`);
      setSubject(json.message?.subject ?? "");
      setBody(json.message?.body ?? "");
      setNotice("Draft generated. Read it before approving.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    if (!draft) return;
    setBusy("send");
    setError(null);
    setNotice(null);
    try {
      const json = await call(`/api/messages/${draft.id}/send`, { subject, body });
      setNotice(
        json.dryRun
          ? "Recorded as sent — RESEND_API_KEY is not set, so no email actually left the system."
          : "Sent."
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(null);
    }
  }

  async function onReject() {
    if (!draft) return;
    setBusy("reject");
    setError(null);
    setNotice(null);
    try {
      await call(`/api/messages/${draft.id}/reject`, { reason: "Rejected by reviewer" });
      setNotice("Draft rejected. Generate a new one when you're ready.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold">
          {draft ? "Draft awaiting your approval" : "No draft yet"}
        </h2>
        <button
          onClick={onGenerate}
          disabled={busy !== null || blocked}
          className="btn-ghost"
        >
          {busy === "generate" ? "Drafting…" : draft ? "Regenerate" : "Generate draft"}
        </button>
      </div>

      {blocked && (
        <p className="mt-3 text-sm text-ink/60">
          This lead is {leadStatus} — drafting and sending are disabled.
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {draft && (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink/45">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-black/15 px-3 py-2 text-sm focus:border-moss focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink/45">
              Body · {body.length} characters
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="mt-1.5 w-full resize-y rounded-md border border-black/15 px-3 py-2 text-sm leading-relaxed focus:border-moss focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink/45">
              {draft.model} · {draft.inputTokens ?? 0} in / {draft.outputTokens ?? 0} out ·{" "}
              {draft.costUsd !== null ? `$${draft.costUsd.toFixed(5)}` : "—"} this draft
            </p>
            <div className="flex gap-2">
              <button onClick={onReject} disabled={busy !== null} className="btn-ghost">
                {busy === "reject" ? "Rejecting…" : "Reject"}
              </button>
              <button onClick={onSend} disabled={busy !== null || blocked} className="btn-primary">
                {busy === "send" ? "Sending…" : "Approve and send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
