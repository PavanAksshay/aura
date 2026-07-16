/**
 * Onboarding gate (server side): already-onboarded clinicians bounce to the
 * dashboard; everyone else gets the animated intake flow, prefilled from the
 * auto-provisioned profile row.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { CursorTrail } from "@/components/ui/cursor-trail";
import { AuraWordmark } from "@/components/ui/aura-logo";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Tolerate a pre-0003 schema: if the columns don't exist yet the select
  // errors and we simply render the flow (submitting will surface the issue).
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, clinic_name, onboarded")
    .maybeSingle<{ full_name: string | null; clinic_name: string | null; onboarded: boolean }>();

  if (profile?.onboarded) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <AuroraBackground />
      <CursorTrail />
      <div className="mb-10">
        <AuraWordmark />
      </div>
      <OnboardingFlow
        userId={user.id}
        initialName={profile?.full_name ?? ""}
        initialPractice={profile?.clinic_name ?? ""}
      />
    </main>
  );
}
