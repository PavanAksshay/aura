import type { Metadata } from "next";

import { LegalShell, type LegalSection } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Privacy Policy · Aura",
  description: "How Aura collects, uses, and protects your data.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Who this policy covers",
    blocks: [
      {
        p: "This Privacy Policy explains how Aura (“Aura”, “we”, “us”) handles information when you use the Aura clinical documentation application and related services (the “Service”). It applies to the clinicians who hold an Aura account.",
      },
      {
        p: "Aura is a tool used by licensed mental-health professionals to document their own sessions. Where you enter information about the people you treat (“patient data”), you act as the controller of that data and Aura acts as your processor. Section 8 sets out how this works.",
      },
    ],
  },
  {
    heading: "Information we collect",
    blocks: [
      { p: "We collect only what the Service needs to function:" },
      {
        ul: [
          "Account information: your name, email address, and the sign-in credentials you use (email/password or Google sign-in, handled by our authentication provider).",
          "Practice profile: details you choose to add, such as your title, practice type, country, timezone, and areas of specialization.",
          "Session audio: the audio you record for transcription. This is processed transiently and deleted immediately after a transcript is produced (see Section 4).",
          "Clinical content: transcripts, structured session notes, and summaries generated from your recordings, plus any patient records, appointments, and documents you add.",
          "Technical data: basic, security-related information such as authentication tokens and timestamps required to operate the Service.",
        ],
      },
      {
        p: "We do not use advertising trackers, and we do not build advertising profiles about you.",
      },
    ],
  },
  {
    heading: "How your audio is handled",
    blocks: [
      {
        p: "Session audio is the most sensitive data the Service touches, so it is treated as ephemeral. When you submit a recording, the audio is transcribed by speech-to-text and speaker-labeling models that run locally on the machine operating the Service — the audio is not sent to any third-party AI provider.",
      },
      {
        p: "As soon as transcription completes (or fails), the audio file is deleted. It is never retained as part of your account. Only the resulting transcript and structured note persist, under your control.",
      },
    ],
  },
  {
    heading: "How we use information",
    blocks: [
      { p: "We use the information above to:" },
      {
        ul: [
          "Provide the Service — transcribe sessions, generate structured notes and summaries, and let you organize patients, appointments, and documents.",
          "Power your private semantic memory, so you can search across your own exported notes. Search embeddings are computed locally and stored scoped to your account.",
          "Authenticate you and keep your workspace secure.",
          "Maintain, debug, and improve the reliability of the Service.",
        ],
      },
      {
        p: "We do not sell your data, and we do not use your clinical content or patient data to train machine-learning models.",
      },
    ],
  },
  {
    heading: "Storage, security, and sub-processors",
    blocks: [
      {
        p: "Your account and clinical content are stored in a managed Postgres database and object storage provided by Supabase, our hosting and infrastructure sub-processor. Data is transmitted over encrypted connections (TLS) and isolated per account using database row-level security, so one clinician cannot access another’s data.",
      },
      {
        p: "The AI models used for transcription, summarization, and semantic search run locally on the Service’s own infrastructure; your clinical content is not shared with external AI vendors for these features.",
      },
      {
        p: "No method of transmission or storage is perfectly secure. We apply reasonable technical and organizational measures appropriate to the sensitivity of the data, but we cannot guarantee absolute security.",
      },
    ],
  },
  {
    heading: "Data retention",
    blocks: [
      {
        p: "Session audio is deleted immediately after processing. Your account information, notes, patient records, and related content are retained for as long as your account is active, and then deleted or anonymized within a reasonable period after you close your account or request deletion, unless a longer retention period is required by law or your own professional record-keeping obligations.",
      },
    ],
  },
  {
    heading: "Your rights",
    blocks: [
      {
        p: "Depending on where you live — for example under India’s Digital Personal Data Protection Act, 2023, the EU/UK GDPR, or comparable laws — you may have the right to access, correct, export, or delete your personal data, to restrict or object to certain processing, to nominate another person to exercise your rights, and to withdraw consent. You can exercise many of these directly in the app, or by contacting us at pavanaksshay07@gmail.com.",
      },
      {
        p: "You also have the right to raise a grievance with us and, if unsatisfied, to lodge a complaint with the competent data-protection authority in your jurisdiction.",
      },
    ],
  },
  {
    heading: "Patient data and your responsibilities",
    blocks: [
      {
        p: "When you record sessions and store information about the people you treat, that information belongs to your clinical relationship. You are responsible for having a lawful basis to record and process it — including obtaining any patient consent required in your jurisdiction — and for complying with the professional and legal obligations that apply to you (which may include health-privacy laws such as HIPAA or local equivalents).",
      },
      {
        p: "Aura processes patient data on your behalf and under your instructions, solely to provide the Service to you. If you require a data-processing agreement or business-associate arrangement, contact us at pavanaksshay07@gmail.com.",
      },
    ],
  },
  {
    heading: "International transfers",
    blocks: [
      {
        p: "Depending on your deployment and hosting region, your data may be processed in a country other than your own. Where it is, we rely on appropriate safeguards for such transfers as required by applicable law.",
      },
    ],
  },
  {
    heading: "Children",
    blocks: [
      {
        p: "The Service is intended for licensed professionals and is not directed to children. We do not knowingly collect personal data directly from children through the account-holder interface. Information a clinician records about a minor patient is patient data governed by Section 8.",
      },
    ],
  },
  {
    heading: "Changes to this policy",
    blocks: [
      {
        p: "We may update this policy from time to time. When we make material changes, we will update the “Last updated” date above and, where appropriate, notify you in the app.",
      },
    ],
  },
  {
    heading: "Contact us",
    blocks: [
      {
        p: "Aura is operated from Tamil Nadu, India. For any privacy question, grievance, or request to exercise your rights, contact the operator at pavanaksshay07@gmail.com. We aim to respond to every request within 30 days.",
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated="July 2026"
      lede="Aura is built privacy-first: your session audio is processed locally and deleted the moment a transcript is ready, and your clinical content is never used to train AI or sold to anyone. This policy explains, in plain terms, what we collect and why."
      sections={SECTIONS}
      crossLink={{ href: "/terms", label: "Read the Terms of Use →" }}
    />
  );
}
