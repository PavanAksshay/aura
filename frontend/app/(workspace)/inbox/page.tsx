/**
 * The Inbox tab. Two audiences, one route:
 *  - the operator sees every check-in message with reply boxes;
 *  - the check-in user sees only her own conversation with Aura (she never
 *    learns a human is on the other side).
 * Everyone else gets a 404, and the backend enforces the same split.
 */

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/owner";
import { isCheckinEmail } from "@/lib/checkin-user";
import { PageHeading } from "@/components/ui/page-heading";
import { InboxClient } from "@/components/checkin/InboxClient";
import { MyThread } from "@/components/checkin/MyThread";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const owner = isOwnerEmail(user?.email);
  const her = isCheckinEmail(user?.email);
  if (!owner && !her) notFound();

  return (
    <div>
      {owner ? (
        <>
          <PageHeading
            title="Your"
            accent="inbox"
            subtitle="Daily check-in messages. Reply and they're notified right away."
          />
          <div className="mt-8">
            <InboxClient />
          </div>
        </>
      ) : (
        <>
          <PageHeading
            title="Your"
            accent="messages"
            subtitle="Your notes to Aura, and Aura's replies."
          />
          <div className="mt-8">
            <MyThread />
          </div>
        </>
      )}
    </div>
  );
}
