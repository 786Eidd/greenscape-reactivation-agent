# Greenscape Pro — Closed-Lost Lead Reactivation Agent

The P0 from [`STRATEGY.md`](./STRATEGY.md), built end-to-end.

Greenscape Pro has 1,400+ closed-lost leads sitting in GoHighLevel from three years of paid acquisition. Brittany runs occasional re-engagement blasts; they underperform for the reason Marcus named on the discovery call — *"when it feels like a mass blast, they do not [respond]."*

This turns that pile into a pipeline: **Claude drafts a personal-sounding message from each lead's actual file, a human reads and edits it, and only then can it send.**

**Live:** _<add your Vercel URL>_ · **Health check:** `/api/health`

---

## What it does

```
GHL-shaped lead record
        │
        ▼
POST /api/leads/:id/generate ──► Claude Haiku ──► guardrail validation
        │                                              │
        │                                    ┌─────────┴─────────┐
        │                              passes                  fails
        │                                    │                    │
        ▼                                    ▼                    ▼
   Slack ping                        messages.status =     messages.status =
   "draft ready"                         'draft'              'failed'
                                             │            (visible, never sendable)
                                    human reviews + edits
                                             │
                                             ▼
                            POST /api/messages/:id/send   ◄── the ONLY send path
                                             │
                                    Resend ──► customer
                                             │
                                    leads.status = 'contacted'
                                    Slack ping + audit event
```

Generation and sending are **separate endpoints separated by a database status**. There is no code path where a model response reaches a customer without a human POSTing to the send route.

## Stack, and why

| Piece | Choice | Why this one |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes and admin UI in one deployable. For a 24-hour build, one repo that ships to Vercel in minutes beats a split frontend/backend. |
| Database | Supabase (Postgres) | Real relational persistence with FK constraints and CHECK constraints doing actual work — `messages.status` is enforced by the database, not by hope. RLS on, no public policies. |
| Model | **A small, fast tier** — Claude Haiku or Gemini Flash, behind one interface | Short, high-volume, tightly-constrained drafting with a human reviewing every output. Frontier models buy reasoning depth this task does not need, and across 1,400 leads the tier choice is the entire cost story. The drafting layer is provider-agnostic (`AI_PROVIDER=anthropic\|gemini`): the prompt, the guardrails and the cost accounting are identical either way, because the opinionated part of this agent is the system prompt and the validation around it, not the vendor. Claude Haiku is the intended production model; the live demo runs on Gemini Flash. |
| Email | Resend | Requires one verified domain. Twilio SMS is closer to how Greenscape actually reaches people through GHL, but A2P 10DLC registration takes days and cannot be demoed inside 24 hours. `src/lib/email.ts` is channel-shaped so a GHL SMS swap is a one-file change. |
| Notification | Slack incoming webhook | Makes human-in-the-loop real. "A human approves everything" means nothing if that human is expected to remember to open a dashboard — especially this founder, who is already the bottleneck. |

## Guardrails — what happens when the model returns garbage

Every draft is validated before it can be stored as sendable (`src/lib/guardrails.ts`). A draft is rejected — written as `failed` with the specific reason, shown in the dashboard, and permanently barred from the send route — if it:

- is not valid JSON (a fenced or prose-wrapped object is recovered first, then still validated on merit)
- is missing a subject or body, or the subject exceeds 90 characters
- has a body under 40 or over 1,500 characters (too short to be real; too long means the model looped)
- contains an unfilled placeholder — `{{name}}`, `[insert ...]`, `[TODO]`, `<first_name>`
- breaks character — "as an AI", "language model", or returns a refusal or a preamble
- **states any price**, offers a discount, promises free work, or makes a guarantee
- **echoes a shorthand budget figure from the CRM notes** (the notes literally contain "budget was ~30k")
- never uses the lead's first name — personalisation is this agent's whole premise
- repeats a block of text, indicating a loop

Two further checks run at send time (`assertSendable`), redundantly with the generate route, because sending is the only irreversible action here: the lead must not be **suppressed** or already **converted**, and must have a syntactically valid email.

