import { useNavigate } from 'react-router';
import { LegalPageLayout, LegalSection } from './LegalPageLayout';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <LegalPageLayout title="Privacy Policy" updatedLabel="Last updated September 2026">
      <LegalSection title="1. What This Policy Covers">
        <p>
          This Privacy Policy explains what information CreativeHUB collects when you use the Platform, how we
          use it, and the choices you have about it. It should be read together with our{' '}
          <button type="button" onClick={() => navigate('/terms')} className="font-semibold text-gray-900 underline">Terms of Service</button>.
        </p>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <p>We collect information in a few ways:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-semibold text-gray-900">Account information</span> you give us directly: name, email, gender/pronouns, profile photo, bio, and — for freelancer accounts — category, skills, styles, pricing, availability, and payout/billing details.</li>
          <li><span className="font-semibold text-gray-900">Location information</span> you choose to provide or search for, such as a saved service location or a location you search on the map — location lookups are handled through OpenStreetMap's Nominatim geocoding service (see "Third-Party Services" below).</li>
          <li><span className="font-semibold text-gray-900">Content and activity</span>: posts, captions, comments, likes, messages, booking requests and their history, reviews you write or receive, and reports you file.</li>
          <li><span className="font-semibold text-gray-900">Technical information</span> collected automatically, such as device/browser type and general usage of the Platform, used only to operate and improve the Platform — we do not sell this information.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How We Use Information">
        <ul className="list-disc space-y-1 pl-5">
          <li>To operate core features: matching, bookings, messaging, notifications, reviews, and search;</li>
          <li>To show you relevant freelancers or posts (for example, using the interests and preferences you set during onboarding);</li>
          <li>To keep the Platform safe — investigating reports, resolving disputes, and enforcing our Terms of Service;</li>
          <li>To communicate with you about your account, a booking, or a message from another user;</li>
          <li>To comply with legal obligations where applicable.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. What We Share, and With Whom">
        <p>
          Certain information is inherently visible to other users as part of how the Platform works — for
          example, your public profile, posts, and (for freelancers) reviews and ratings are visible to other
          signed-in users. Reviews written about a client by a freelancer are a deliberate exception: those are
          visible only to freelancer accounts, never to the client being reviewed or to any other client.
        </p>
        <p>
          We do not sell your personal information. We share information with the service providers described
          below only as needed to operate the Platform, and with law enforcement only where required by law.
        </p>
      </LegalSection>

      <LegalSection title="5. Third-Party Services">
        <p>The Platform relies on a small number of third-party services to function:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-semibold text-gray-900">Supabase</span> — provides our database, authentication, and file storage (for example, the photos and videos you upload).</li>
          <li><span className="font-semibold text-gray-900">OpenStreetMap / Nominatim</span> — provides location search and map display when you search for or view a location on the Platform.</li>
        </ul>
        <p>Each of these providers processes data only as necessary to provide their service to CreativeHUB.</p>
      </LegalSection>

      <LegalSection title="6. Cookies and Local Storage">
        <p>
          The Platform uses your browser's local storage to keep you signed in and to remember a small number of
          per-device preferences (such as a collapsed panel or a draft you haven't sent). We do not use
          third-party advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="7. Data Retention">
        <p>
          We keep your information for as long as your account is active, or as needed to provide the Platform to
          you. If you delete your account, we delete or anonymize your personal information within a reasonable
          period, except where we need to keep certain records — for example, a booking's history or a review
          already left about you by someone else — for dispute resolution, safety, or legal reasons.
        </p>
      </LegalSection>

      <LegalSection title="8. Your Choices and Rights">
        <ul className="list-disc space-y-1 pl-5">
          <li>You can review and update most of your account information at any time from your profile or account settings.</li>
          <li>You can delete individual posts, messages you control, and other content you've created.</li>
          <li>You can request deletion of your account from your account settings.</li>
          <li>You can block another user, which prevents them from contacting you or viewing your content.</li>
        </ul>
      </LegalSection>

      <LegalSection title="9. Children's Privacy">
        <p>
          The Platform is not directed to children and is not intended for use by anyone under the age required
          by applicable law to independently enter into a contract in their jurisdiction. We do not knowingly
          collect personal information from children.
        </p>
      </LegalSection>

      <LegalSection title="10. Security">
        <p>
          We use reasonable technical and organizational measures to protect your information, including
          database-level access rules that restrict who can read or write which data. No method of transmission
          or storage is completely secure, so we can't guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. If we make material changes, we will update the
          "Last updated" date above.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>Questions about this Privacy Policy can be sent through the "Report an Issue" option in your account settings.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
