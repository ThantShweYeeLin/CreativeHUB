import { useNavigate } from 'react-router';
import { LegalPageLayout, LegalSection } from './LegalPageLayout';

export function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <LegalPageLayout title="Terms of Service" updatedLabel="Last updated September 2026">
      <LegalSection title="1. Acceptance of these Terms">
        <p>
          These Terms of Service ("Terms") govern your access to and use of CreativeHUB (the "Platform"), a
          marketplace that connects clients seeking creative services with independent freelance creative
          professionals ("Freelancers"). By creating an account or otherwise using the Platform, you agree to be
          bound by these Terms and by our <button type="button" onClick={() => navigate('/privacy')} className="font-semibold text-gray-900 underline">Privacy Policy</button>. If you do not agree, do not use the Platform.
        </p>
      </LegalSection>

      <LegalSection title="2. What CreativeHUB Is">
        <p>
          CreativeHUB provides tools for clients and freelancers to find each other, communicate, negotiate and
          agree on the terms of a booking, track a booking's status from request through completion, and leave
          reviews of one another afterward. CreativeHUB is not a party to the underlying service arrangement
          between a client and a freelancer — that arrangement is between the client and the freelancer directly.
          CreativeHUB does not employ, supervise, or guarantee the work of any freelancer, and does not guarantee
          that any client will book or pay for a freelancer's services.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and Eligibility">
        <p>
          You must provide accurate information when creating an account and keep it up to date. You are
          responsible for all activity that occurs under your account and for keeping your login credentials
          confidential. You must be legally capable of entering into a binding contract in your jurisdiction to
          create an account. One account per person — accounts may not be shared, sold, or transferred.
        </p>
        <p>
          When you create an account, you choose to register as either a client or a freelancer. Each role has
          access to different features described elsewhere on the Platform (for example, only freelancer accounts
          can accept booking requests, and only client accounts can submit them).
        </p>
      </LegalSection>

      <LegalSection title="4. Bookings, Deposits, and Cancellations">
        <p>
          A booking is formed when a client's request (or a freelancer's counter-offer) is accepted by the other
          party. Once a booking is accepted, the Platform may require a deposit to be paid within a stated window
          to confirm the booking; a booking that is not confirmed within that window may be automatically
          released so the freelancer's availability is not held indefinitely. Deposit amounts, release conditions,
          attendance confirmation, and dispute handling are all described within the relevant booking's own
          tracking page at the time — those in-product terms form part of this agreement for that booking.
        </p>
        <p>
          Either party may report a problem with attendance, delivery, or conduct through the Platform's dispute
          tools. CreativeHUB, at its discretion, may review evidence submitted by both sides and make a decision
          about how a disputed deposit is resolved. Filing a dishonest or bad-faith dispute is a violation of
          these Terms.
        </p>
      </LegalSection>

      <LegalSection title="5. Reviews">
        <p>
          After a booking is completed, each party may leave a rating and written review of the other. Reviews
          must reflect a genuine experience related to an actual booking. Reviews of a freelancer are visible
          publicly to other Platform users. Reviews written by a freelancer about a client are visible only to
          other freelancers, never to clients — this is a deliberate design choice to give freelancers a shared,
          private reference for deciding whether to work with a given client, without exposing that information
          back to the client being reviewed.
        </p>
      </LegalSection>

      <LegalSection title="6. Content You Post">
        <p>
          You are solely responsible for any photo, video, caption, message, or other content you post, share, or
          send through the Platform ("User Content"). You must have the rights to post it, and it must not
          infringe anyone else's rights or violate applicable law. By posting User Content, you grant CreativeHUB
          a non-exclusive, worldwide, royalty-free license to host, store, display, and distribute it solely for
          the purpose of operating and promoting the Platform (for example, displaying your post in the For You
          feed, on your profile, or on a shared link to that post).
        </p>
        <p>
          You may delete your own User Content at any time, which removes it from public view, subject to
          reasonable technical delay and to copies that may already have been shared or cached elsewhere.
        </p>
      </LegalSection>

      <LegalSection title="7. Prohibited Conduct">
        <p>You agree not to, and not to help anyone else:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Impersonate another person or misrepresent your identity, qualifications, or affiliation;</li>
          <li>Post content that is unlawful, harassing, hateful, sexually explicit, or fraudulent;</li>
          <li>Circumvent the Platform's booking, payment, or review systems (for example, arranging a booking on the Platform but transacting entirely off it to avoid these Terms);</li>
          <li>Scrape, reverse engineer, or interfere with the Platform's normal operation or security;</li>
          <li>Use the Platform for any purpose that violates applicable law.</li>
        </ul>
      </LegalSection>

      <LegalSection title="8. Account Actions and Termination">
        <p>
          We may warn, suspend, or permanently ban an account that violates these Terms, based on user reports,
          disputes, or other evidence, following the moderation process described in the Platform. You may stop
          using the Platform and request deletion of your account at any time through your account settings.
          Some records (such as a completed booking's history, or a review already left about you) may be
          retained after account deletion as described in our Privacy Policy.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimers">
        <p>
          The Platform is provided "as is" and "as available." CreativeHUB does not guarantee the quality,
          safety, legality, or outcome of any service arranged between a client and a freelancer, and is not
          responsible for the conduct of any user, online or offline. You are responsible for exercising your own
          judgment when arranging and attending a booking with someone you meet through the Platform.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, CreativeHUB and its operators will not be liable for any
          indirect, incidental, special, or consequential damages arising from your use of the Platform, or for
          any dispute between a client and a freelancer, even if advised of the possibility of such damages.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to These Terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we will update the "Last
          updated" date above. Continuing to use the Platform after changes take effect means you accept the
          revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>Questions about these Terms can be sent through the "Report an Issue" option in your account settings.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
