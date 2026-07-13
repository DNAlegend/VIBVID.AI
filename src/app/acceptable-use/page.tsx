import type { Metadata } from "next";
import { LegalPage, Section, COMPANY } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — VIBVID.AI",
  description: "What you may and may not create with VIBVID.AI.",
};

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      updated="13 July 2026"
      intro={
        <>
          This Acceptable Use Policy is part of our{" "}
          <a href="/terms" className="text-accent-2 underline hover:text-accent">
            Terms of Service
          </a>{" "}
          and applies to everything you create with {COMPANY.brand}. Because the Service generates
          realistic images and video, we hold a firm line on content that could deceive or harm people.
        </>
      }
    >
      <Section heading="Prohibited content and conduct">
        <p>You may not use the Service to create, upload, or distribute content that:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>Is unlawful, or promotes or facilitates illegal activity.</li>
          <li>
            Sexually exploits or endangers minors in any way, including any sexualised depiction of a
            minor. We report child sexual abuse material to the relevant authorities.
          </li>
          <li>
            Is pornographic or sexually explicit, or depicts non-consensual sexual content.
          </li>
          <li>
            Depicts a real, identifiable person — their face, likeness or voice — without their consent,
            including &ldquo;deepfakes&rdquo; created to deceive, defame, impersonate, or place someone in
            a false or demeaning context.
          </li>
          <li>
            Impersonates a real person, brand or organisation, or is designed to mislead people about who
            created it (fraud, scams, fake news, election or political disinformation).
          </li>
          <li>
            Presents misleading testimonials or fabricated endorsements as genuine — including fake
            reviews, invented customer statements, or endorsements a person or brand never gave.
          </li>
          <li>Harasses, bullies, threatens, defames, or incites violence or hatred against others.</li>
          <li>
            Promotes self-harm, terrorism, or violent extremism, or provides instructions for weapons or
            other serious harm.
          </li>
          <li>
            Infringes anyone&rsquo;s intellectual-property, privacy or publicity rights, or misuses
            trademarks or copyrighted characters.
          </li>
          <li>Contains malware, or is used to spam, phish, or breach security.</li>
        </ul>
      </Section>

      <Section heading="Your responsibilities">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            Only upload material you own or have permission to use, including any person&rsquo;s likeness
            or voice and any brand or product you feature.
          </li>
          <li>
            Comply with the laws that apply to you and to your audience, and with the terms of the
            platforms where you publish your videos.
          </li>
          <li>
            Where the law requires it, clearly disclose that content is AI-generated — particularly for
            advertising and for any realistic depiction of people or events.
          </li>
        </ul>
      </Section>

      <Section heading="Enforcement">
        <p>
          We may remove content and suspend or terminate accounts that violate this policy, with or
          without notice, and may report unlawful content to the authorities. Serious or repeated
          violations may result in permanent loss of access without refund. If you believe content on the
          Service infringes your rights or this policy, report it to{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent-2 underline hover:text-accent">
            {COMPANY.supportEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
