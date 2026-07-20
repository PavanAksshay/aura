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
align-items:center;justify-content:center;gap:1.5rem;background:#f7efe6;
opacity:1;transition:opacity .45s ease;}
html.dark .aura-splash{background:#101817;}
.aura-splash[data-hidden="true"]{opacity:0;pointer-events:none;}
.aura-splash__brand{display:flex;align-items:center;gap:.65rem;}
.aura-splash__mark{width:44px;height:44px;}
.aura-splash__word{font-family:var(--font-sora),ui-sans-serif,system-ui,-apple-system,sans-serif;
font-weight:700;font-size:2rem;line-height:1;letter-spacing:-.03em;text-transform:lowercase;
background:linear-gradient(120deg,oklch(.6 .12 180),oklch(.6 .11 220),oklch(.55 .17 295));
-webkit-background-clip:text;background-clip:text;color:transparent;}
html.dark .aura-splash__word{
background:linear-gradient(120deg,oklch(.7 .12 180),oklch(.68 .12 220),oklch(.68 .17 295));
-webkit-background-clip:text;background-clip:text;}
.aura-splash__spinner{width:30px;height:30px;border-radius:9999px;
border:3px solid oklch(.6 .12 180 / .18);border-top-color:oklch(.6 .12 180);
animation:aura-splash-spin .8s linear infinite;}
html.dark .aura-splash__spinner{border-color:oklch(.7 .12 180 / .2);border-top-color:oklch(.7 .12 180);}
@keyframes aura-splash-spin{to{transform:rotate(360deg);}}
@media (prefers-reduced-motion:reduce){
.aura-splash__spinner{animation:none;}
.aura-splash{transition:opacity .15s ease;}}
`;
