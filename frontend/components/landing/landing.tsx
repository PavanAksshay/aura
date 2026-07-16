"use client";

/**
 * Aura marketing page. Design language borrowed from the best of the current
 * web (Linear's restraint, Stripe's typographic scale, Vercel's bento grids):
 * one display statement per viewport, generous whitespace, scroll-triggered
 * reveals, and a live WebGL centerpiece. Every claim on this page is true of
 * the product — no invented logos, numbers, or testimonials.
 */

import { useEffect } from "react";
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
import { renderCanvas } from "@/components/ui/canvas";
import { GooeyFilter } from "@/components/ui/gooey-filter";
import { PixelTrail } from "@/components/ui/pixel-trail";
import { useScreenSize } from "@/hooks/use-screen-size";
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

function LandingNav({ authed }: { authed: boolean }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <nav className="glass-subtle mx-auto mt-4 flex w-[min(72rem,calc(100%-2rem))] items-center justify-between rounded-2xl px-5 py-3">
        <Link href="/" aria-label="Aura home">
          <AuraWordmark />
        </Link>
        <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
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
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {authed ? (
            <Button asChild size="sm">
              <Link href="/dashboard">
                Open workspace
                <ArrowRight />
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
                  <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </motion.header>
  );
}

/* ----------------------------------------------------------------------- */
/* Hero                                                                     */
/* ----------------------------------------------------------------------- */

function Hero({ authed }: { authed: boolean }) {
  // Flowing cursor-trail across the hero (vendored 21st.dev effect).
  useEffect(() => {
    renderCanvas();
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-24">
      <canvas
        id="canvas"
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-[1] h-full w-full"
      />
      {/* WebGL orb sits behind the copy, masked so text stays legible */}
      <HeroOrb className="pointer-events-none absolute left-1/2 top-1/2 size-[min(120vw,54rem)] -translate-x-1/2 -translate-y-1/2 opacity-80 [mask-image:radial-gradient(circle,black_30%,transparent_72%)]" />

      <div className="relative z-10 flex max-w-4xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="glass-subtle inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          Private by architecture — not by policy
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
          className="mt-8 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
        >
          Sessions become notes.
          <br />
          <span className="text-gradient">Voices stay in the room.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.22 }}
          className="mt-6 max-w-xl text-balance text-lg text-muted-foreground"
        >
          Aura listens to your therapy sessions and drafts the clinical note —
          with every word transcribed on your own infrastructure and the raw
          audio destroyed the moment it&apos;s done.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.34 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg">
            <Link href={authed ? "/dashboard" : "/login"}>
              {authed ? "Open your workspace" : "Start writing less"}
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <a href="#how">See how it works</a>
          </Button>
        </motion.div>

        {/* Truthful trust strip — architecture facts, not vanity metrics */}
        <motion.dl
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-16 grid grid-cols-3 gap-8 text-center"
        >
          {[
            ["0", "recordings retained"],
            ["100%", "on-device transcription"],
            ["1", "artifact persists: your note"],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                {value}
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</dd>
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
    <div className="flex h-16 items-end gap-1.5" aria-hidden>
      {[0.4, 0.7, 1, 0.55, 0.85, 0.35, 0.9, 0.6, 0.75, 0.45, 1, 0.65].map(
        (h, i) => (
          <motion.span
            key={i}
            className="w-2 origin-bottom rounded-full bg-linear-to-t from-aurora-teal to-aurora-cyan"
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

const SAMPLE_NOTE: { letter: string; label: string; text: string }[] = [
  {
    letter: "S",
    label: "Subjective",
    text: "Reports work-related anxiety; sleep disrupted 4–5 nights this week.",
  },
  {
    letter: "O",
    label: "Objective",
    text: "Alert and cooperative; affect mildly anxious, speech normal rate.",
  },
  {
    letter: "A",
    label: "Assessment",
    text: "Generalized anxiety, moderate. Responding to CBT; insight improving.",
  },
  {
    letter: "P",
    label: "Plan",
    text: "Continue weekly CBT + sleep-hygiene plan. Review in two weeks.",
  },
];

function SoapSkeleton() {
  return (
    <div className="space-y-2">
      {SAMPLE_NOTE.map(({ letter, label, text }, i) => (
        <motion.div
          key={letter}
          className="flex items-start gap-3 rounded-xl bg-foreground/[0.03] px-3 py-2"
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.15 + i * 0.12 }}
        >
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 font-display text-xs font-semibold text-primary">
            {letter}
          </span>
          <p className="text-sm leading-snug text-foreground/75">
            <span className="font-medium text-foreground/90">{label}. </span>
            {text}
          </p>
        </motion.div>
      ))}
    </div>
  );
}

const FEATURES = [
  {
    icon: AudioLines,
    title: "Ambient scribe",
    body: "Record the session and stay present. Aura transcribes with Whisper running inside your own backend — no speech API, no cloud vendor, no transcript ever leaving your infrastructure.",
    span: "md:col-span-7",
    visual: <Waveform />,
  },
  {
    icon: FileText,
    title: "Structured notes, instantly",
    body: "Every session becomes a clean SOAP draft you review, edit, and own.",
    span: "md:col-span-5",
    visual: <SoapSkeleton />,
  },
  {
    icon: Timer,
    title: "Ephemeral by design",
    body: "Raw audio is deleted the moment transcription finishes — success or failure. The unedited transcript is purged in the same database write that exports your note. There is nothing left to breach.",
    span: "md:col-span-5",
    visual: null,
  },
  {
    icon: BrainCircuit,
    title: "Patient memory",
    body: "Every exported note is indexed into a private semantic memory. Ask “how has Maya's sleep changed since March?” and Aura recalls the answer from your own notes — computed locally, stored under row-level isolation.",
    span: "md:col-span-7",
    visual: (
      <div className="flex flex-wrap gap-2" aria-hidden>
        {["sleep ↓ then ↑", "started CBT-i", "fewer nightmares", "meds unchanged"].map(
          (chip, i) => (
            <motion.span
              key={chip}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 + i * 0.1, duration: 0.4, ease: EASE_OUT }}
              className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent-foreground/90"
            >
              {chip}
            </motion.span>
          ),
        )}
      </div>
    ),
  },
] as const;

function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-28 sm:px-6">
      <Reveal className="max-w-2xl">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Built for the fifty minutes,
          <br />
          <span className="text-gradient">not the paperwork after.</span>
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-12">
        {FEATURES.map(({ icon: Icon, title, body, span, visual }, i) => (
          <Reveal key={title} delay={i * 0.06} className={span}>
            <div className="glass group flex h-full flex-col justify-between gap-6 rounded-3xl p-7 transition-colors duration-300 hover:border-primary/25">
              <div>
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
              {visual}
            </div>
          </Reveal>
        ))}
      </div>

      {/* Security strip */}
      <Reveal delay={0.1} className="mt-4">
        <div className="glass-subtle grid gap-6 rounded-3xl p-7 sm:grid-cols-3">
          {[
            [ShieldCheck, "Row-level isolation", "Postgres RLS scopes every row to its clinician — enforced by the database, not the app."],
            [Fingerprint, "Verified on every request", "The backend cryptographically verifies your identity token before touching any data."],
            [BrainCircuit, "No third-party AI", "Transcription and memory embeddings are computed in-process. No OpenAI, no data-sharing DPA needed."],
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="flex gap-3">
                <I className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">{title as string}</p>
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
    body: "One tap when the session starts. A live waveform confirms Aura is listening — and that nothing has left the device yet.",
  },
  {
    n: "02",
    title: "Review",
    body: "Minutes later, a structured SOAP draft is waiting. Edit it like a document; the raw transcript stays visible until you're done.",
  },
  {
    n: "03",
    title: "Export & purge",
    body: "Exporting copies the note out and permanently destroys the raw transcript in the same instant. The note is all that remains.",
  },
] as const;

function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-28 sm:px-6">
      <Reveal className="max-w-2xl">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Three moments. <span className="text-gradient">Zero admin evenings.</span>
        </h2>
      </Reveal>

      <div className="mt-14 grid gap-10 md:grid-cols-3">
        {STEPS.map(({ n, title, body }, i) => (
          <Reveal key={n} delay={i * 0.12}>
            <div className="relative">
              <span className="font-display text-6xl font-semibold text-gradient opacity-90">
                {n}
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
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
  ["Structured note", "The only artifact that persists. Isolated to you."],
] as const;

function Privacy() {
  return (
    <section id="privacy" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-28 sm:px-6">
      <div className="glass relative overflow-hidden rounded-[2.5rem] px-7 py-16 sm:px-14">
        {/* quiet gradient wash inside the panel */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full bg-[radial-gradient(circle,oklch(0.6_0.19_295_/_18%),transparent_70%)]"
        />
        <Reveal>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
            The Aura principle
          </p>
          <blockquote className="mt-6 max-w-3xl font-display text-3xl font-semibold leading-snug tracking-tight sm:text-5xl">
            We can&apos;t leak
            <span className="text-gradient"> what we don&apos;t keep.</span>
          </blockquote>
          <p className="mt-6 max-w-2xl text-muted-foreground">
            Therapy transcripts hold the most sensitive words a person ever
            says. Aura&apos;s answer isn&apos;t a privacy policy — it&apos;s an
            architecture in which retention is impossible.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {LIFECYCLE.map(([what, fate], i) => (
            <Reveal key={what} delay={0.1 + i * 0.1}>
              <div className="rounded-2xl border border-foreground/8 bg-foreground/3 p-5">
                <p className="font-display text-sm font-semibold text-foreground">{what}</p>
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

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4 sm:px-6">
      <Reveal>
        <div className="glass relative overflow-hidden rounded-[2.5rem] px-6 py-20 text-center sm:px-14">
          {/* Gooey pixel trail: move the cursor and pastel blobs melt away */}
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
