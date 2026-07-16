import { cn } from "@/lib/utils";
import type {
  AppointmentStatus,
  PatientStatus,
  SessionStatus,
} from "@/lib/types";

const TONES = {
  primary: "bg-primary/15 text-primary",
  amber: "bg-amber-500/15 text-amber-700",
  muted: "bg-foreground/8 text-muted-foreground",
  destructive: "bg-destructive/15 text-destructive",
  accent: "bg-accent/15 text-accent-foreground",
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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
