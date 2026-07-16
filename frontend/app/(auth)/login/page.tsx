"use client";

/**
 * Aura sign-in / sign-up. Email + password and Google OAuth via Supabase.
 * The Google provider must be enabled in the Supabase dashboard
 * (Authentication → Providers → Google) before that path works.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mail, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { CursorTrail } from "@/components/ui/cursor-trail";
import { AuraMark } from "@/components/ui/aura-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EASE_OUT, FadeIn } from "@/components/motion/primitives";

type Mode = "sign-in" | "sign-up";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.1 3.57-5.17 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.45A11.98 11.98 0 0 0 1.27 6.6l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("sign-in");
  // On sign-up we first ask how they want to register (email vs Google);
  // picking "email" reveals the form. Sign-in shows the form immediately.
  const [signUpMethod, setSignUpMethod] = useState<"email" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function handleGoogle() {
    setError(null);
    setGoogleBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setGoogleBusy(false);
    }
    // On success the browser is redirected to Google — no state to reset.
  }

  /**
   * After a successful sign-in, existing (onboarded) clinicians land on the
   * public landing page — never forced back through onboarding. Only accounts
   * that haven't finished intake continue to /onboarding.
   */
  async function routeAfterSignIn() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let destination = "/onboarding";
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle<{ onboarded: boolean }>();
      destination = data?.onboarded ? "/" : "/onboarding";
    }
    router.push(destination);
    router.refresh();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await routeAfterSignIn();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) {
          // Brand-new account with an immediate session → start onboarding.
          router.push("/onboarding");
          router.refresh();
        } else {
          setNotice("Check your inbox to confirm your email, then sign in.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <AuroraBackground />
      <CursorTrail />

      <FadeIn className="w-full max-w-[26rem]">
        {/* Brand above the card so the glass panel stays quiet */}
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            <AuraMark className="size-12" />
          </motion.div>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">
            <span className="text-gradient">Aura</span>
          </h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            The clinical scribe that never keeps your patients&apos; voices.
          </p>
        </div>

        <div className="glass rounded-3xl p-8">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleGoogle}
            disabled={googleBusy || busy}
          >
            {googleBusy ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>

          {mode === "sign-up" && signUpMethod === null ? (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground/70">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setSignUpMethod("email");
                  setError(null);
                }}
                disabled={googleBusy}
              >
                <Mail />
                Sign up with email
              </Button>
            </>
          ) : (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground/70">
                <span className="h-px flex-1 bg-border" />
                or with email
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence initial={false} mode="popLayout">
              {mode === "sign-up" && (
                <motion.div
                  key="full-name"
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <Label htmlFor="full-name">Full name</Label>
                  <Input
                    id="full-name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Dr. Asha Rao"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@practice.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  key="error"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}
              {notice && (
                <motion.p
                  key="notice"
                  role="status"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-primary"
                >
                  {notice}
                </motion.p>
              )}
            </AnimatePresence>

            <Button type="submit" disabled={busy || googleBusy} className="w-full">
              {busy && <Loader2 className="animate-spin" />}
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
              </form>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setSignUpMethod(null);
              setError(null);
              setNotice(null);
            }}
            className="mt-5 w-full cursor-pointer text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {mode === "sign-in"
              ? "New to Aura? Create an account"
              : "Already registered? Sign in"}
          </button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
          <ShieldCheck className="size-3.5" />
          Audio and raw transcripts are ephemeral — purged after every export.
        </p>
      </FadeIn>
    </main>
  );
}
