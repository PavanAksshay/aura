import type { Metadata } from "next";

import { LegalShell, type LegalSection } from "@/components/legal/LegalShell";

export const metadata: Metadata = {
  title: "Terms of Use · Aura",
  description: "The terms that govern your use of Aura.",
};

const SECTIONS: LegalSection[] = [
  {
    heading: "Agreement to these terms",
    blocks: [
      {
        p: "These Terms of Use (“Terms”) form a binding agreement between you and Aura (“Aura”, “we”, “us”) and govern your access to and use of the Aura clinical documentation application and related services (the “Service”). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.",
      },
    ],
  },
  {
    heading: "Eligibility",
    blocks: [
      {
        p: "The Service is intended for use by licensed or otherwise qualified mental-health and healthcare professionals acting within their scope of practice. By using the Service you represent that you are such a professional (or an authorized member of their practice) and that you are legally able to enter into these Terms.",
      },
    ],
  },
  {
    heading: "What the Service does",
    blocks: [
      {
        p: "Aura records and transcribes clinical sessions, generates structured notes and summaries from those transcripts, and helps you organize patients, appointments, documents, and a private searchable memory of your own notes. Features rely on automated speech-to-text and language models.",
      },
    ],
  },
  {
    heading: "Clinical responsibility; not a medical device",
    blocks: [
      {
        p: "Aura is a documentation aid. It does not provide medical advice, diagnosis, or treatment recommendations, and it is not a substitute for your professional judgment. Automated transcripts, notes, and summaries may contain errors, omissions, or misattributed speakers.",
      },
      {
        p: "You are solely responsible for reviewing, correcting, and approving any content before relying on it or entering it into a patient’s record. All clinical decisions remain yours.",
      },
    ],
  },
  {
    heading: "Your account",
    blocks: [
      {
        p: "You are responsible for maintaining the confidentiality of your credentials and for all activity under your account. Notify us promptly of any unauthorized use. We may suspend or terminate access if we reasonably believe your account has been compromised or misused.",
      },
    ],
  },
  {
    heading: "Patient consent and lawful use",
    blocks: [
      {
        p: "Recording a session and storing information about the people you treat is your responsibility. Before recording, you must obtain any consent and satisfy any legal or ethical requirements that apply in your jurisdiction. You agree to use the Service only for lawful purposes and in compliance with the professional obligations that govern your practice.",
      },
    ],
  },
  {
    heading: "Acceptable use",
    blocks: [
      { p: "You agree not to:" },
      {
        ul: [
          "Use the Service to violate any law or the rights of any person.",
          "Upload content you have no right to process, or attempt to access another user’s data.",
          "Reverse engineer, disrupt, overload, or probe the Service or its security other than as permitted by law.",
          "Resell or provide the Service to third parties except as expressly permitted.",
        ],
      },
    ],
  },
  {
    heading: "Your content and ownership",
    blocks: [
      {
        p: "You retain all rights to the content you create or upload, including your transcripts, notes, and patient records. You grant us the limited rights necessary to host and process that content solely to provide the Service to you. We claim no ownership of your clinical content and do not use it to train AI models.",
      },
      {
        p: "We retain all rights in the Service itself, including its software, design, and trademarks.",
      },
    ],
  },
  {
    heading: "Third-party services",
    blocks: [
      {
        p: "The Service relies on third-party infrastructure (for example, hosting and authentication providers). Your use of those components through the Service may also be subject to their terms. We are not responsible for third-party services outside our control.",
      },
    ],
  },
  {
    heading: "Disclaimer of warranties",
    blocks: [
      {
        p: "The Service is provided “as is” and “as available,” without warranties of any kind, whether express or implied, including implied warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or that transcripts and notes will be accurate or complete.",
      },
    ],
  },
  {
    heading: "Limitation of liability",
    blocks: [
      {
        p: "To the maximum extent permitted by law, Aura and its suppliers will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or goodwill, arising out of or related to your use of the Service. Our total liability for any claim relating to the Service will not exceed the amount you paid us for the Service in the twelve months preceding the claim, or, where no fee was paid, ₹5,000 (five thousand Indian Rupees).",
      },
      {
        p: "Nothing in these Terms limits liability that cannot be limited under applicable law.",
      },
    ],
  },
  {
    heading: "Indemnification",
    blocks: [
      {
        p: "You agree to indemnify and hold harmless Aura from claims, damages, and expenses arising out of your use of the Service, your content, or your violation of these Terms or applicable law, including obligations relating to patient consent and health-privacy laws.",
      },
    ],
  },
  {
    heading: "Termination",
    blocks: [
      {
        p: "You may stop using the Service and close your account at any time. We may suspend or terminate access if you materially breach these Terms or as required by law. On termination, your right to use the Service ends; provisions that by their nature should survive (such as ownership, disclaimers, and limitation of liability) will survive.",
      },
    ],
  },
  {
    heading: "Governing law and changes",
    blocks: [
      {
        p: "These Terms are governed by the laws of India, without regard to conflict-of-laws rules, and the courts located in Tamil Nadu, India will have exclusive jurisdiction over any dispute arising out of or relating to them. We may update these Terms from time to time; when we make material changes we will update the “Last updated” date and, where appropriate, notify you in the app. Continued use after changes take effect constitutes acceptance.",
      },
      {
        p: "Aura is operated from Tamil Nadu, India. Questions about these Terms can be sent to pavanaksshay07@gmail.com.",
      },
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Use"
      updated="July 2026"
      lede="These terms explain the ground rules for using Aura — including that Aura is a documentation aid, not a medical device, and that clinical judgment and patient consent always remain with you."
      sections={SECTIONS}
      crossLink={{ href: "/privacy", label: "Read the Privacy Policy →" }}
    />
  );
}
