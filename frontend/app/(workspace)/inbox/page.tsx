/** Operator-only inbox for daily check-in messages. */

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { PageHeading } from "@/components/ui/page-heading";
import { InboxClient } from "@/components/checkin/InboxClient";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Visibility gate only — the backend independently rejects non-owner calls.
  if (!isOwnerEmail(user?.email)) notFound();

  return (
    <div>
      <PageHeading
        title="Your"
        accent="inbox"
        subtitle="Daily check-in messages. Reply and they're notified right away."
      />
      <div className="mt-8">
        <InboxClient />
      </div>
    </div>
  );
}
