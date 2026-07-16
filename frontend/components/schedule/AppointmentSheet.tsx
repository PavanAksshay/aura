"use client";

/**
 * Create / edit an appointment in a right-side glass sheet. Writes go through
 * the browser Supabase client and are constrained by RLS: a clinician can only
 * ever touch their own calendar. Deletion is two-step (arm → confirm).
 *
 * The DB stores start/end as timestamptz; the form edits them as a single date
 * plus two wall-clock times, converting to/from the browser's local zone.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

const STATUSES: AppointmentStatus[] = ["scheduled", "completed", "cancelled"];

// 15-minute time slots for the whole day, shown in 12-hour form.
const TIME_SLOTS: { value: string; label: string }[] = Array.from(
  { length: 24 * 4 },
  (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const p = (n: number) => String(n).padStart(2, "0");
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return {
      value: `${p(h)}:${p(m)}`,
      label: `${hour12}:${p(m)} ${h < 12 ? "AM" : "PM"}`,
    };
  },
);

/** Include an off-grid time (e.g. a legacy :50) so it stays selectable. */
function slotsWith(current: string): { value: string; label: string }[] {
  if (!current || TIME_SLOTS.some((s) => s.value === current)) return TIME_SLOTS;
  return [{ value: current, label: current }, ...TIME_SLOTS];
}

export interface RosterOption {
  id: string;
  full_name: string;
}

interface Draft {
  title: string;
  patient_id: string; // "" = unattributed
  date: string; // yyyy-mm-dd (local)
  start_time: string; // HH:mm (local)
  end_time: string; // HH:mm (local)
  location: string;
  notes: string;
  status: AppointmentStatus;
}

/** Local wall-clock parts of an ISO timestamp, for seeding date/time inputs. */
function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Sensible defaults for a new appointment: next full hour, one hour long. */
function defaultDraft(patientId: string | null): Draft {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const start = localParts(now.toISOString());
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    title: "Therapy session",
    patient_id: patientId ?? "",
    date: start.date,
    start_time: start.time,
    end_time: localParts(end.toISOString()).time,
    location: "",
    notes: "",
    status: "scheduled",
  };
}

function toDraft(a: Appointment | null, patientId: string | null): Draft {
  if (!a) return defaultDraft(patientId);
  const start = localParts(a.starts_at);
  const end = localParts(a.ends_at);
  return {
    title: a.title,
    patient_id: a.patient_id ?? "",
    date: start.date,
    start_time: start.time,
    end_time: end.time,
    location: a.location ?? "",
    notes: a.notes ?? "",
    status: a.status,
  };
}

/** Combine a local date + time into a UTC ISO string, or null if incomplete. */
function toIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function AppointmentSheet({
  open,
  onOpenChange,
  appointment,
  patients,
  defaultPatientId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode */
  appointment: Appointment | null;
  patients: RosterOption[];
  /** Pre-selected patient when creating from a profile page. */
  defaultPatientId?: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {/* Radix unmounts on close, so the form re-seeds on every open. */}
        <AppointmentForm
          appointment={appointment}
          patients={patients}
          defaultPatientId={defaultPatientId}
          onOpenChange={onOpenChange}
        />
      </SheetContent>
    </Sheet>
  );
}

function AppointmentForm({
  appointment,
  patients,
  defaultPatientId,
  onOpenChange,
}: {
  appointment: Appointment | null;
  patients: RosterOption[];
  defaultPatientId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [draft, setDraft] = useState<Draft>(() =>
    toDraft(appointment, defaultPatientId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armDelete, setArmDelete] = useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const startsAt = toIso(draft.date, draft.start_time);
    const endsAt = toIso(draft.date, draft.end_time);
    if (!startsAt || !endsAt) {
      setError("Pick a date, start time, and end time.");
      return;
    }
    if (endsAt < startsAt) {
      setError("The end time can't be before the start time.");
      return;
    }

    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired — sign in again.");
      setBusy(false);
      return;
    }

    const row = {
      title: draft.title.trim() || "Appointment",
      patient_id: draft.patient_id || null,
      starts_at: startsAt,
      ends_at: endsAt,
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
      status: draft.status,
    };

    const query = appointment
      ? supabase.from("appointments").update(row).eq("id", appointment.id)
      : supabase.from("appointments").insert({ ...row, user_id: user.id });

    const { error } = await query;
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success(
      appointment ? "Appointment updated" : "Appointment scheduled",
      row.title,
    );
    onOpenChange(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!appointment) return;
    setBusy(true);
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", appointment.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success("Appointment removed", appointment.title);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <>
      <SheetTitle>
        {appointment ? "Edit appointment" : "New appointment"}
      </SheetTitle>
      <SheetDescription>
        Only you can see this. Times use your device&rsquo;s time zone.
      </SheetDescription>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-1 flex-col gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="a-title">Title</Label>
          <Input
            id="a-title"
            required
            autoFocus={!appointment}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Therapy session"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="a-patient">Patient</Label>
          <Select
            value={draft.patient_id || "none"}
            onValueChange={(v) => set("patient_id", v === "none" ? "" : v)}
          >
            <SelectTrigger id="a-patient">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No patient (unattributed)</SelectItem>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="a-date">Date</Label>
          <DateField
            id="a-date"
            value={draft.date}
            onChange={(v) => set("date", v)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="a-start">Start</Label>
            <Select
              value={draft.start_time}
              onValueChange={(v) => set("start_time", v)}
            >
              <SelectTrigger id="a-start">
                <SelectValue placeholder="Start" />
              </SelectTrigger>
              <SelectContent>
                {slotsWith(draft.start_time).map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-end">End</Label>
            <Select
              value={draft.end_time}
              onValueChange={(v) => set("end_time", v)}
            >
              <SelectTrigger id="a-end">
                <SelectValue placeholder="End" />
              </SelectTrigger>
              <SelectContent>
                {slotsWith(draft.end_time).map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="a-location">Location</Label>
          <Input
            id="a-location"
            value={draft.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Room 2 · Video call · optional"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="a-notes">Notes</Label>
          <Textarea
            id="a-notes"
            value={draft.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Anything to prepare or remember…"
          />
        </div>

        <div className="space-y-2.5">
          <Label>Status</Label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Chip
                key={s}
                selected={draft.status === s}
                onClick={() => set("status", s)}
                className="capitalize"
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          {appointment ? (
            armDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={busy}
              >
                Confirm delete
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setArmDelete(true)}
                disabled={busy}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 />
                Delete
              </Button>
            )
          ) : (
            <span />
          )}
          <Button type="submit" disabled={busy || !draft.title.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            {appointment ? "Save changes" : "Schedule"}
          </Button>
        </div>
      </form>
    </>
  );
}
