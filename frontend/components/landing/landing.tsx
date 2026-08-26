"use client";

/**
 * Aura marketing page. Design language borrowed from the best of the current
 * web (Linear's restraint, Stripe's typographic scale, Vercel's bento grids):
 * one display statement per viewport, generous whitespace, scroll-triggered
 * reveals, and a live WebGL centerpiece. Every claim on this page is true of
 * the product — no invented logos, numbers, or testimonials.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  AudioLines,
  BrainCircuit,
  FileText,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";

import { AuroraBackground } from "@/components/ui/aurora-background";
import { Butterfly, ScrollButterflies } from "@/components/ui/butterfly";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AuraWordmark } from "@/components/ui/aura-logo";
import { Button } from "@/components/ui/button";
import { CursorTrail } from "@/components/ui/cursor-trail";
import { GooeyFilter } from "@/components/ui/gooey-filter";
import { PixelTrail } from "@/components/ui/pixel-trail";
import { useScreenSize } from "@/hooks/use-screen-size";
import { useFinePointer } from "@/hooks/use-fine-pointer";
import { EASE_OUT } from "@/components/motion/primitives";
import { HeroOrb } from "@/components/landing/hero-orb";

/* ----------------------------------------------------------------------- */
/* Shared scroll-reveal                                                     */
/* ----------------------------------------------------------------------- */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------------------------- */
/* Nav                                                                      */
/* ----------------------------------------------------------------------- */

/* ----------------------------------------------------------------------- */
/* Nav                                                                      */
/* ----------------------------------------------------------------------- */

