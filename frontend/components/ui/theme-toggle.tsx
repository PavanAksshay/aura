"use client";

/**
 * Light/dark switch.
 *
 * Deliberately stateless: the current theme lives on <html class="dark">, and
 * the two icons are shown/hidden with CSS. That means nothing here depends on
 * client state, so there's no hydration mismatch and no flash — the inline
 * script in the root layout has already picked the theme before first paint.
 *
 * Writing to localStorage only happens on an explicit toggle. Until then the
 * theme keeps following the time of day.
 */

import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";
import { THEME_STORAGE_KEY } from "@/lib/theme";

export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    root.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the toggle still works for this session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Switch between light and dark"
      aria-label="Switch between light and dark theme"
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground",
        className,
      )}
    >
      {/* Each icon advertises the theme you'd switch *to*. */}
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
