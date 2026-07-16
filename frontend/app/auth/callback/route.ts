/** Exchanges the Supabase auth code (email confirm / magic link) for a session. */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Existing (onboarded) clinicians land on the public landing page; new
      // accounts (e.g. first Google sign-in) go to onboarding.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let destination = "/onboarding";
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarded")
          .eq("id", user.id)
          .maybeSingle<{ onboarded: boolean }>();
        destination = profile?.onboarded ? "/" : "/onboarding";
      }
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
