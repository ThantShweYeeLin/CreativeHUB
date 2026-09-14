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
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        This is where deposits get paid out once a booking completes — required so you can actually get paid. You can
        still update it later from Freelancer Dashboard → Settings.
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Bank name</label>
        <input
          value={bankName}
          onChange={(event) => onBankNameChange(event.target.value)}
          placeholder="e.g. Kasikorn Bank"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Account holder name</label>
        <input
          value={accountHolderName}
          onChange={(event) => onAccountHolderNameChange(event.target.value)}
          placeholder="Name on the bank account"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Account number</label>
        <input
          value={accountNumber}
          onChange={(event) => onAccountNumberChange(event.target.value)}
          placeholder="Bank account number"
          inputMode="numeric"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
    </div>
  );
}
