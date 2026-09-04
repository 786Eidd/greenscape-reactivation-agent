import Anthropic from "@anthropic-ai/sdk";
import type { Lead } from "./types";
import { LOST_REASON_LABEL } from "./types";
import { MAX_BODY_CHARS } from "./guardrails";

/**
 * Drafting layer.
 *
 * Deliberately provider-agnostic. The prompt, the guardrails and the cost
 * accounting are identical whichever model runs; only the transport differs.
 * That matters because the expensive, opinionated part of this agent is the
 * system prompt and the validation around it, not the vendor.
 *
 * MODEL CHOICE: a small, fast tier (Claude Haiku / Gemini Flash), not a
 * frontier model. This is short, tightly-constrained drafting with a human
 * reading every output before it goes anywhere. The reasoning depth of a
 * larger model buys nothing here, and across a 1,400-lead backlog the tier
 * choice is the entire cost story.
 *
 * Set AI_PROVIDER=anthropic or AI_PROVIDER=gemini. If unset, whichever API
 * key is present wins, preferring Anthropic.
 */

export type Provider = "anthropic" | "gemini";

export const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export function activeProvider(): Provider {
  const p = (process.env.AI_PROVIDER || "").toLowerCase().trim();
  if (p === "gemini" || p === "google") return "gemini";
  if (p === "anthropic" || p === "claude") return "anthropic";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "anthropic";
}

export function activeModel(): string {
  return activeProvider() === "gemini" ? GEMINI_MODEL : ANTHROPIC_MODEL;
}

export function isConfigured(): boolean {
  return activeProvider() === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Kept for compatibility with existing imports. */
export const MODEL = activeModel();

function rates(): { input: number; output: number } {
  if (activeProvider() === "gemini") {
    return {
      input: Number(process.env.GEMINI_INPUT_COST_PER_MTOK || "0"),
      output: Number(process.env.GEMINI_OUTPUT_COST_PER_MTOK || "0"),
    };
  }
  return {
    input: Number(process.env.ANTHROPIC_INPUT_COST_PER_MTOK || "0.80"),
    output: Number(process.env.ANTHROPIC_OUTPUT_COST_PER_MTOK || "4.00"),
  };
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  const r = rates();
  return (inputTokens / 1_000_000) * r.input + (outputTokens / 1_000_000) * r.output;
}

const SYSTEM_PROMPT = `You write short re-engagement emails as Marcus Tate, founder of Greenscape Pro, a high-end residential hardscape and landscape design-build company in Phoenix, Arizona.

These go to people who asked Greenscape Pro for a quote months or years ago and never signed. Marcus is personally reaching back out. He is not running a campaign.

VOICE
- Write the way a busy owner-operator actually types: plain, warm, direct, a little informal. Contractions. Short paragraphs.
- Reference one concrete, specific detail from the lead's file so it is obvious this is not a blast. That specificity is the entire point.
- No marketing language. Never use: "circling back", "touching base", "just checking in", "reaching out", "exciting news", "we'd love to", "at your convenience", "hope this email finds you well".
- No exclamation marks. No emoji. No bullet points. No headers.

CONTENT RULES - these are hard constraints
- Never state, quote, estimate, or imply a price. Never offer a discount, a promotion, or free work. Pricing requires a real proposal from a real site walk.
- Never claim work was completed for them, never invent shared history beyond what the file says, never invent names of people.
- Never mention a spouse, partner, or family member, even if the internal notes do. Never mention the HOA by name.
- Never promise a timeline or availability.
- One clear, low-friction ask: are they still thinking about the project. Make it easy to reply with one line. Do not push a phone call.
- 90 to 160 words in the body. Sign off as Marcus.
- Acknowledge the gap in time honestly rather than pretending no time has passed.

If the lead's file says they went with a competitor, do not mention the competitor and do not sound wounded. If it says price, do not re-litigate price. If it says timing, lead with the timing.

OUTPUT FORMAT
Return a single raw JSON object and nothing else. No prose, no markdown fence.
{"subject": "...", "body": "..."}
The subject is lowercase-casual, under 60 characters, and reads like a personal email, not a campaign. The body uses \\n\\n between paragraphs and must be under ${MAX_BODY_CHARS} characters.`;

function buildUserPrompt(lead: Lead): string {
  const monthsSince = lead.last_contact_at
    ? Math.max(
        1,
        Math.round(
          (Date.now() - new Date(lead.last_contact_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
        )
      )
    : null;

  const lines = [
    `First name: ${lead.first_name}`,
    lead.city ? `City: ${lead.city}` : null,
    lead.project_interest ? `Project they wanted: ${lead.project_interest}` : null,
    lead.lost_reason ? `Why it did not close: ${LOST_REASON_LABEL[lead.lost_reason]}` : null,
    monthsSince ? `Months since last contact: ${monthsSince}` : null,
    lead.notes
      ? `Notes from the CRM (internal, messy, never quote these back verbatim):\n${lead.notes}`
      : null,
  ].filter(Boolean);

  return `Write the re-engagement email for this lead.

${lines.join("\n")}

Remember: one specific detail from the notes, no pricing, under ${MAX_BODY_CHARS} characters, raw JSON only.`;
}

export interface GenerationResult {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

let anthropicClient: Anthropic | null = null;

async function generateWithAnthropic(lead: Lead): Promise<GenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey });

  const response = await anthropicClient.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 700,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(lead) }],
  });

  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    raw,
    model: ANTHROPIC_MODEL,
    inputTokens,
    outputTokens,
    costUsd: estimateCost(inputTokens, outputTokens),
  };
}

