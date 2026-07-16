/**
 * Public marketing page. Signed-in clinicians see "Open workspace" CTAs
 * instead of being force-redirected — the landing is part of the product.
 */

import { createClient } from "@/lib/supabase/server";
import { Landing } from "@/components/landing/landing";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <Landing authed={Boolean(user)} />;
}
