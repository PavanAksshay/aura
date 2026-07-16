"use client";

/**
 * Themed date picker: a trigger styled like our inputs that opens a glass
 * popover with a month calendar. Works in "yyyy-mm-dd" strings (local), so it
 * drops in where a native <input type="date"> was used — but matches the theme.
 */

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Impure clock reads kept out of the render body (react-hooks/purity).
function todayDate(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseYmd(v: string): Date | null {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function initialView(selected: Date | null): Date {
  return startOfMonth(selected ?? todayDate());
}

function monthCells(view: Date): (Date | null)[] {
  const startWeekday = startOfMonth(view).getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: startWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  }
  return cells;
}

const labelFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function DateField({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  /** Selectable year range for the year picker. Defaults around today. */
  fromYear,
  toYear,
  /** Latest selectable date ("yyyy-mm-dd") — later days are disabled. */
  max,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fromYear?: number;
  toYear?: number;
  max?: string;
}) {
  const selected = value ? parseYmd(value) : null;
  const today = todayDate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => initialView(selected));
  // Tapping the month/year label swaps the grid for a year picker — without it,
  // reaching a birth year would take a click per month.
  const [pickingYear, setPickingYear] = useState(false);

  const selectedYmd = selected ? toYmd(selected) : "";
  const todayYmd = toYmd(today);
  const firstYear = fromYear ?? today.getFullYear() - 5;
  const lastYear = toYear ?? today.getFullYear() + 5;
  const years = Array.from(
    { length: Math.max(1, lastYear - firstYear + 1) },
    (_, i) => lastYear - i, // newest first: birth years and appointments both read down
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPickingYear(false);
      }}
    >
      <PopoverTrigger
        id={id}
        className="flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-input px-4 text-sm text-foreground transition-all duration-200 outline-none focus-visible:border-primary/60 focus-visible:ring-glow"
      >
        <span className={selected ? "" : "text-muted-foreground/60"}>
          {selected ? labelFmt.format(selected) : placeholder}
        </span>
        <CalendarDays className="size-4 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent className="w-[17rem]">
        <div className="mb-2 flex items-center justify-between px-1">
          <button
            type="button"
            aria-label="Previous month"
            disabled={pickingYear}
            onClick={() => setView((v) => addMonths(v, -1))}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground disabled:invisible"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setPickingYear((p) => !p)}
            aria-label="Choose year"
            className="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 font-display text-sm font-semibold transition-colors hover:bg-foreground/8"
          >
            {MONTHS[view.getMonth()]} {view.getFullYear()}
            <ChevronDown
              className={cn(
                "size-3.5 opacity-60 transition-transform",
                pickingYear && "rotate-180",
              )}
            />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={pickingYear}
            onClick={() => setView((v) => addMonths(v, 1))}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground disabled:invisible"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {pickingYear ? (
          <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto pr-1">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => {
                  setView((v) => new Date(year, v.getMonth(), 1));
                  setPickingYear(false);
                }}
                className={cn(
                  "flex h-8 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                  year === view.getFullYear()
                    ? "bg-primary font-medium text-primary-foreground"
                    : "hover:bg-foreground/8",
                )}
              >
                {year}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w, i) => (
              <div
                key={i}
                className="flex h-7 items-center justify-center text-xs font-medium text-muted-foreground"
              >
                {w}
              </div>
            ))}
            {monthCells(view).map((day, i) => {
              if (!day) return <div key={i} />;
              const ymd = toYmd(day);
              const isSelected = ymd === selectedYmd;
              const isToday = ymd === todayYmd;
              const disabled = max !== undefined && ymd > max;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(ymd);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                    isSelected
                      ? "bg-primary font-medium text-primary-foreground"
                      : "hover:bg-foreground/8",
                    !isSelected && isToday && "font-semibold text-primary ring-1 ring-primary/40",
                    disabled && "pointer-events-none opacity-30",
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
