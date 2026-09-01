export type LeadStatus =
  | "dormant"
  | "drafted"
  | "contacted"
  | "responded"
  | "converted"
  | "suppressed";

export type MessageStatus = "draft" | "failed" | "sent" | "rejected" | "bounced";

export type LostReason =
  | "price"
  | "went_with_competitor"
  | "went_cold"
  | "timing"
  | "unresponsive"
  | "unknown";

export interface Lead {
  id: string;
  ghl_contact_id: string | null;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  project_interest: string | null;
  estimated_value: number | null;
  notes: string | null;
  lost_reason: LostReason | null;
  last_contact_at: string | null;
  status: LeadStatus;
  suppressed_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string | null;
  status: MessageStatus;
  failure_reason: string | null;
  edited_by_human: boolean;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  approved_by: string | null;
  sent_at: string | null;
  provider_message_id: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  lead_id: string | null;
  message_id: string | null;
  kind: string;
  detail: string | null;
  actor: string | null;
  created_at: string;
}

export const LOST_REASON_LABEL: Record<LostReason, string> = {
  price: "Price",
  went_with_competitor: "Went with competitor",
  went_cold: "Went cold",
  timing: "Timing",
  unresponsive: "Unresponsive",
  unknown: "Unknown",
};
