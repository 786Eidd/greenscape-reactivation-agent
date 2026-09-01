import type { Lead } from "./types";

/**
 * Guardrails on LLM output.
 *
 * The brief asks: "what happens if the model returns garbage?"
 *
 * Answer: it never becomes sendable. Generation and sending are two separate
 * endpoints with a database status between them. Anything that fails a check
 * below is written as status='failed' with the specific reason, is visible in
 * the dashboard, and is rejected by the send route on principle even if
 * someone hand-crafts a request to it.
 *
 * These are deliberately conservative. This agent writes in the founder's
 * voice to real past customers — a bad send costs more than a missed send.
 */

export const MAX_BODY_CHARS = 1500;
export const MIN_BODY_CHARS = 40;
export const MAX_SUBJECT_CHARS = 90;

export interface DraftCandidate {
  subject: string;
  body: string;
}

export type ValidationResult =
  | { ok: true; draft: DraftCandidate }
  | { ok: false; reason: string };

/** Template placeholders the model failed to fill in. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\{\{[^}]*\}\}/,          // {{first_name}}
  /\[insert[^\]]*\]/i,      // [insert project]
  /\[TODO[^\]]*\]/i,        // [TODO]
  /\[your[^\]]*\]/i,        // [your name]
  /\[name\]/i,
  /\bXXXX+\b/,
  /<[a-z_]+>/i,             // <first_name>
];

/**
 * Phrases that break the illusion that Marcus wrote this, or that commit the
 * business to something it has not agreed to. A reactivation email that
 * quotes a price or promises a discount is a legal and margin problem.
 */
const BANNED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bas an ai\b/i,              reason: "Model broke character ('as an AI')" },
  { pattern: /\bi am an ai\b/i,            reason: "Model broke character ('I am an AI')" },
  { pattern: /\blanguage model\b/i,        reason: "Model broke character ('language model')" },
  { pattern: /\bi cannot\b.*\bassist\b/i,  reason: "Model returned a refusal, not a draft" },
  { pattern: /\bhere('s| is) (the|a) (draft|email)\b/i, reason: "Model emitted preamble instead of the email body" },
  { pattern: /\b\d+%\s*(off|discount)\b/i, reason: "Draft promises a discount — pricing is not the agent's to give" },
  { pattern: /\bfree\s+(installation|install|upgrade|design)\b/i, reason: "Draft promises free work" },
  { pattern: /\bguarantee[ds]?\b/i,        reason: "Draft makes a guarantee" },
  // Any dollar sign followed by a digit. Deliberately absolute: the system
  // prompt forbids pricing outright, so a legitimate draft never contains one.
  // Written loosely enough to catch comma-formatted figures like $28,000,
  // which an earlier \d{3,} version let through.
  { pattern: /\$\s*\d/,                    reason: "Draft quotes a dollar figure — pricing requires a real proposal" },
  // The CRM notes themselves contain shorthand like "budget was ~30k" and
  // "came in 12k over". Those must not be echoed back to the customer.
  { pattern: /\b\d{1,3}\s?k\b(?!\w)/i,     reason: "Draft echoes a shorthand budget figure from the CRM notes" },
];

/**
 * Parse the model response. We ask for JSON, but models sometimes wrap it in
 * prose or a fenced code block, so we recover the outermost object before
 * giving up. Recovering is not the same as accepting: the recovered object
 * still has to pass every check below.
 */
export function parseModelJson(raw: string): unknown | null {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through to recovery
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      return null;
    }
  }

  return null;
}

export function validateDraft(raw: string, lead: Lead): ValidationResult {
  const parsed = parseModelJson(raw);

  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, reason: "Model response was not valid JSON" };
  }

  const obj = parsed as Record<string, unknown>;
  const subject = typeof obj.subject === "string" ? obj.subject.trim() : "";
  const body = typeof obj.body === "string" ? obj.body.trim() : "";

  if (!subject) return { ok: false, reason: "Missing subject line" };
  if (!body) return { ok: false, reason: "Missing email body" };

  if (subject.length > MAX_SUBJECT_CHARS) {
    return { ok: false, reason: `Subject is ${subject.length} chars (max ${MAX_SUBJECT_CHARS})` };
  }
  if (body.length < MIN_BODY_CHARS) {
    return { ok: false, reason: `Body is only ${body.length} chars — too short to be a real message` };
  }
  if (body.length > MAX_BODY_CHARS) {
    return { ok: false, reason: `Body is ${body.length} chars (max ${MAX_BODY_CHARS}) — likely malformed or looping` };
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const hit = body.match(pattern) ?? subject.match(pattern);
    if (hit) {
      return { ok: false, reason: `Unfilled template placeholder: ${hit[0]}` };
    }
  }

  for (const { pattern, reason } of BANNED_PATTERNS) {
    if (pattern.test(body) || pattern.test(subject)) {
      return { ok: false, reason };
    }
  }

  // Personalisation is the entire premise of this agent. Marcus's own words on
  // the call: "when it feels like a mass blast, they do not [respond]". A draft
  // that does not use the lead's first name has failed at its one job.
  if (!new RegExp(`\\b${escapeRegex(lead.first_name)}\\b`, "i").test(body)) {
    return { ok: false, reason: `Draft never uses the lead's first name (${lead.first_name})` };
  }

  // Guard against the model hallucinating a different project than the one on
  // file, which is the most damaging plausible-sounding failure mode here.
  const repeated = body.match(/(.{25,})\1/);
  if (repeated) {
    return { ok: false, reason: "Draft contains a repeated block — model looped" };
  }

  return { ok: true, draft: { subject, body } };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checked immediately before handing anything to the email provider. This is
 * the last line of defence and is intentionally redundant with the lead status
 * check in the route: sending is the only irreversible action in the system.
 */
export function assertSendable(lead: Lead): { ok: true } | { ok: false; reason: string } {
  if (lead.status === "suppressed") {
    return { ok: false, reason: `Lead is suppressed: ${lead.suppressed_reason ?? "no reason recorded"}` };
  }
  if (lead.status === "converted") {
    return { ok: false, reason: "Lead has already converted — do not re-engage" };
  }
  if (!lead.email) {
    return { ok: false, reason: "Lead has no email address on file" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) {
    return { ok: false, reason: `Email address does not look valid: ${lead.email}` };
  }
  return { ok: true };
}
