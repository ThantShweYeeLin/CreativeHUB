import { useState } from 'react';
import { Landmark, Lock, ShieldCheck, User } from 'lucide-react';

export const BANK_OPTIONS = [
  'Bangkok Bank',
  'Kasikorn Bank',
  'Siam Commercial Bank (SCB)',
  'Krungthai Bank',
  'Krungsri (Bank of Ayudhya)',
  'TMBThanachart Bank (ttb)',
  'Government Savings Bank (GSB)',
  'CIMB Thai Bank',
  'UOB Thailand',
  'Kiatnakin Phatra Bank',
];

export const formatAccountNumber = (value: string) =>
  value
    .replace(/\D/g, '')
    .slice(0, 18)
    .replace(/(\d{4})(?=\d)/g, '$1-');

interface StepBillingProps {
  bankName: string;
  onBankNameChange: (value: string) => void;
  accountHolderName: string;
  onAccountHolderNameChange: (value: string) => void;
  accountNumber: string;
  onAccountNumberChange: (value: string) => void;
}

export function StepBilling({
  bankName,
  onBankNameChange,
  accountHolderName,
  onAccountHolderNameChange,
  accountNumber,
  onAccountNumberChange,
}: StepBillingProps) {
  const [showOtherBank, setShowOtherBank] = useState(() => bankName !== '' && !BANK_OPTIONS.includes(bankName));

  const inputClass =
    'w-full rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-sky-400';

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-sm text-gray-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <span>
          This is where deposits get paid out once a booking completes — required so you can actually get paid. You can
          still update it later from Freelancer Dashboard → Settings.
        </span>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Bank <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Landmark className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <select
            value={showOtherBank ? 'Other' : bankName}
            onChange={(event) => {
              if (event.target.value === 'Other') {
                setShowOtherBank(true);
                onBankNameChange('');
              } else {
                setShowOtherBank(false);
                onBankNameChange(event.target.value);
              }
            }}
            className={`${inputClass} appearance-none pl-11`}
          >
            <option value="" disabled>
              Select your bank
            </option>
            {BANK_OPTIONS.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
            <option value="Other">Other bank</option>
          </select>
        </div>
        {showOtherBank && (
          <input
            value={bankName}
            onChange={(event) => onBankNameChange(event.target.value)}
            placeholder="Enter your bank's name"
            className={`${inputClass} mt-2`}
          />
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Account holder name <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={accountHolderName}
            onChange={(event) => onAccountHolderNameChange(event.target.value)}
            placeholder="Full name as it appears on the bank account"
            className={`${inputClass} pl-11`}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">Must match your bank account exactly, or payouts may be delayed.</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Account number <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={accountNumber}
            onChange={(event) => onAccountNumberChange(formatAccountNumber(event.target.value))}
            placeholder="e.g. 123-4567-8901"
            inputMode="numeric"
            autoComplete="off"
            className={`${inputClass} pl-11 font-mono tracking-wide`}
          />
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Encrypted and used only to send your payouts — clients never see your bank details.</span>
      </p>
    </div>
  );
}
