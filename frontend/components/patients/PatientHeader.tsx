"use client";

/**
 * Profile header card with the edit sheet wired in. Deleting from here
 * navigates back to the roster (the profile page no longer exists).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Mail, Mic, Pencil, Phone } from "lucide-react";

import type { Patient } from "@/lib/types";
import { Badge, PATIENT_STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/primitives";
import { PatientSheet } from "@/components/patients/PatientSheet";

function formatDob(dob: string | null): string | null {
  if (!dob) return null;
  return new Date(dob).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PatientHeader({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);

  const facts = [
    { icon: CalendarDays, value: formatDob(patient.date_of_birth) },
    { icon: Mail, value: patient.contact_email },
    { icon: Phone, value: patient.contact_phone },
  ].filter((f) => f.value);

  return (
    <FadeIn>
      <div className="glass rounded-3xl p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {patient.full_name}
              </h1>
              {patient.pronouns && (
                <span className="text-sm text-muted-foreground">
                  {patient.pronouns}
                </span>
              )}
              <Badge tone={PATIENT_STATUS_TONE[patient.status]}>
                {patient.status}
              </Badge>
            </div>

            {facts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                {facts.map(({ icon: Icon, value }) => (
                  <span key={value} className="inline-flex items-center gap-1.5">
                    <Icon className="size-3.5" />
                    {value}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
              <Pencil />
              Edit
            </Button>
            <Button asChild size="sm">
              <Link href={`/sessions/new?patient=${patient.id}`}>
                <Mic />
                Record session
              </Link>
            </Button>
          </div>
        </div>

        {patient.presenting_concerns && (
          <div className="mt-5 rounded-2xl border border-foreground/8 bg-foreground/3 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Presenting concerns
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">
              {patient.presenting_concerns}
            </p>
          </div>
        )}
      </div>

      <PatientSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        patient={patient}
        onDeleted={() => router.push("/patients")}
      />
    </FadeIn>
  );
}
