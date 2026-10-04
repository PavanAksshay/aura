import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conflict resolution (shadcn convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns only the first name from a full name string. */
export function firstName(name: string | null | undefined): string {
  if (!name) return "";
  return name.trim().split(/\s+/)[0] || "";
}

