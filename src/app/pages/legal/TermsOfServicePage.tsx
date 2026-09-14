import { useNavigate } from 'react-router';
import { LegalPageLayout } from './LegalPageLayout';
import { TermsOfServiceContent } from './TermsOfServiceContent';

export function TermsOfServicePage() {
  const navigate = useNavigate();

  return (
    <LegalPageLayout title="Terms of Service" updatedLabel="Last updated September 2026">
      <TermsOfServiceContent onLinkToPrivacy={() => navigate('/privacy')} />
    </LegalPageLayout>
  );
}
