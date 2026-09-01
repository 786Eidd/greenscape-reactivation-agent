import Anthropic from "@anthropic-ai/sdk";
import type { Lead } from "./types";
import { LOST_REASON_LABEL } from "./types";
import { MAX_BODY_CHARS } from "./guardrails";

/**
 * Model choice.
 *
 * Haiku, not Sonnet or Opus. This is a short, high-volume, tightly-constrained
 * drafting task with a human reading every output before it goes anywhere. The
 * expensive tiers buy reasoning depth this job does not need, and the backlog
 * is 1,400 leads — the cost difference is the difference between drafting the
 * whole backlog for the price of a coffee and drafting it for the price of a
 * dinner. Overridable via ANTHROPIC_MODEL.
 */
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";

const INPUT_COST_PER_MTOK = Number(process.env.ANTHROPIC_INPUT_COST_PER_MTOK || "0.80");
const OUTPUT_COST_PER_MTOK = Number(process.env.ANTHROPIC_OUTPUT_COST_PER_MTOK || "4.00");

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  client = new Anthropic({ apiKey });
  return client;
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK
  );
}

const SYSTEM_PROMPT = `You write short re-engagement emails as Marcus Tate, founder of Greenscape Pro, a high-end residential hardscape and landscape design-build company in Phoenix, Arizona.

These go to people who asked Greenscape Pro for a quote months or years ago and never signed. Marcus is personally reaching back out. He is not running a campaign.

VOICE
- Write the way a busy owner-operator actually types: plain, warm, direct, a little informal. Contractions. Short paragraphs.
- Reference one concrete, specific detail from the lead's file so it is obvious this is not a blast. That specificity is the entire point.
- No marketing language. Never use: "circling back", "touching base", "just checking in", "reaching out", "exciting news", "we'd love to", "at your convenience", "hope this email finds you well".
- No exclamation marks. No emoji. No bullet points. No headers.

CONTENT RULES — these are hard constraints
- Never state, quote, estimate, or imply a price. Never offer a discount, a promotion, or free work. Pricing requires a real proposal from a real site walk.
- Never claim work was completed for them, never invent shared history beyond what the file says, never invent names of people.
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
    lead.notes ? `Notes from the CRM (internal, messy, never quote these back verbatim):\n${lead.notes}` : null,
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

export async function generateDraft(lead: Lead): Promise<GenerationResult> {
  const response = await anthropic().messages.create({
    model: MODEL,
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
    model: MODEL,
    inputTokens,
    outputTokens,
    costUsd: estimateCost(inputTokens, outputTokens),
  };
}
