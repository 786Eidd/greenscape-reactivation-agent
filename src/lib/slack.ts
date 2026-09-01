/**
 * Slack incoming webhook.
 *
 * This is what makes the human-in-the-loop real. Without it, "a human
 * approves every message" means "a human is expected to remember to open a
 * dashboard", which in a business where the founder is already the bottleneck
 * is the same as no approval at all. Marcus gets a ping with a direct link.
 *
 * Never throws: a Slack outage must not fail a send that already succeeded.
 */

export function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function post(payload: unknown): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.info("[slack] SLACK_WEBHOOK_URL not set — skipping notification");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error("[slack] webhook returned", res.status, await res.text());
    }
  } catch (err) {
    console.error("[slack] webhook failed", err);
  }
}

export async function notifyDraftReady(args: {
  leadId: string;
  leadName: string;
  projectInterest: string | null;
  estimatedValue: number | null;
  subject: string;
}): Promise<void> {
  const value = args.estimatedValue
    ? ` · $${Math.round(args.estimatedValue).toLocaleString("en-US")}`
    : "";
  await post({
    text: `Draft ready for review: ${args.leadName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Draft ready for your approval*\n*${args.leadName}*${value}\n${
            args.projectInterest ?? "No project on file"
          }\n_Subject:_ ${args.subject}`,
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Review and approve" },
            url: `${appUrl()}/leads/${args.leadId}`,
            style: "primary",
          },
        ],
      },
    ],
  });
}

export async function notifySent(args: {
  leadName: string;
  email: string;
  approvedBy: string;
}): Promise<void> {
  await post({
    text: `Reactivation email sent to ${args.leadName} (${args.email}) — approved by ${args.approvedBy}`,
  });
}

export async function notifyFailure(args: {
  leadName: string;
  stage: "generation" | "send";
  reason: string;
}): Promise<void> {
  await post({
    text: `:warning: Reactivation ${args.stage} failed for ${args.leadName} — ${args.reason}`,
  });
}
