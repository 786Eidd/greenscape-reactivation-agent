import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { money, monthsAgo, LEAD_STATUS_STYLE } from "@/lib/format";
import type { Lead, LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; statuses: LeadStatus[] }[] = [
  { key: "all", label: "All", statuses: [] },
  { key: "dormant", label: "Not yet worked", statuses: ["dormant"] },
  { key: "drafted", label: "Awaiting approval", statuses: ["drafted"] },
  { key: "contacted", label: "Contacted", statuses: ["contacted"] },
  { key: "responded", label: "Responded", statuses: ["responded", "converted"] },
  { key: "suppressed", label: "Suppressed", statuses: ["suppressed"] },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const db = supabaseAdmin();

  let leads: Lead[] = [];
  let loadError: string | null = null;

  try {
    const { data, error } = await db
      .from("leads")
      .select("*")
      .order("estimated_value", { ascending: false });
    if (error) throw new Error(error.message);
    leads = (data ?? []) as Lead[];
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unknown database error";
  }

  if (loadError) {
    return (
      <div className="card p-6">
        <h1 className="text-lg font-semibold">Database not reachable</h1>
        <p className="mt-2 text-sm text-ink/70">{loadError}</p>
        <p className="mt-4 text-sm text-ink/70">
          Set <code className="rounded bg-black/5 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-black/5 px-1">SUPABASE_SERVICE_ROLE_KEY</code>, then run{" "}
          <code className="rounded bg-black/5 px-1">supabase/schema.sql</code> and{" "}
          <code className="rounded bg-black/5 px-1">supabase/seed.sql</code>.
        </p>
      </div>
    );
  }

  const activeKey = searchParams.filter ?? "all";
  const active = FILTERS.find((f) => f.key === activeKey) ?? FILTERS[0];
  const visible = active.statuses.length
    ? leads.filter((l) => active.statuses.includes(l.status))
    : leads;

  const dormant = leads.filter((l) => l.status === "dormant");
  const awaiting = leads.filter((l) => l.status === "drafted");
  const contacted = leads.filter((l) => l.status === "contacted");
  const responded = leads.filter((l) => l.status === "responded" || l.status === "converted");
  const latentValue = dormant.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Closed-lost reactivation queue</h1>
        <p className="mt-1 text-sm text-ink/60">
          Three years of dead leads, worked systematically instead of occasionally.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Unworked leads" value={String(dormant.length)} sub={`${money(latentValue)} latent pipeline`} />
        <Stat label="Awaiting your approval" value={String(awaiting.length)} sub="nothing sends without you" emphasis={awaiting.length > 0} />
        <Stat label="Contacted" value={String(contacted.length)} sub="approved and delivered" />
        <Stat label="Responded" value={String(responded.length)} sub="the metric that matters" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f.statuses.length
            ? leads.filter((l) => f.statuses.includes(l.status)).length
            : leads.length;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/" : `/?filter=${f.key}`}
              className={`badge border ${
                f.key === activeKey
                  ? "border-moss bg-moss text-white"
                  : "border-black/10 bg-white text-ink/70 hover:bg-black/5"
              }`}
            >
              {f.label} · {count}
            </Link>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-black/10 bg-black/[0.02] text-left text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Value</th>
              <th className="px-4 py-3 font-medium">Last contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {visible.map((lead) => (
              <tr key={lead.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                    {lead.first_name} {lead.last_name}
                  </Link>
                  <div className="text-xs text-ink/45">{lead.city}</div>
                </td>
                <td className="px-4 py-3 text-ink/70">{lead.project_interest ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{money(lead.estimated_value)}</td>
                <td className="px-4 py-3 text-ink/60">{monthsAgo(lead.last_contact_at)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${LEAD_STATUS_STYLE[lead.status]}`}>{lead.status}</span>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink/45">
                  Nothing in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  emphasis,
}: {
  label: string;
  value: string;
  sub: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`card p-4 ${emphasis ? "ring-2 ring-amber-300" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-ink/45">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-ink/50">{sub}</div>
    </div>
  );
}
