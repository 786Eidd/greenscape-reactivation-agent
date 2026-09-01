# Loom Script — 5:00 hard ceiling

They said explicitly: *"We've watched 20-minute Looms, and they don't help your case."* Going long is a scored negative. So is narrating code line by line.

**Before you hit record**
- Dashboard open on the queue, one Slack window visible, one lead already `contacted` so history is populated, and **Dana Whitfield left in `dormant`** — she is your live demo.
- Change Dana's email to your own address first, so the send is real and you can show the inbox.
- Terminal open on the repo with `npm run test:guardrails` typed but not run.
- Close every unrelated tab. Silence notifications.

---

### 0:00 – 0:30 · Frame the disagreement immediately

> "Greenscape Pro. Marcus told us his number one problem is quoting — six to nine days, losing 35 to 40% of qualified leads to faster competitors. He's right that it's the biggest number. I still didn't build it first, and I want to explain why in about thirty seconds."

> "Quoting requires replicating pricing judgment he's never written down — his words, 'nobody else knows how to do that.' It needs him to change how he captures site-walk notes. And it puts AI output in front of a live prospect with money attached. That's the highest-value agent and the highest-risk one, and those are different questions."

> "So I built the one that's fully self-contained: 1,400 dead leads in GHL, worked systematically for the first time. Roughly $784K of latent pipeline, nothing needed from Marcus except approval."

*Do not read the strategy doc aloud. This is the whole strategy section.*

### 0:30 – 1:15 · Top 3 and the one non-obvious call

> "Two and three. My number two isn't on Marcus's list at all — it's the approvals agent. Jenna says on the call, 'I literally just need a rule book.' Marcus says, 'I keep saying I'll write it down, I never do.' Your auditor left that exchange without a note."

> "That's not a small annoyance, it's the blocker for everything else. Every time Jenna asks 'what do I charge for this' and Marcus answers, that's a labelled training example evaporating into Slack. Capture sixty days of those and you have the decision corpus that makes the proposal agent — my number three, his number one — safe to build. Number two is the data collection layer for number three."

> "Interdependency worth naming: reactivation makes the quoting bottleneck *worse* before the proposal agent fixes it. More revived leads, more proposals. That's fine — it converts a diffuse problem into an urgent measurable one."

### 1:15 – 3:00 · The build, end to end

Screen on the dashboard.

> "Fifteen leads from the closed-lost pile, GHL-shaped, real Postgres on Supabase. Dana Whitfield — paver patio and fire pit, $34K, went cold sixteen months ago. Here's her actual CRM note."

Click **Generate draft**.

> "That's Claude Haiku. Haiku deliberately — short constrained drafting with a human reading every output. Sonnet buys reasoning depth this doesn't need, and at 1,400 leads the tier choice is the whole cost story."

Draft appears. Point at the cost line.

> "Real token counts, real cost, recorded per message. Under a cent. Whole backlog is under ten dollars against $784K of pipeline."

Point at the body.

> "Notice it references the travertine and the north-facing yard — one specific detail from her file. That's the entire premise. Marcus said it himself: when it feels like a blast, they don't respond."

Switch to Slack, show the ping.

> "Slack fires the moment a draft is ready, with a direct link. 'A human approves everything' is meaningless if that human has to remember to check a dashboard — especially this founder, who's already the bottleneck."

Back to the dashboard. Edit one word in the body.

> "And I can edit before approving. An approval flow where the only button is approve is theatre."

Click **Approve and send**. Show the inbox.

> "Generation and sending are two separate endpoints with a database status between them. There's no code path where a model response reaches a customer without a human hitting that button."

### 3:00 – 4:00 · Guardrails and architecture

> "What happens when the model returns garbage."

Run `npm run test:guardrails`.

> "Twenty-four checks. Rejects invalid JSON, unfilled placeholders, character breaks, loops, anything that states a price or promises a discount, and any draft that doesn't use the lead's first name. Failed drafts land in a `failed` state — visible with the reason, and the send endpoint refuses them on principle."

> "This suite has already earned its keep. An earlier price regex let `$28,000` through because of the comma. The test caught it, not me reading the code."

Show a suppressed lead.

> "The worst realistic failure of this system isn't an awkward email — it's emailing 'still thinking about your backyard?' to somebody who became a client eight months ago. Suppression is checked at draft time and again at send time, and Resend bounce webhooks suppress automatically."

> "Stack: Next.js on Vercel, Supabase Postgres, Haiku, Resend, Slack. Postgres because the status machine is enforced by CHECK constraints, not by hope. Resend over Twilio because 10DLC registration takes days — but the send module is channel-shaped, so swapping in GHL SMS is one file."

### 4:00 – 4:45 · Next week, honestly

> "Three things break first at scale, and I'd rather tell you than have you find them."

> "One: no reply capture. The loop ends at sent. `Responded` is the metric that actually matters and nothing sets it. That's what I'd build Monday."

> "Two: no bulk generation. One lead at a time — correct for review-first, wrong for a 1,400-lead backlog. Needs a queue and a rate-limited worker; Anthropic limits and Vercel timeouts both bite around lead two hundred."

> "Three: it doesn't write back to GHL yet. Jenna's constraint was absolute — everything has to be in GHL or it won't get used. Schema's GHL-shaped so it's a sync job, not a rewrite, but it isn't built and I'm not going to pretend otherwise."

### 4:45 – 5:00 · Stop

> "Repo, deployed URL and the strategy doc are in the email. Happy to defend any of it on the call."

**Stop recording.**

---

**If you overrun:** cut the 1:15–3:00 demo narration, not the disagreement at 0:00 or the limitations at 4:00. Strategy judgment and honest trade-offs are 60% of the rubric between them; the demo is the part they can click on themselves.
