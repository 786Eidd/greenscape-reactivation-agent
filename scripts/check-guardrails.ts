/**
 * Guardrail test suite — `npm run test:guardrails`
 *
 * No test framework on purpose: this is one pure function with a lot of edge
 * cases, and a dependency-free script that exits non-zero is enough to prove
 * the validator does what the README claims. Run it before every deploy.
 */
import { validateDraft, assertSendable } from "../src/lib/guardrails";
import type { Lead } from "../src/lib/types";

const lead: Lead = {
  id: "test",
  ghl_contact_id: "ghl_test",
  first_name: "Dana",
  last_name: "Whitfield",
  email: "dana.whitfield@example.com",
  phone: "+16025550142",
  city: "Scottsdale",
  project_interest: "Paver patio + built-in fire pit",
  estimated_value: 34000,
  notes: "Site walk 4/18. Wanted travertine.",
  lost_reason: "went_cold",
  last_contact_at: "2025-05-02",
  status: "dormant",
  suppressed_reason: null,
  created_at: "2025-05-02",
  updated_at: "2025-05-02",
};

const GOOD_BODY =
  "Dana, it's Marcus over at Greenscape Pro. We walked your yard back in the spring and talked through the travertine patio with the fire pit off the north side.\n\nI know it's been a while and life gets busy. I'm not chasing you, I just wanted to ask straight out whether the backyard is still on your list, or whether you've moved on from it. Either answer is fine and it helps me know whether to keep your file open.\n\nIf it's still something you're thinking about, just reply and let me know where your head's at.\n\nMarcus";

let failures = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function expectReject(name: string, raw: string) {
  const result = validateDraft(raw, lead);
  check(name, result.ok === false, result.ok ? "was accepted but should have been rejected" : undefined);
}

console.log("\nvalidateDraft — accepts good output");
{
  const result = validateDraft(JSON.stringify({ subject: "your backyard", body: GOOD_BODY }), lead);
  check("clean JSON draft is accepted", result.ok === true, result.ok ? undefined : result.reason);
}
{
  const fenced = "```json\n" + JSON.stringify({ subject: "your backyard", body: GOOD_BODY }) + "\n```";
  const result = validateDraft(fenced, lead);
  check("recovers JSON from a markdown fence", result.ok === true, result.ok ? undefined : result.reason);
}
{
  const chatty = "Sure! Here you go:\n" + JSON.stringify({ subject: "your backyard", body: GOOD_BODY });
  const result = validateDraft(chatty, lead);
  check("recovers JSON wrapped in prose", result.ok === true, result.ok ? undefined : result.reason);
}

console.log("\nvalidateDraft — rejects garbage");
expectReject("not JSON at all", "I'm sorry, I can't help with that.");
expectReject("empty object", "{}");
expectReject("missing body", JSON.stringify({ subject: "hey" }));
expectReject("body too short", JSON.stringify({ subject: "hey", body: "Dana, hi." }));
expectReject(
  "body too long",
  JSON.stringify({ subject: "hey", body: "Dana " + "x".repeat(2000) })
);
expectReject(
  "unfilled handlebars placeholder",
  JSON.stringify({ subject: "hey", body: GOOD_BODY.replace("Dana,", "{{first_name}}, Dana,") })
);
expectReject(
  "unfilled bracket placeholder",
  JSON.stringify({ subject: "hey", body: GOOD_BODY + "\n\n[insert project details]" })
);
expectReject(
  "model breaks character",
  JSON.stringify({ subject: "hey", body: "As an AI language model I cannot assist. " + GOOD_BODY })
);
expectReject(
  "quotes a dollar figure",
  JSON.stringify({ subject: "hey", body: GOOD_BODY + "\n\nI can do it for $28,000." })
);
expectReject(
  "quotes a small dollar figure",
  JSON.stringify({ subject: "hey", body: GOOD_BODY + "\n\nDeposit is $500." })
);
expectReject(
  "echoes a shorthand budget figure from the notes",
  JSON.stringify({ subject: "hey", body: GOOD_BODY + "\n\nI know you said around 30k." })
);
expectReject(
  "promises a discount",
  JSON.stringify({ subject: "hey", body: GOOD_BODY + "\n\nI'll take 10% off if you book now." })
);
expectReject(
  "promises free work",
  JSON.stringify({ subject: "hey", body: GOOD_BODY + "\n\nFree design included." })
);
expectReject(
  "makes a guarantee",
  JSON.stringify({ subject: "hey", body: GOOD_BODY + "\n\nGuaranteed to finish before summer." })
);
expectReject(
  "never uses the lead's first name",
  JSON.stringify({ subject: "hey", body: GOOD_BODY.replace(/Dana/g, "there") })
);
expectReject(
  "subject far too long",
  JSON.stringify({ subject: "a".repeat(120), body: GOOD_BODY })
);
expectReject(
  "model looped and repeated a block",
  JSON.stringify({
    subject: "hey",
    body: "Dana, still thinking about the patio and fire pit? " .repeat(6),
  })
);

console.log("\nassertSendable — send-time gate");
check("dormant lead with a valid email is sendable", assertSendable(lead).ok === true);
check(
  "suppressed lead is blocked",
  assertSendable({ ...lead, status: "suppressed", suppressed_reason: "now a client" }).ok === false
);
check("converted lead is blocked", assertSendable({ ...lead, status: "converted" }).ok === false);
check("lead with no email is blocked", assertSendable({ ...lead, email: null }).ok === false);
check("lead with a malformed email is blocked", assertSendable({ ...lead, email: "not-an-email" }).ok === false);

console.log(
  failures === 0 ? "\nAll guardrail checks passed.\n" : `\n${failures} guardrail check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);
