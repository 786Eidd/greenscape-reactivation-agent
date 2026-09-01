# Submission email — reply to Alessandro's original thread

Reply to the original email so the thread stays intact. Do not start a new one.
Fill the four bracketed values, delete this line and everything above it.

---

**Subject:** Re: AI Developer Take-Home — [Your Name]

Alessandro,

Submission below.

**GitHub:** [repo URL]
**Deployed:** [Vercel URL]
**Loom:** [Loom URL]
**Strategy doc:** [STRATEGY.md in the repo root — repo URL]/blob/main/STRATEGY.md

**What I built:** the Closed-Lost Lead Reactivation Agent — 1,400 dead GHL leads turned into an AI-drafted, human-approved re-engagement pipeline. Claude Haiku drafts from each lead's actual file, guardrails reject anything that quotes a price or breaks character, and a human edits and approves before anything sends. Slack ping on draft-ready, Resend on send, bounce webhooks auto-suppress.

**Where I disagreed with Marcus:** he ranked quoting first and he's right that it's the biggest number — 35–40% of qualified leads lost at the proposal stage. I ranked it third. It requires replicating pricing judgment he's never documented ("nobody else knows how to do that"), it needs him to change how he captures site-walk notes, and it puts AI output in front of a live prospect with money attached. Reactivation needs none of that and banks ~$784K of latent pipeline while the sequencing problem gets solved properly.

**The call I'd most like to defend:** my #2 isn't on his list. Jenna says "I literally just need a rule book"; Marcus says "I keep saying I'll write it down, I never do." Your auditor left that exchange without a note. Every approval question Marcus answers in Slack is a labelled training example evaporating — capture sixty days of them and you have the corpus that makes his stated #1 safe to build. #2 is the data layer for #3.

**What I'd fix first:** no reply capture (the loop ends at `sent`, and `responded` is the metric that matters), no bulk generation, and no GHL write-back yet — which given Jenna's constraint is the difference between a demo and something Greenscape would actually run. Full list in the README.

Guardrails have a test suite — `npm run test:guardrails`, 24 checks. It caught a real defect during the build: `$28,000` slipped past an earlier price regex because of the comma.

Available for the walkthrough call whenever suits.

[Your name]
[phone]
