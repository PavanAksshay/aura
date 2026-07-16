"use client";

/**
 * Ambient butterflies that drift and slowly flap their wings behind the
 * content. Pure SVG + CSS transforms (GPU-friendly), low opacity so they read
 * as atmosphere, and fully disabled under prefers-reduced-motion. Wings are
 * painted with the Aura brand gradient.
 */

interface Drift {
  id: string;
  className: string;
  delay: string;
  duration: string;
}

// Two independent drifters: one large and central, one smaller drifting up-right
// on a longer, offset loop so they never move in lockstep.
const BUTTERFLIES: Drift[] = [
  {
    id: "bf-a",
    className: "left-[46%] top-[40%] w-[min(56rem,115vw)] opacity-[0.16]",
    delay: "0s",
    duration: "17s",
  },
  {
    id: "bf-b",
    className: "left-[68%] top-[16%] w-[min(30rem,60vw)] opacity-[0.12]",
    delay: "-8s",
    duration: "23s",
  },
];

// Three more anchored deeper down the page, so they're discovered while
// scrolling instead of all crowding the hero. Offsets are in vh, measured
// against the full page height.
const SCROLL_BUTTERFLIES: Drift[] = [
  {
    id: "bf-c",
    className: "left-[6%] top-[105vh] w-[min(34rem,66vw)] opacity-[0.13]",
    delay: "-4s",
    duration: "20s",
  },
  {
    id: "bf-d",
    className: "left-[62%] top-[192vh] w-[min(46rem,82vw)] opacity-[0.11]",
    delay: "-14s",
    duration: "27s",
  },
  {
    id: "bf-e",
    className: "left-[22%] top-[282vh] w-[min(28rem,56vw)] opacity-[0.12]",
    delay: "-19s",
    duration: "19s",
  },
];

function ButterflySvg({ gradientId }: { gradientId: string }) {
  return (
    <svg viewBox="0 0 400 320" className="h-auto w-full">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--aurora-cyan)" />
          <stop offset="50%" stopColor="var(--aurora-violet)" />
          <stop offset="100%" stopColor="var(--aurora-peach)" />
        </linearGradient>
      </defs>

      {/* Left wing pair — flaps around the body axis (x=200) */}
      <g className="butterfly-wing-left" style={{ transformOrigin: "200px 160px" }}>
        <path
          d="M198 160 C 120 60, 20 70, 40 150 C 10 175, 60 205, 120 195 C 150 190, 185 178, 198 165 Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M198 165 C 150 210, 70 250, 60 205 C 40 235, 110 285, 165 235 C 185 218, 196 190, 198 172 Z"
          fill={`url(#${gradientId})`}
          opacity="0.85"
        />
      </g>

      {/* Right wing pair — mirror */}
      <g className="butterfly-wing-right" style={{ transformOrigin: "200px 160px" }}>
        <path
          d="M202 160 C 280 60, 380 70, 360 150 C 390 175, 340 205, 280 195 C 250 190, 215 178, 202 165 Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M202 165 C 250 210, 330 250, 340 205 C 360 235, 290 285, 235 235 C 215 218, 204 190, 202 172 Z"
          fill={`url(#${gradientId})`}
          opacity="0.85"
        />
      </g>

      {/* Body + antennae */}
      <ellipse cx="200" cy="165" rx="6" ry="46" fill="var(--aurora-violet)" opacity="0.7" />
      <path d="M197 122 C 188 100, 176 92, 168 96" stroke="var(--aurora-violet)" strokeWidth="2.5" fill="none" opacity="0.6" strokeLinecap="round" />
      <path d="M203 122 C 212 100, 224 92, 232 96" stroke="var(--aurora-violet)" strokeWidth="2.5" fill="none" opacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

function Drifters({ set }: { set: Drift[] }) {
  return (
    <>
      {set.map((b) => (
        <div
          key={b.id}
          aria-hidden
          className={`butterfly-float pointer-events-none absolute -z-[1] ${b.className}`}
          style={{ animationDelay: b.delay, animationDuration: b.duration }}
        >
          <ButterflySvg gradientId={`${b.id}-wing`} />
        </div>
      ))}
    </>
  );
}

/** The two hero-level drifters. */
export function Butterfly() {
  return <Drifters set={BUTTERFLIES} />;
}

/**
 * Three further butterflies placed deep in the page. Render inside a clipped,
 * page-height layer (see the landing page) so they appear as you scroll and
 * never widen the document.
 */
export function ScrollButterflies() {
  return <Drifters set={SCROLL_BUTTERFLIES} />;
}
