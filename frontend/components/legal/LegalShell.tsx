import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AuroraBackground } from "@/components/ui/aurora-background";
import { AuraWordmark } from "@/components/ui/aura-logo";

export type LegalBlock = { p: string } | { ul: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

/**
 * Shared frame for the public legal pages (Privacy, Terms): aurora backdrop,
 * a single readable glass column, consistent typography, and cross-links.
 */
export function LegalShell({
  title,
  updated,
  lede,
  sections,
  crossLink,
}: {
  title: string;
  updated: string;
  lede: string;
  sections: LegalSection[];
  crossLink: { href: string; label: string };
}) {
  return (
    <div className="relative min-h-screen">
      <AuroraBackground />

      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-8">
        <Link href="/" aria-label="Aura home">
          <AuraWordmark />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="glass rounded-3xl p-7 sm:p-10">
          <p className="text-sm font-medium text-primary">Legal</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: {updated}
          </p>
          <p className="mt-6 text-base leading-relaxed text-foreground/85">
            {lede}
          </p>

          <div className="mt-8 space-y-8">
            {sections.map((section, i) => (
              <section key={section.heading}>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  <span className="text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}.
                  </span>{" "}
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {section.blocks.map((block, j) =>
                    "p" in block ? (
                      <p key={j}>{block.p}</p>
                    ) : (
                      <ul key={j} className="ml-4 list-disc space-y-1.5 marker:text-primary/50">
                        {block.ul.map((item, k) => (
                          <li key={k}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
            <p className="text-xs text-muted-foreground">
              Aura — privacy-first clinical documentation.
            </p>
            <Link
              href={crossLink.href}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {crossLink.label}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
