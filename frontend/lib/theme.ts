/**
 * Theme selection, resolved before first paint.
 *
 * Default is the time of day: dark in the evening/night, light through the day
 * — a scribe used at 10pm shouldn't blast a warm white page at its clinician.
 * An explicit toggle is remembered forever after; until then the theme keeps
 * tracking the clock, so the app is light tomorrow morning again.
 */

export const THEME_STORAGE_KEY = "aura-theme";

/** Dark from 19:00 until 07:00. */
export const DARK_FROM_HOUR = 19;
export const DARK_UNTIL_HOUR = 7;

/**
 * Runs as a blocking inline <script> in <head>, before React and before paint,
 * so the correct theme is on <html> from the very first frame. Kept as a
 * hand-written string because it must not depend on the bundle.
 */
export const themeInitScript = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var s=localStorage.getItem(k);
var t=(s==='light'||s==='dark')?s:(function(){var h=new Date().getHours();return (h>=${DARK_FROM_HOUR}||h<${DARK_UNTIL_HOUR})?'dark':'light';})();
if(t==='dark'){document.documentElement.classList.add('dark');}
document.documentElement.style.colorScheme=t;
}catch(e){}})();`;