function LandingNav({ authed }: { authed: boolean }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Aura home">
          <AuraWordmark />
        </Link>
        <div className="hidden items-center gap-6 text-xs font-medium text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#privacy" className="transition-colors hover:text-foreground">
            Privacy
          </a>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {authed ? (
            <Button asChild size="sm">
              <Link href="/dashboard">
                Open workspace
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/login">
                  Get started
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

/* ----------------------------------------------------------------------- */
/* Hero                                                                     */
/* ----------------------------------------------------------------------- */

function Hero({ authed }: { authed: boolean }) {
  return (
    <section className="relative flex flex-col items-center justify-center border-b border-border px-4 py-24 sm:py-32">
      <div className="relative z-10 flex max-w-4xl flex-col items-center text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.1 }}
          className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
        >
          Sessions become notes.
          <br />
          <span className="text-foreground/80">Voices stay in the room.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 }}
          className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base"
        >
          Aura listens to your therapy sessions and drafts the clinical note —
          transcribed on your own infrastructure with raw audio deleted immediately.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.3 }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg">
            <Link href={authed ? "/dashboard" : "/login"}>
              {authed ? "Open workspace" : "Get started now"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#how">How it works</a>
          </Button>
        </motion.div>

        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-14 grid grid-cols-3 gap-8 text-center border-t border-border pt-10 w-full max-w-2xl"
        >
          {[
            ["0", "audio recordings kept"],
            ["100%", "transcribed on your machine"],
            ["0", "words sent to a cloud AI"],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-mono">
                {value}
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground">{label}</dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Bento features                                                           */
/* ----------------------------------------------------------------------- */

function Waveform() {
  return (
    <div className="flex h-12 items-end gap-1.5" aria-hidden>
      {[0.4, 0.7, 1, 0.55, 0.85, 0.35, 0.9, 0.6, 0.75, 0.45, 1, 0.65].map(
        (h, i) => (
          <motion.span
            key={i}
            className="w-1.5 origin-bottom rounded-sm bg-primary"
            style={{ height: `${h * 100}%` }}
            animate={{ scaleY: [1, 0.45, 1] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.09,
            }}
          />
        ),
      )}
    </div>
  );
}

const SAMPLE_NOTE: { heading: string; bullets: string[] }[] = [
  {
    heading: "What was discussed",
    bullets: [
      "Work-related anxiety; sleep disrupted 4–5 nights this week.",
      "Slow-breathing practice helped before presentations.",
    ],
  },
  {
    heading: "What lies ahead",
    bullets: [
      "Keep daily breathing practice; fixed 11:30pm bedtime.",
      "Next session: fear of disappointing family.",
    ],
  },
];

function NoteSkeleton() {
  return (
    <div className="space-y-2">
      {SAMPLE_NOTE.map((section) => (
        <div
          key={section.heading}
          className="rounded-md border border-border bg-muted/40 px-3 py-2"
        >
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            {section.heading}
          </p>
          <ul className="space-y-0.5">
            {section.bullets.map((b, j) => (
              <li key={j} className="text-xs text-muted-foreground leading-snug">
                • {b}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const FEATURES = [
  {
    icon: AudioLines,
    title: "Ambient scribe",
    body: "Record the session and stay present. Aura transcribes inside your own backend — no speech API, no cloud vendor, no transcript ever leaving your infrastructure.",
    span: "md:col-span-7",
    visual: <Waveform />,
  },
  {
    icon: FileText,
    title: "Structured notes, instantly",
    body: "Every session becomes a clean, structured note — what was discussed and what lies ahead — that you review, edit, and own.",
    span: "md:col-span-5",
    visual: <NoteSkeleton />,
  },
  {
    icon: Timer,
    title: "Ephemeral by design",
    body: "Raw audio is deleted the moment transcription finishes — success or failure. The unedited transcript is purged in the same database write that exports your note.",
    span: "md:col-span-5",
    visual: null,
  },
  {
    icon: BrainCircuit,
    title: "Patient memory",
    body: "Every exported note is indexed into a private semantic memory. Ask “how has Maya's sleep changed since March?” and Aura recalls the answer from your own notes.",
    span: "md:col-span-7",
    visual: (
      <div className="flex flex-wrap gap-2" aria-hidden>
        {["sleep ↓ then ↑", "started CBT-i", "fewer nightmares", "meds unchanged"].map(
          (chip) => (
            <span
              key={chip}
              className="rounded-sm border border-border bg-muted px-2 py-1 text-[11px] font-mono text-muted-foreground"
            >
              {chip}
            </span>
          ),
        )}
      </div>
    ),
  },
] as const;

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 border-b border-border">
      <Reveal className="max-w-2xl">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Built for clinical focus,
          <br />
          <span className="text-muted-foreground">not paperwork administrative load.</span>
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-12">
        {FEATURES.map(({ icon: Icon, title, body, span, visual }, i) => (
          <Reveal key={title} delay={i * 0.06} className={span}>
            <div className="group flex h-full flex-col justify-between gap-6 rounded-md border border-border bg-card p-6 transition-colors hover:border-foreground/30">
              <div>
                <div className="flex size-9 items-center justify-center rounded-md bg-muted text-foreground">
                  <Icon className="size-4" />
                </div>
                <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
              </div>
              {visual}
            </div>
          </Reveal>
        ))}
      </div>

      {/* Security strip */}
      <Reveal delay={0.1} className="mt-4">
        <div className="grid gap-6 rounded-md border border-border bg-muted/40 p-6 sm:grid-cols-3">
          {[
            [ShieldCheck, "Row-level isolation", "Postgres RLS scopes every row to its clinician — enforced by the database."],
            [Fingerprint, "Verified on every request", "The backend cryptographically verifies your identity token on each API route."],
            [BrainCircuit, "No third-party AI", "Transcription and memory embeddings are computed in-process. No third-party data sharing."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="flex gap-3">
                <I className="mt-0.5 size-4 shrink-0 text-foreground" />
                <div>
                  <p className="text-xs font-bold text-foreground">{title as string}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {body as string}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* How it works                                                             */
/* ----------------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Record",
    body: "One tap when the session starts. A live indicator confirms recording — audio stays local to your device.",
  },
  {
    title: "Review",
    n: "02",
    body: "Minutes later, a structured note is ready. Edit it like a document; the transcript stays visible until exported.",
  },
  {
    n: "03",
    title: "Export & purge",
    body: "Exporting copies the note out and permanently destroys the raw transcript in the same instant.",
  },
] as const;

function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 border-b border-border">
      <Reveal className="max-w-2xl">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Three moments. <span className="text-muted-foreground">Zero administrative bottleneck.</span>
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {STEPS.map(({ n, title, body }, i) => (
          <Reveal key={n} delay={i * 0.1}>
            <div className="rounded-md border border-border bg-card p-6 h-full">
              <span className="text-xl font-bold font-mono text-muted-foreground">
                {n}
              </span>
              <h3 className="mt-2 text-base font-bold text-foreground">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* Privacy manifesto                                                        */
/* ----------------------------------------------------------------------- */

const LIFECYCLE = [
  ["Raw audio", "Deleted the moment transcription completes — even on failure."],
  ["Raw transcript", "Purged in the same write that exports your note."],
  ["Structured note", "The only artifact that persists. Isolated to your clinician account."],
] as const;

function Privacy() {
  return (
    <section id="privacy" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="rounded-md border border-border bg-card p-8 sm:p-12">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            The Aura principle
          </p>
          <blockquote className="mt-4 max-w-3xl text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            We cannot leak what we do not keep.
          </blockquote>
          <p className="mt-4 max-w-2xl text-xs text-muted-foreground sm:text-sm leading-relaxed">
            Therapy transcripts hold sensitive medical words. Aura&apos;s answer isn&apos;t a policy document — it&apos;s an architecture where long-term raw audio retention is impossible.
          </p>
        </Reveal>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {LIFECYCLE.map(([what, fate], i) => (
            <Reveal key={what} delay={0.1 + i * 0.1}>
              <div className="rounded-md border border-border bg-muted/40 p-4">
                <p className="text-xs font-bold text-foreground">{what}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{fate}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- */
/* CTA + footer                                                             */
/* ----------------------------------------------------------------------- */

function CtaBand({ authed }: { authed: boolean }) {
  const screenSize = useScreenSize();
  const finePointer = useFinePointer();

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:px-6">
      <Reveal>
        <div className="glass relative overflow-hidden rounded-[2.5rem] px-6 py-20 text-center sm:px-14">
          {/* Gooey pixel trail: move the cursor and pastel blobs melt away.
              Cursor-driven, so it is desktop-only — on touch it would render a
              full grid of dots that nothing can ever animate. */}
          {finePointer && (
            <>
              <GooeyFilter id="gooey-filter-pixel-trail" strength={5} />
              <div
                aria-hidden
                className="absolute inset-0 z-0"
                style={{ filter: "url(#gooey-filter-pixel-trail)" }}
              >
                <PixelTrail
                  pixelSize={screenSize.lessThan("md") ? 24 : 32}
                  fadeDuration={0}
                  delay={500}
                  pixelClassName="bg-primary/25"
                />
              </div>
            </>
          )}

          <div className="pointer-events-none relative z-10">
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Your evenings back.
              <br />
              <span className="text-gradient">
                Your patients&apos; trust intact.
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-muted-foreground">
              Set up your practice in two minutes. Record your first session
              today.
            </p>
            <Button asChild size="lg" className="pointer-events-auto mt-9">
              <Link href={authed ? "/dashboard" : "/login"}>
                {authed ? "Open your workspace" : "Get started free"}
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-foreground/6">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
        <AuraWordmark className="opacity-80" />
        <p className="text-xs text-muted-foreground">
          Built privacy-first for clinical psychologists.
        </p>
        <nav className="flex items-center gap-5 text-xs text-muted-foreground">
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <Link href="/login" className="transition-colors hover:text-foreground">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------------------- */

export function Landing({ authed }: { authed: boolean }) {
  return (
    <div className="relative">
      <AuroraBackground />
      {/* Ambient butterflies pinned to the viewport so they drift over the hero
          and stay behind content as the page scrolls. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[1] overflow-hidden"
      >
        <Butterfly />
      </div>
      {/* Three more anchored down the page — met on the way down. inset-0 spans
          the full document here (the root is relative), and overflow-hidden
          keeps a wing from ever widening the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-[1] overflow-hidden"
      >
        <ScrollButterflies />
      </div>
      <LandingNav authed={authed} />
      <main>
        <Hero authed={authed} />
        <Features />
        <HowItWorks />
        <Privacy />
        <CtaBand authed={authed} />
      </main>
      <Footer />
    </div>
  );
}
