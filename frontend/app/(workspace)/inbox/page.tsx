/**
 * The Inbox tab. Two audiences, one route:
 *  - the operator sees every check-in message with reply boxes;
 *  - the check-in user sees only her own conversation with Aura (she never
 *    learns a human is on the other side).
 * Everyone else gets a 404, and the backend enforces the same split.
 */

import { redirect } from "next/navigation";

export default function InboxPage() {
  redirect("/dashboard");
}
