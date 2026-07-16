"use client";

/**
 * Create / edit a patient in a right-side glass sheet. Writes go through the
 * browser Supabase client and are therefore constrained by RLS: a clinician
 * can only ever touch their own roster. Deletion is two-step (arm → confirm).
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { Patient, PatientStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

const STATUSES: PatientStatus[] = ["active", "paused", "discharged"];

interface Draft {
  full_name: string;
  pronouns: string;
  date_of_birth: string;
  contact_email: string;
  contact_phone: string;
  presenting_concerns: string;
  status: PatientStatus;
}

function toDraft(p: Patient | null): Draft {
  return {
    full_name: p?.full_name ?? "",
    pronouns: p?.pronouns ?? "",
    date_of_birth: p?.date_of_birth ?? "",
    contact_email: p?.contact_email ?? "",
    contact_phone: p?.contact_phone ?? "",
    presenting_concerns: p?.presenting_concerns ?? "",
    status: p?.status ?? "active",
  };
}

export function PatientSheet({
  open,
  onOpenChange,
  patient,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode */
  patient: Patient | null;
  /** Called after a successful delete (e.g. to navigate away). */
  onDeleted?: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {/* Radix unmounts the portal content when closed, so PatientForm
            mounts fresh (and re-seeds its state) on every open. */}
        <PatientForm
          patient={patient}
          onOpenChange={onOpenChange}
          onDeleted={onDeleted}
        />
      </SheetContent>
    </Sheet>
  );
}

function PatientForm({
  patient,
  onOpenChange,
  onDeleted,
}: {
  patient: Patient | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [draft, setDraft] = useState<Draft>(() => toDraft(patient));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armDelete, setArmDelete] = useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expired — sign in again.");
      setBusy(false);
      return;
    }

    const row = {
      full_name: draft.full_name.trim(),
      pronouns: draft.pronouns.trim() || null,
      date_of_birth: draft.date_of_birth || null,
      contact_email: draft.contact_email.trim() || null,
      contact_phone: draft.contact_phone.trim() || null,
      presenting_concerns: draft.presenting_concerns.trim() || null,
      status: draft.status,
    };

    const query = patient
      ? supabase.from("patients").update(row).eq("id", patient.id)
      : supabase.from("patients").insert({ ...row, user_id: user.id });

    const { error } = await query;
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success(
      patient ? "Patient updated" : "Patient added",
      row.full_name,
    );
    onOpenChange(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!patient) return;
    setBusy(true);
    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", patient.id);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success("Patient deleted", patient.full_name);
    onOpenChange(false);
    if (onDeleted) onDeleted();
    else router.refresh();
  }

  return (
    <>
      <SheetTitle>{patient ? "Edit patient" : "New patient"}</SheetTitle>
      <SheetDescription>
        {patient
          ? "Details are visible only to you."
          : "Add someone to your roster. Details are visible only to you."}
      </SheetDescription>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-1 flex-col gap-5">
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Full name</Label>
          <Input
            id="p-name"
            required
            autoFocus={!patient}
            value={draft.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            placeholder="Maya Sharma"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-pronouns">Pronouns</Label>
            <Input
              id="p-pronouns"
              value={draft.pronouns}
              onChange={(e) => set("pronouns", e.target.value)}
              placeholder="she/her"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-dob">Date of birth</Label>
            <Input
              id="p-dob"
              type="date"
              value={draft.date_of_birth}
              onChange={(e) => set("date_of_birth", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-email">Email</Label>
            <Input
              id="p-email"
              type="email"
              value={draft.contact_email}
              onChange={(e) => set("contact_email", e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-phone">Phone</Label>
            <Input
              id="p-phone"
              type="tel"
              value={draft.contact_phone}
              onChange={(e) => set("contact_phone", e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-concerns">Presenting concerns</Label>
          <Textarea
            id="p-concerns"
            value={draft.presenting_concerns}
            onChange={(e) => set("presenting_concerns", e.target.value)}
            placeholder="Initial reasons for seeking therapy…"
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
          {patient ? (
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
          <Button type="submit" disabled={busy || !draft.full_name.trim()}>
            {busy && <Loader2 className="animate-spin" />}
            {patient ? "Save changes" : "Add patient"}
          </Button>
        </div>
      </form>
    </>
  );
}
