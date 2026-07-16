/** Patient Memory — ask questions, get specific answers over your exported notes. */

import { createClient } from "@/lib/supabase/server";
import type { Patient } from "@/lib/types";
import { MemorySearch } from "@/components/memory/MemorySearch";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata = { title: "Memory" };

export default async function MemoryPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("patients")
    .select("id, full_name")
    .order("full_name")
    .returns<Pick<Patient, "id" | "full_name">[]>();

  return (
    <div>
      <PageHeading
        title="Patient"
        accent="Memory"
        subtitle="Ask in plain language and get a specific answer, drawn only from your own exported notes. Nothing ever leaves your practice."
      />

      <MemorySearch patients={data ?? []} />
    </div>
  );
}
