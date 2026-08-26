import { cn } from "@/lib/utils";
import type {
  AppointmentStatus,
  PatientStatus,
  SessionStatus,
} from "@/lib/types";

const TONES = {
  primary: "bg-primary/10 text-primary border-primary/30",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  muted: "bg-muted text-muted-foreground border-border",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  accent: "bg-secondary text-secondary-foreground border-border",
} as const;

type Tone = keyof typeof TONES;

export const PATIENT_STATUS_TONE: Record<PatientStatus, Tone> = {
  active: "primary",
  paused: "amber",
  discharged: "muted",
};

export const SESSION_STATUS_TONE: Record<SessionStatus, Tone> = {
  processing: "amber",
  ready: "primary",
  exported: "muted",
  failed: "destructive",
};

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  processing: "processing",
  ready: "ready",
  exported: "completed",
  failed: "failed",
};

export const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, Tone> = {
  scheduled: "primary",
  completed: "muted",
  cancelled: "destructive",
};

export function Badge({
  tone = "muted",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
