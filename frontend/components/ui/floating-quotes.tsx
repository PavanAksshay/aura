"use client";

/**
 * Ambient, slowly drifting psychology quotes scattered behind the content.
 * Low-opacity, italic, non-interactive; each drifts on its own gentle loop.
 * Hidden on small screens (no room) and under prefers-reduced-motion.
 */

// Four quotes, each anchored in a different corner and set on its own broad,
// slow roaming orbit. Anchors + orbits are chosen so their paths stay apart —
// they wander the whole backdrop without ever bunching up.
// Anchored low and to the outer edges — deliberately away from the top-left
// heading zone — and kept very faint, so they read as roaming atmosphere
// behind the content rather than text competing with it.
const QUOTES: { text: string; author: string; className: string; delay: string }[] = [
  {
    text: "“Between stimulus and response there is a space… in that space is our power to choose.”",
    author: "Viktor Frankl",
    className: "left-[2%] top-[52%] max-w-[12rem] quote-drift-a",
    delay: "0s",
  },
  {
    text: "“The curious paradox is that when I accept myself just as I am, then I can change.”",
    author: "Carl Rogers",
    className: "right-[2%] top-[40%] max-w-[13rem] quote-drift-d",
    delay: "-16s",
  },
  {
    text: "“What is most personal is most universal.”",
    author: "Carl Rogers",
    className: "left-[3%] bottom-[8%] max-w-[11rem] quote-drift-c",
    delay: "-30s",
  },
  {
    text: "“Until you make the unconscious conscious, it will direct your life and you will call it fate.”",
    author: "Carl Jung",
    className: "right-[3%] bottom-[10%] max-w-[13rem] quote-drift-b",
    delay: "-44s",
  },
];

export function FloatingQuotes() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-[1] hidden overflow-hidden lg:block">
      {QUOTES.map((q) => (
        <figure
          key={q.author + q.text.slice(0, 12)}
          className={`absolute ${q.className}`}
          style={{ animationDelay: q.delay }}
        >
          <blockquote className="font-display text-[0.85rem] italic leading-relaxed text-foreground/22">
            {q.text}
          </blockquote>
          <figcaption className="mt-1 text-xs font-medium text-primary/40">
            — {q.author}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
