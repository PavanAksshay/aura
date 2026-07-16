/** Patient roster — fetched server-side under RLS. */

import Link from "next/link";
import {
  BrainCircuit,
  CircleDot,
  PauseCircle,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { Patient } from "@/lib/types";
import { PatientsView } from "@/components/patients/PatientsView";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";

export const metadata = { title: "Patients" };

export default async function PatientsPage() {
  const supabase = await createClient();

  const { data: patients, error } = await supabase
    .from("patients")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Patient[]>();

  if (error) {
    return (
      <p className="text-destructive">
        Could not load patients: {error.message}. If you just upgraded, make
        sure migration 0004 has been applied.
      </p>
    );
  }

  const stat = (s: Patient["status"]) =>
    patients.filter((p) => p.status === s).length;

  const tiles = [
    { icon: UsersRound, label: "Total", value: patients.length },
    { icon: CircleDot, label: "Active", value: stat("active") },
    { icon: PauseCircle, label: "Paused", value: stat("paused") },
    { icon: ShieldCheck, label: "Discharged", value: stat("discharged") },
  ];

  return (
    <div>
      <PageHeading
        title="Your"
        accent="patients"
        subtitle="Your roster — isolated to your account by row-level security."
      />

      {patients.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {tiles.map(({ icon, label, value }) => (
            <StatCard key={label} icon={icon} label={label} value={value} />
          ))}
        </div>
      )}

      <PatientsView patients={patients} />

      {/* Practice tips — fills the space below the roster */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="glass-subtle rounded-2xl p-6">
          <BrainCircuit className="mb-3 size-5 text-accent" />
          <p className="font-medium">Link sessions to patients</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Every session you attach to a patient builds their private,
            searchable memory — ask{" "}
            <Link href="/memory" className="text-primary hover:underline">
              Memory
            </Link>{" "}
            anything later.
          </p>
        </div>
        <div className="glass-subtle rounded-2xl p-6">
          <ShieldCheck className="mb-3 size-5 text-primary" />
          <p className="font-medium">Only you can see this</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Row-level security scopes every patient and note to your account —
            no other clinician can read, or even detect, your records.
          </p>
        </div>
      </div>
    </div>
  );
}
