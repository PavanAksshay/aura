/**
 * Fixed full-viewport aurora backdrop: three slowly drifting gradient blobs
 * over a faint dot grid. Pure CSS animation (transform/opacity only) so it
 * costs nothing on the main thread and respects prefers-reduced-motion.
 */
export function AuroraBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora-grid" />
      <div className="aurora-blob aurora-blob-a left-[-10%] top-[-15%] h-[55vh] w-[55vw]" />
      <div className="aurora-blob aurora-blob-b right-[-15%] top-[10%] h-[60vh] w-[50vw]" />
      <div className="aurora-blob aurora-blob-c bottom-[-20%] left-[20%] h-[50vh] w-[55vw]" />
      {/* Vignette keeps edges dark so glass panels stay legible */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--background)_90%)]" />
    </div>
  );
}
