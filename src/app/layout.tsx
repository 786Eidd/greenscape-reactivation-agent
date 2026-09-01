import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Greenscape Pro · Reactivation Agent",
  description:
    "AI-drafted, human-approved re-engagement for Greenscape Pro's closed-lost lead backlog.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-black/10 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-baseline gap-2.5">
              <span className="text-base font-semibold tracking-tight">Greenscape Pro</span>
              <span className="text-sm text-ink/50">Reactivation Agent</span>
            </Link>
            <a
              href="/api/health"
              className="text-xs text-ink/45 underline underline-offset-4 hover:text-ink"
            >
              system health
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-10 pt-2 text-xs text-ink/40">
          Every message is drafted by Claude and sent only after a human approves it.
        </footer>
      </body>
    </html>
  );
}
