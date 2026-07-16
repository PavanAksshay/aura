"use client";

/**
 * Aura intake: three-step animated onboarding. Steps slide horizontally via
 * AnimatePresence (direction-aware), progress fills the brand gradient, and
 * the final step writes the profile with onboarded=true.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AVATARS, Avatar } from "@/lib/avatars";
import { EASE_OUT } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TITLES = [
  "Clinical Psychologist",
  "Counselling Psychologist",
  "Psychiatrist",
  "Therapist / Counsellor",
  "Other",
];

const PRACTICE_TYPES = [
  "Private practice",
  "Clinic / Hospital",
  "Telehealth",
  "Academic / Research",
];

const EXPERIENCE = [
  { label: "0–2 years", value: 0 },
  { label: "3–7 years", value: 3 },
  { label: "8–15 years", value: 8 },
  { label: "15+ years", value: 15 },
];

// Country → representative IANA timezone, used to anchor calendar slot times.
const COUNTRIES: { name: string; tz: string }[] = [
  { name: "United Kingdom", tz: "Europe/London" },
  { name: "India", tz: "Asia/Kolkata" },
  { name: "United States", tz: "America/New_York" },
  { name: "Canada", tz: "America/Toronto" },
  { name: "Australia", tz: "Australia/Sydney" },
  { name: "Ireland", tz: "Europe/Dublin" },
  { name: "United Arab Emirates", tz: "Asia/Dubai" },
  { name: "Singapore", tz: "Asia/Singapore" },
  { name: "Germany", tz: "Europe/Berlin" },
  { name: "France", tz: "Europe/Paris" },
  { name: "South Africa", tz: "Africa/Johannesburg" },
  { name: "New Zealand", tz: "Pacific/Auckland" },
];

const PREFER_NOT_TO_SAY = "Prefer not to say";
const GENDERS = ["Woman", "Man", "Non-binary", PREFER_NOT_TO_SAY];

// Clock reads kept out of the render body (react-hooks/purity).
function currentYear(): number {
  return new Date().getFullYear();
}
function todayYmd(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Grouped loosely by modality, then presentation, then population/context — so
// the chip wall scans in a sensible order rather than alphabetically.
const SPECIALIZATIONS = [
  // Modalities
  "CBT",
  "DBT",
  "ACT",
  "EMDR",
  "Psychodynamic",
  "Schema Therapy",
  "Person-centred",
  "Solution-focused",
  "Mindfulness",
  "Group Therapy",
  // Presentations
  "Anxiety",
  "Depression",
  "Trauma & PTSD",
  "OCD",
  "Bipolar",
  "Psychosis",
  "Personality Disorders",
  "Eating Disorders",
  "Addiction",
  "Self-harm & Suicidality",
  "Grief & Loss",
  "Stress & Burnout",
  "Sleep & Insomnia",
  "Anger Management",
  "Self-esteem",
  // Populations & contexts
  "Child & Adolescent",
  "Couples & Family",
  "Older Adults",
  "ADHD",
  "Autism & Neurodivergence",
  "LGBTQ+ Affirmative",
  "Perinatal & Postnatal",
  "Chronic Illness & Pain",
  "Health Psychology",
  "Occupational & Workplace",
  "Forensic",
  "Assessment",
];

const STEP_META = [
  { title: "About you", subtitle: "How should Aura address you?" },
  { title: "Your practice", subtitle: "A little context about where you work." },
  { title: "Specializations", subtitle: "Pick everything that applies — this shapes your workspace." },
  { title: "Choose your avatar", subtitle: "Pick a look for your profile — you can change it later." },
  { title: "Your privacy", subtitle: "One last thing before you begin." },
] as const;

const slide = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 56 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: EASE_OUT },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -56,
    transition: { duration: 0.25, ease: "easeIn" as const },
  }),
};

export function OnboardingFlow({
  userId,
  initialName,
  initialPractice,
}: {
  userId: string;
  initialName: string;
  initialPractice: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(initialName);
  const [title, setTitle] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [dob, setDob] = useState("");
  const [practiceName, setPracticeName] = useState(initialPractice);
  const [practiceType, setPracticeType] = useState<string | null>(null);
  const [experience, setExperience] = useState<number | null>(null);
  const [country, setCountry] = useState<string>("");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [avatarId, setAvatarId] = useState<string | null>(null);

  const isLast = step === STEP_META.length - 1;

  // Per-step gate for the primary button.
  const canAdvance =
    (step === 0 && fullName.trim().length > 0) ||
    (step === 3 && avatarId !== null) ||
    ![0, 3].includes(step);

  function go(delta: number) {
    setDirection(delta);
    setStep((s) => Math.min(Math.max(s + delta, 0), STEP_META.length - 1));
  }

  function toggleSpecialization(item: string) {
    setSpecializations((current) =>
      current.includes(item)
        ? current.filter((s) => s !== item)
        : [...current, item],
    );
  }

  async function finish() {
    setBusy(true);
    setError(null);
    const tz = COUNTRIES.find((c) => c.name === country)?.tz ?? null;
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: fullName.trim(),
      title,
      // "Prefer not to say" is stored as null rather than as an answer.
      gender: gender === PREFER_NOT_TO_SAY ? null : gender,
      date_of_birth: dob || null,
      clinic_name: practiceName.trim() || null,
      practice_type: practiceType,
      country: country || null,
      timezone: tz,
      specializations,
      years_experience: experience,
      avatar_id: avatarId,
      privacy_accepted_at: new Date().toISOString(),
      onboarded: true,
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLast) void finish();
    else go(1);
  }

  return (
    <div className="w-full max-w-xl">
      {/* Step counter + animated gradient progress */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            Setting up your workspace
          </span>
          <span>
            Step {step + 1} of {STEP_META.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/8">
          <motion.div
            className="h-full rounded-full bg-linear-100 from-aurora-cyan via-aurora-teal to-aurora-violet"
            initial={false}
            animate={{ width: `${((step + 1) / STEP_META.length) * 100}%` }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass rounded-3xl p-8">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {STEP_META[step]?.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {STEP_META[step]?.subtitle}
            </p>

            <div className="mt-7 min-h-56">
              {step === 0 && (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="onb-name">Full name</Label>
                    <Input
                      id="onb-name"
                      required
                      autoFocus
                      autoComplete="name"
                      placeholder="Dr. Asha Rao"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label>Professional title</Label>
                    <div className="flex flex-wrap gap-2">
                      {TITLES.map((t) => (
                        <Chip
                          key={t}
                          selected={title === t}
                          onClick={() => setTitle(title === t ? null : t)}
                        >
                          {t}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <Label>Gender</Label>
                    <div className="flex flex-wrap gap-2">
                      {GENDERS.map((g) => (
                        <Chip
                          key={g}
                          selected={gender === g}
                          onClick={() => setGender(gender === g ? null : g)}
                        >
                          {g}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="onb-dob">Date of birth</Label>
                    <DateField
                      id="onb-dob"
                      value={dob}
                      onChange={setDob}
                      placeholder="Select your date of birth"
                      fromYear={1930}
                      toYear={currentYear()}
                      max={todayYmd()}
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="onb-practice">Practice name</Label>
                    <Input
                      id="onb-practice"
                      autoFocus
                      placeholder="Serenity Mind Clinic"
                      value={practiceName}
                      onChange={(e) => setPracticeName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground/70">
                      Optional — shown on exported notes.
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    <Label>Practice type</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRACTICE_TYPES.map((t) => (
                        <Chip
                          key={t}
                          selected={practiceType === t}
                          onClick={() =>
                            setPracticeType(practiceType === t ? null : t)
                          }
                        >
                          {t}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <Label>Years in practice</Label>
                    <div className="flex flex-wrap gap-2">
                      {EXPERIENCE.map(({ label, value }) => (
                        <Chip
                          key={value}
                          selected={experience === value}
                          onClick={() =>
                            setExperience(experience === value ? null : value)
                          }
                        >
                          {label}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="onb-country">Country of practice</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger id="onb-country">
                        <SelectValue placeholder="Select your country…" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.name} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground/70">
                      Sets your timezone for scheduling session slots.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {/* The list is long by design — scroll it rather than let the
                      card grow past the fold. */}
                  <div className="-mr-2 flex max-h-[19rem] flex-wrap gap-2 overflow-y-auto pr-2">
                    {SPECIALIZATIONS.map((s) => (
                      <Chip
                        key={s}
                        selected={specializations.includes(s)}
                        onClick={() => toggleSpecialization(s)}
                      >
                        {s}
                      </Chip>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    {specializations.length === 0
                      ? "Select at least one to personalize your dashboard."
                      : `${specializations.length} selected`}
                  </p>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-3 sm:gap-4">
                    {AVATARS.map((a) => {
                      const selected = avatarId === a.id;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setAvatarId(a.id)}
                          aria-pressed={selected}
                          aria-label={`Avatar ${a.id}`}
                          className={`relative aspect-square rounded-2xl outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring ${
                            selected
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              : "opacity-80 hover:opacity-100 hover:scale-[1.04]"
                          }`}
                        >
                          <Avatar id={a.id} className="size-full" />
                          {selected && (
                            <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                              <Check className="size-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    {avatarId ? "Looking good." : "Tap one to make it yours."}
                  </p>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="glass-subtle rounded-2xl p-5">
                    <div className="mb-3 flex items-center gap-2 text-primary">
                      <ShieldCheck className="size-5" />
                      <p className="font-medium text-foreground">
                        Your patients&rsquo; privacy is the whole point.
                      </p>
                    </div>
                    <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                      <li className="flex gap-2.5">
                        <Lock className="mt-0.5 size-4 shrink-0 text-accent" />
                        Audio is processed on-device and never stored — it&rsquo;s
                        deleted the moment a note is drafted.
                      </li>
                      <li className="flex gap-2.5">
                        <Trash2 className="mt-0.5 size-4 shrink-0 text-accent" />
                        Raw transcripts stay under your control and are purged on
                        export; only the structured note you approve is kept.
                      </li>
                      <li className="flex gap-2.5">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                        Every record is isolated to your account by row-level
                        security — no colleague, and no one at Aura, can read it.
                      </li>
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    By continuing you confirm you&rsquo;ve read this and agree to
                    handle client data responsibly.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => go(-1)}
            disabled={step === 0 || busy}
            className={step === 0 ? "invisible" : ""}
          >
            <ArrowLeft />
            Back
          </Button>
          <Button type="submit" disabled={busy || !canAdvance}>
            {busy && <Loader2 className="animate-spin" />}
            {isLast ? (
              <>
                <ShieldCheck />
                Agree &amp; continue
              </>
            ) : (
              <>
                Continue
                <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
