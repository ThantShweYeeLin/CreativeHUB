import { useNavigate } from 'react-router';
import { LegalPageLayout } from './LegalPageLayout';
import { PrivacyPolicyContent } from './PrivacyPolicyContent';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <LegalPageLayout title="Privacy Policy" updatedLabel="Last updated September 2026">
      <PrivacyPolicyContent onLinkToTerms={() => navigate('/terms')} />
    </LegalPageLayout>
  );
}
