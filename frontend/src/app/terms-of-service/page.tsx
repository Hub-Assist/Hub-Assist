export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-[#3D3D3D]">
      <h1 className="mb-2 text-4xl font-bold text-[#1A1A1A]">Terms of Service</h1>
      <p className="mb-10 text-sm text-[#6B6B6B]">Effective date: April 27, 2026</p>

      <Section title="1. Acceptance of Terms">
        By creating an account or using the HubAssist platform (&quot;Service&quot;), you agree to
        be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the
        Service.
      </Section>

      <Section title="2. Account Usage">
        <ul className="list-disc space-y-1 pl-5">
          <li>You must be at least 16 years old to create an account.</li>
          <li>You are responsible for maintaining the confidentiality of your credentials.</li>
          <li>
            You must not share your account, impersonate others, or use the Service for unlawful
            purposes.
          </li>
          <li>
            We reserve the right to suspend or terminate accounts that violate these Terms or
            applicable law.
          </li>
        </ul>
      </Section>

      <Section title="3. Workspace Booking Rules">
        <ul className="list-disc space-y-1 pl-5">
          <li>Bookings are subject to availability and hub-specific policies.</li>
          <li>
            You must arrive within 15 minutes of your booking start time or the booking may be
            released.
          </li>
          <li>
            Cancellations made more than 24 hours before the booking start time are eligible for a
            full refund. Cancellations within 24 hours are non-refundable unless the hub cancels.
          </li>
          <li>You are responsible for any damage caused to the workspace during your booking.</li>
          <li>Subletting or transferring bookings to third parties is not permitted.</li>
        </ul>
      </Section>

      <Section title="4. Payment Terms">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            All fees are displayed in the currency shown at checkout and are inclusive of applicable
            taxes unless stated otherwise.
          </li>
          <li>Payment is due at the time of booking confirmation.</li>
          <li>
            Refunds are processed within 5–10 business days to the original payment method or
            Stellar wallet.
          </li>
          <li>
            HubAssist is not responsible for exchange rate fluctuations when paying with Stellar
            Lumens (XLM) or other Stellar assets.
          </li>
        </ul>
      </Section>

      <Section title="5. On-Chain Transaction Disclaimers">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Certain features use Soroban smart contracts deployed on the Stellar blockchain.
            On-chain transactions are <strong>irreversible</strong> once confirmed.
          </li>
          <li>
            You are solely responsible for ensuring your Stellar wallet address is correct before
            initiating any transaction.
          </li>
          <li>
            HubAssist does not control the Stellar network and is not liable for network outages,
            congestion fees, or failed transactions caused by network conditions.
          </li>
          <li>
            Smart contract interactions are governed by the contract code deployed on-chain. In the
            event of a conflict between these Terms and the contract code, the contract code
            prevails for on-chain actions.
          </li>
        </ul>
      </Section>

      <Section title="6. Intellectual Property">
        All content, trademarks, and software comprising the HubAssist platform are owned by or
        licensed to HubAssist. You may not copy, modify, distribute, or reverse-engineer any part
        of the Service without prior written consent.
      </Section>

      <Section title="7. Limitation of Liability">
        To the maximum extent permitted by law, HubAssist shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages arising from your use of the
        Service, including loss of data, revenue, or blockchain assets.
      </Section>

      <Section title="8. Termination">
        You may delete your account at any time from the Settings page. We may suspend or terminate
        your access immediately if you breach these Terms, engage in fraudulent activity, or if
        required by law. Termination does not affect on-chain records or completed transactions.
      </Section>

      <Section title="9. Governing Law">
        These Terms are governed by and construed in accordance with applicable law. Any disputes
        shall be resolved through binding arbitration or in the courts of the jurisdiction in which
        HubAssist is registered.
      </Section>

      <Section title="10. Changes to These Terms">
        We may update these Terms at any time. Material changes will be communicated via email or
        an in-app notice at least 14 days before taking effect. Continued use of the Service after
        the effective date constitutes acceptance.
      </Section>

      <Section title="11. Contact">
        For questions about these Terms:{" "}
        <a className="underline" href="mailto:legal@hubassist.io">
          legal@hubassist.io
        </a>
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