/**
 * One retry on transport failure, with a timeout.
 *
 * A dropped socket or a slow model should not look like a broken agent. HTTP
 * errors (4xx/5xx) are NOT retried - those are answers, and repeating a bad
 * request just spends tokens. Only genuine transport failures get a second go.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs = 90_000
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      lastError = err;
      const name = err instanceof Error ? err.name : "";
      if (name === "TimeoutError") {
        throw new Error(`Model request timed out after ${timeoutMs / 1000}s.`);
      }
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
    }
  }
  const cause =
    lastError instanceof Error && lastError.cause
      ? String((lastError.cause as { code?: string })?.code ?? lastError.cause)
      : lastError instanceof Error
        ? lastError.message
        : String(lastError);
  throw new Error(
    `Could not reach the model API after 2 attempts (${cause}). ` +
      "Check network access and that the API key is valid."
  );
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
}

async function generateWithGemini(lead: Lead): Promise<GenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: buildUserPrompt(lead) }] }],
      generationConfig: {
        temperature: 0.7,
        // Generous ceiling on purpose. Gemini's reasoning models spend
        // "thinking" tokens from this same budget, so a tight limit truncates
        // the answer mid-sentence and the JSON never closes. The guardrails
        // catch that, but a caught failure is still a failure. No thinking
        // config is sent: the field differs across model generations and an
        // unsupported one is rejected outright, so headroom is the portable fix.
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as GeminiResponse;

  if (!res.ok) {
    throw new Error(
      `Gemini returned ${res.status}: ${data?.error?.message ?? "no error message"}`
    );
  }

  const candidate = data.candidates?.[0];
  const raw = (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  // Name the truncation explicitly rather than letting it surface downstream as
  // a vague "not valid JSON".
  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(
      `Gemini stopped early (${candidate.finishReason}) - the draft was cut off. ` +
        "Raise maxOutputTokens or lower the thinking budget."
    );
  }

  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    raw,
    model: GEMINI_MODEL,
    inputTokens,
    outputTokens,
    costUsd: estimateCost(inputTokens, outputTokens),
  };
}

export async function generateDraft(lead: Lead): Promise<GenerationResult> {
  return activeProvider() === "gemini"
    ? generateWithGemini(lead)
    : generateWithAnthropic(lead);
}
