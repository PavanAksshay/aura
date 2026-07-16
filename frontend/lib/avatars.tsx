/**
 * Rorschach-style avatars: a unique, symmetrical, watercolour inkblot per id.
 * Each blot is generated deterministically from its id — organic ink blobs are
 * drawn on the left half, softly blurred for a watercolour bleed, then mirrored
 * across the centre so the result is perfectly symmetrical. No external service,
 * no network. Gives the profile a mysterious, psychological, artistic feel.
 */

interface InkDef {
  id: string;
  ink: string;
  ink2: string;
}

// Inky, psychological duotones (deep blues, violets, teals, sepias).
const INKS: [string, string][] = [
  ["#37357f", "#6b3fa0"],
  ["#1f6f6a", "#2c5d4f"],
  ["#5b2f6b", "#7a2f5e"],
  ["#2f3e6b", "#3b3a8c"],
  ["#6b3fa0", "#3b6fb0"],
  ["#7a3b2f", "#5b2f2f"],
  ["#22343f", "#2f5d6b"],
  ["#4a2f6b", "#6b2f5b"],
];

const PAPER = "#f4efe3";

export const AVATARS: InkDef[] = Array.from({ length: 20 }, (_, i) => {
  const [ink, ink2] = INKS[i % INKS.length]!;
  return { id: `ink-${String(i + 1).padStart(2, "0")}`, ink, ink2 };
});

export const AVATAR_IDS: string[] = AVATARS.map((a) => a.id);
export const DEFAULT_AVATAR_ID = AVATARS[0]!.id;

function getDef(id: string | null | undefined): InkDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}

/** Deterministic PRNG so each id always yields the same blot. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Pt = [number, number];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** A smooth, wobbly closed blob path around a centre. */
function blob(rng: () => number, cx: number, cy: number, r: number, wobble: number): string {
  const pts = 7 + Math.floor(rng() * 4);
  const coords: Pt[] = [];
  for (let i = 0; i < pts; i += 1) {
    const angle = (i / pts) * Math.PI * 2;
    const rad = r * (1 - wobble + rng() * wobble * 2);
    coords.push([cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad]);
  }
  let d = `M ${mid(coords[pts - 1]!, coords[0]!).map((n) => n.toFixed(1)).join(" ")}`;
  for (let i = 0; i < pts; i += 1) {
    const cur = coords[i]!;
    const m = mid(cur, coords[(i + 1) % pts]!);
    d += ` Q ${cur[0].toFixed(1)} ${cur[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

export function Avatar({
  id,
  className,
}: {
  id: string | null | undefined;
  className?: string;
}) {
  const def = getDef(id);
  const rng = mulberry32(hashId(def.id));
  const leftId = `ink-left-${def.id}`;
  const blurId = `ink-blur-${def.id}`;

  // Left-half ink: a central mass (crosses the axis to fuse with its mirror),
  // a few satellite blobs, and scattered splatter dots.
  const shapes: { d: string; fill: string; op: number }[] = [
    { d: blob(rng, 47, 50, 21, 0.34), fill: def.ink, op: 0.5 },
    { d: blob(rng, 41, 43, 13, 0.42), fill: def.ink2, op: 0.42 },
    { d: blob(rng, 44, 62, 12, 0.42), fill: def.ink2, op: 0.36 },
  ];
  const satellites = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < satellites; i += 1) {
    shapes.push({
      d: blob(rng, 20 + rng() * 28, 24 + rng() * 52, 5 + rng() * 8, 0.5),
      fill: rng() > 0.5 ? def.ink : def.ink2,
      op: 0.32 + rng() * 0.24,
    });
  }
  const dots = Array.from({ length: 3 + Math.floor(rng() * 4) }, () => ({
    cx: 22 + rng() * 26,
    cy: 22 + rng() * 54,
    r: 0.8 + rng() * 2.4,
    op: 0.28 + rng() * 0.3,
  }));

  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="Inkblot avatar" className={className}>
      <defs>
        <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
      </defs>
      <rect width="100" height="100" rx="18" fill={PAPER} />
      <g id={leftId} filter={`url(#${blurId})`}>
        {shapes.map((s, i) => (
          <path key={i} d={s.d} fill={s.fill} opacity={s.op} />
        ))}
        {dots.map((dt, i) => (
          <circle key={`dot-${i}`} cx={dt.cx} cy={dt.cy} r={dt.r} fill={def.ink} opacity={dt.op} />
        ))}
      </g>
      {/* Perfect mirror across the vertical axis → symmetry. */}
      <use href={`#${leftId}`} transform="translate(100,0) scale(-1,1)" />
    </svg>
  );
}
