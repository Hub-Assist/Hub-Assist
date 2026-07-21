export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-[#3D3D3D]">
      <h1 className="mb-2 text-4xl font-bold text-[#1A1A1A]">Privacy Policy</h1>
      <p className="mb-10 text-sm text-[#6B6B6B]">Effective date: April 27, 2026</p>

      <Section title="1. Introduction">
        HubAssist (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the HubAssist workspace management
        platform. This Privacy Policy explains how we collect, use, disclose, and safeguard your
        information when you use our services.
      </Section>

      <Section title="2. Information We Collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Account data:</strong> name, email address, password hash, and role.
          </li>
          <li>
            <strong>Biometric data:</strong> WebAuthn credential IDs and public keys (never raw
            biometric samples).
          </li>
          <li>
            <strong>Usage data:</strong> workspace bookings, attendance logs, session timestamps,
            and IP addresses.
          </li>
          <li>
            <strong>Profile media:</strong> avatar images uploaded via Cloudinary.
          </li>
          <li>
            <strong>Blockchain data:</strong> Stellar public keys and on-chain transaction records
            associated with your account.
          </li>
          <li>
            <strong>Communications:</strong> messages sent through our contact form or support
            channels.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>Provide, operate, and maintain the HubAssist platform.</li>
          <li>Authenticate your identity and manage access control.</li>
          <li>Process workspace bookings and on-chain payments via Stellar.</li>
          <li>Send transactional emails (booking confirmations, OTPs, password resets).</li>
          <li>Analyse usage patterns to improve the platform.</li>
          <li>Comply with legal obligations.</li>
        </ul>
      </Section>

      <Section title="4. Cookies and Tracking">
        We use strictly necessary cookies to maintain your authenticated session (JWT stored in
        HTTP-only cookies). We do not use advertising or cross-site tracking cookies. You may
        disable cookies in your browser, but this will prevent you from logging in.
      </Section>

      <Section title="5. Third-Party Services">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Stellar / Soroban:</strong> On-chain transactions are recorded on the public
            Stellar blockchain and are permanently visible to anyone. We have no ability to delete
            or modify blockchain records.
          </li>
          <li>
            <strong>Cloudinary:</strong> Profile images are stored and served via Cloudinary. Their
            privacy policy applies to data processed on their infrastructure.
          </li>
          <li>
            <strong>PostgreSQL hosting provider:</strong> Your account and booking data is stored in
            a managed PostgreSQL database. We select providers that comply with applicable data
            protection regulations.
          </li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        We retain your personal data for as long as your account is active or as needed to provide
        services. You may request deletion of your account and associated data at any time (see
        Section 7). Blockchain transaction records cannot be deleted.
      </Section>

      <Section title="7. Your Rights">
        Depending on your jurisdiction you may have the right to:
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate data.</li>
          <li>Request deletion of your account and personal data.</li>
          <li>Object to or restrict certain processing.</li>
          <li>Data portability.</li>
        </ul>
        To exercise any of these rights, contact us at{" "}
        <a className="underline" href="mailto:privacy@hubassist.io">
          privacy@hubassist.io
        </a>
        .
      </Section>

      <Section title="8. Security">
        We implement industry-standard security measures including TLS encryption in transit,
        bcrypt password hashing, HTTP-only JWT cookies, and role-based access control. No method of
        transmission over the internet is 100% secure; we cannot guarantee absolute security.
      </Section>

      <Section title="9. Children's Privacy">
        HubAssist is not directed at children under 16. We do not knowingly collect personal data
        from children. If you believe a child has provided us with personal data, contact us
        immediately.
      </Section>

      <Section title="10. Changes to This Policy">
        We may update this Privacy Policy from time to time. We will notify you of material changes
        by email or by posting a notice on the platform. Continued use after changes constitutes
        acceptance.
      </Section>

      <Section title="11. Contact">
        For privacy-related enquiries:{" "}
        <a className="underline" href="mailto:privacy@hubassist.io">
          privacy@hubassist.io
        </a>
        <br />
        HubAssist, c/o Legal Team.
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold text-[#1A1A1A]">{title}</h2>
      <div className="leading-relaxed">{children}</div>
    </section>
  );
}
