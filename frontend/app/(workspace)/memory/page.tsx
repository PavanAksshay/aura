/** Patient Memory — persistent per-patient Q&A chats over your exported notes. */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { MemoryChat, Patient } from "@/lib/types";
import { MemorySearch } from "@/components/memory/MemorySearch";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata = { title: "Memory" };

export default async function MemoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [patientsQ, chatsQ] = await Promise.all([
    supabase
      .from("patients")
      .select("id, full_name")
      .order("full_name")
      .returns<Pick<Patient, "id" | "full_name">[]>(),
    // Errors (e.g. migration 0015 not applied yet) degrade to an empty list;
    // the first send will surface the real error as a toast.
    supabase
      .from("memory_chats")
      .select("*")
      .order("updated_at", { ascending: false })
      .returns<MemoryChat[]>(),
  ]);

  return (
    <div>
      <PageHeading
        title="Patient"
        accent="Memory"
        subtitle="Ask in plain language, keep the conversation, and come back to it — every answer is drawn only from your own notes."
      />

      <MemorySearch
        userId={user.id}
        patients={patientsQ.data ?? []}
        initialChats={chatsQ.data ?? []}
      />
    </div>
  );
}