```bash
npm run test:guardrails   # 24 checks, no framework, exits non-zero on failure
```

Run it before every deploy. It has already caught one real defect: `$28,000` slipped past an earlier price regex because of the comma.

## Cost

~450 input tokens + ~180 output tokens per draft, at a small-tier model.

Because the provider is swappable, so is the price: the deployed demo runs on Gemini Flash's free tier at literally zero, and the same code on Claude Haiku costs what the table below shows. Per-draft token counts and cost are recorded on every `messages` row and shown in the UI, so the figure is measured rather than asserted.

| | |
|---|---|
| Per draft (Claude Haiku) | **well under $0.01** |
| Whole 1,400-lead backlog (Haiku) | **under $10**, one pass |
| Same backlog on Gemini Flash free tier | **$0** |
| Against | ~$784K of latent pipeline |

Live token counts and per-draft cost are recorded on every `messages` row and shown in the UI, so the number is measured rather than asserted. Pricing is configurable via `ANTHROPIC_INPUT_COST_PER_MTOK` / `ANTHROPIC_OUTPUT_COST_PER_MTOK`.

## Running it

```bash
git clone <this repo> && cd greenscape-reactivation-agent
npm install
cp .env.example .env.local     # fill in the values
npm run dev
```

Database: run `supabase/schema.sql` then `supabase/seed.sql` in the Supabase SQL editor.

**Dry-run mode:** with `RESEND_API_KEY` unset the app runs end-to-end and records sends without any email leaving the system — so the repo is clonable and reviewable without credentials.

All seed emails are `@example.com` deliberately, so a misfire during development cannot reach a real person. Change one row to your own address to demo a live send.

## API

| Route | Purpose |
|---|---|
| `POST /api/leads/:id/generate` | Draft a message. Can never send. Refuses suppressed leads before spending tokens. |
| `POST /api/messages/:id/send` | The only send path. Requires a `draft`; accepts reviewer edits. |
| `POST /api/messages/:id/reject` | Decline a draft, with reason retained. |
| `POST /api/leads/:id/suppress` | Do-not-contact. |
| `POST /api/webhooks/resend` | Bounce and complaint events → auto-suppress. Secret-gated. |
| `GET /api/health` | Which integrations are actually wired. |

## Known limitations — what breaks first at scale

Honest list, in the order I would fix them.

1. **No reply capture.** The loop ends at `sent`. `responded` is the metric that actually matters and nothing sets it today. Needs an inbound mail route (Resend inbound or GHL webhook) parsing replies and flipping status. *First thing I would build with another week.*
2. **No bulk generation.** Drafts are one lead at a time. At 1,400 leads this needs a queue table and a rate-limited worker — Anthropic rate limits and Vercel's function timeout both bite well before lead 200. The one-at-a-time design is correct for a review-first workflow and wrong for a backlog.
3. **Suppression is reactive, not proactive.** Bounces and complaints auto-suppress, and current clients can be suppressed manually, but there is no automated cross-check against active Jobber projects or maintenance contracts. Before a real bulk send that check is mandatory — emailing "still thinking about your backyard?" to a current client is the worst realistic failure of this system.
4. **No real auth.** A single approver from `APPROVER_EMAIL`, and an optional shared-password gate. Jenna and Brittany both need their own accounts with a per-user audit trail.
5. **Not yet writing to GHL.** The schema is deliberately GHL-shaped (`ghl_contact_id` is the join key) but the sync is not built, and Jenna's constraint is absolute: *"Everything has to be in GHL or it is not going to get used."* Two-way sync is the difference between a demo and something Greenscape would actually run.
6. **No send throttling or quiet hours.** 1,400 emails from a cold domain in one afternoon is a deliverability incident. Needs warm-up, daily caps, and timezone-aware scheduling.

## What I would do differently with more time

Sequence #2 from the strategy doc — the Approval & Pricing Policy Agent — before touching proposals, because it is what turns Marcus's undocumented judgment into something a proposal agent can safely encode. And I would make the reactivation prompt learn: right now rejected drafts are stored with reasons and nothing consumes them. That rejection log is the highest-value unused data in the system.
