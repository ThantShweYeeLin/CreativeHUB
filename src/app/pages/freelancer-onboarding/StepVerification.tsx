import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';

interface StepVerificationProps {
  emailVerified: boolean;
  phoneVerified: boolean;
  onPhoneVerifiedChange: (value: boolean) => void;
  identityStatus: 'not_submitted' | 'pending' | 'verified';
  onIdentityStatusChange: (value: 'not_submitted' | 'pending' | 'verified') => void;
}

export function StepVerification({
  emailVerified,
  phoneVerified,
  onPhoneVerifiedChange,
  identityStatus,
  onIdentityStatusChange,
}: StepVerificationProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          {emailVerified ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-gray-300" />}
          <div>
            <p className="text-sm font-bold text-gray-900">Email</p>
            <p className="text-xs text-gray-500">{emailVerified ? 'Verified' : 'Not yet verified'}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          {phoneVerified ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-gray-300" />}
          <div>
            <p className="text-sm font-bold text-gray-900">Phone</p>
            <p className="text-xs text-gray-500">{phoneVerified ? 'Verified' : 'Not verified'}</p>
          </div>
        </div>
        {!phoneVerified && (
          <button
            type="button"
            onClick={() => onPhoneVerifiedChange(true)}
            className="rounded-xl border-2 border-gray-900 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white"
          >
            Simulate verification
          </button>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className={`h-5 w-5 ${identityStatus === 'verified' ? 'text-green-600' : 'text-gray-300'}`} />
          <div>
            <p className="text-sm font-bold text-gray-900">Identity</p>
            <p className="text-xs text-gray-500 capitalize">{identityStatus.replace('_', ' ')}</p>
          </div>
        </div>
        {identityStatus === 'not_submitted' && (
          <button
            type="button"
            onClick={() => onIdentityStatusChange('pending')}
            className="rounded-xl border-2 border-gray-900 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-900 hover:text-white"
          >
            Submit
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Phone and identity verification are simulated for this project and aren't connected to a real SMS or
        government ID-checking service.
      </p>
    </div>
  );
}
