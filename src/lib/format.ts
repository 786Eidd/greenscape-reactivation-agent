import type { LeadStatus, MessageStatus } from "./types";

export function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function monthsAgo(value: string | null | undefined): string {
  if (!value) return "unknown";
  const months = Math.round(
    (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  if (months < 1) return "this month";
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

export const LEAD_STATUS_STYLE: Record<LeadStatus, string> = {
  dormant: "bg-black/5 text-ink/60",
  drafted: "bg-amber-100 text-amber-800",
  contacted: "bg-blue-100 text-blue-800",
  responded: "bg-emerald-100 text-emerald-800",
  converted: "bg-moss text-white",
  suppressed: "bg-red-50 text-red-700",
};

export const MESSAGE_STATUS_STYLE: Record<MessageStatus, string> = {
  draft: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  sent: "bg-blue-100 text-blue-800",
  rejected: "bg-black/5 text-ink/60",
  bounced: "bg-red-100 text-red-800",
};
