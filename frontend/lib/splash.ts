/**
 * Critical CSS for the app splash, kept as a string so it can be inlined in
 * <head> and take effect on the very first paint — before the JS bundle, the
 * CSS bundle, or React. Same reasoning as the theme-init script: a loading
 * screen that only appears after the bundle loads has missed the moment it
 * exists for (a cold PWA launch, a slow phone), when the screen is otherwise
 * blank.
 *
 * Themed via the `dark` class the theme-init script has already put on <html>,
 * so the splash matches the resolved theme from frame one. Background colours
 * match the PWA manifest (#f7efe6) and the dark theme-color (#101817), so the
 * OS splash hands off to this one seamlessly with no flash.
 */
export const SPLASH_STYLE = `
.aura-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
align-items:center;justify-content:center;gap:1.25rem;background:#ffffff;
opacity:1;transition:opacity .3s ease;}
html.dark .aura-splash{background:#09090b;}
.aura-splash[data-hidden="true"]{opacity:0;pointer-events:none;}
.aura-splash__brand{display:flex;align-items:center;gap:.5rem;}
.aura-splash__mark{width:36px;height:36px;}
.aura-splash__word{font-family:var(--font-inter),ui-sans-serif,system-ui,-apple-system,sans-serif;
font-weight:700;font-size:1.75rem;line-height:1;letter-spacing:-.03em;text-transform:lowercase;
color:#09090b;}
html.dark .aura-splash__word{color:#f8fafc;}
.aura-splash__spinner{width:24px;height:24px;border-radius:9999px;
border:2px solid #e2e8f0;border-top-color:#0f172a;
animation:aura-splash-spin .7s linear infinite;}
html.dark .aura-splash__spinner{border-color:#27272a;border-top-color:#f8fafc;}
@keyframes aura-splash-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){
.aura-splash__spinner{animation:none;}
.aura-splash{transition:opacity .15s ease;}}
`;
