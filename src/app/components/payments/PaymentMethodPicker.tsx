import { useEffect, useState } from 'react';
import { CheckCircle, Circle, CreditCard, Plus, Star, Trash2, X } from 'lucide-react';
import { DataService } from '../../../lib/dataService';
import { detectCardBrand, formatCardLabel, formatCardNumberInput, last4Of, validateCardDetails } from '../../../lib/paymentCard';

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  cardholder_name: string;
  is_default: boolean;
}

interface PaymentMethodPickerProps {
  userId: string;
  selectable?: boolean;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string) => void;
  onMethodsChange?: (methods: PaymentMethod[]) => void;
}

export function PaymentMethodPicker({ userId, selectable = false, selectedId, onSelectedIdChange, onMethodsChange }: PaymentMethodPickerProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setIsLoading(true);
      const response = await DataService.getPaymentMethods(userId);
      if (!isMounted) return;
      const loaded = (response.data || []) as PaymentMethod[];
      setMethods(loaded);
      setIsLoading(false);
      if (selectable && !selectedId && loaded.length > 0) {
        const preferred = loaded.find((m) => m.is_default) || loaded[0];
        onSelectedIdChange?.(preferred.id);
      }
    })();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    onMethodsChange?.(methods);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methods]);

  const handleAddCard = async () => {
    setFormError(null);
    const expMonthNum = Number(expMonth);
    const expYearNum = expYear.length === 2 ? 2000 + Number(expYear) : Number(expYear);

    const validationError = validateCardDetails({ cardholderName, cardNumber, expMonth: expMonthNum, expYear: expYearNum, cvc });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    const response = await DataService.addPaymentMethod(userId, {
      cardholderName: cardholderName.trim(),
      brand: detectCardBrand(cardNumber),
      last4: last4Of(cardNumber),
      expMonth: expMonthNum,
      expYear: expYearNum,
    });
    setIsSaving(false);

    if (response.error || !response.data) {
      setFormError((response.error as any)?.message || 'Unable to save card.');
      return;
    }

    const added = response.data as PaymentMethod;
    setMethods((current) => (added.is_default ? [added, ...current.map((m) => ({ ...m, is_default: false }))] : [...current, added]));
    setShowAddForm(false);
    setCardholderName('');
    setCardNumber('');
    setExpMonth('');
    setExpYear('');
    setCvc('');
    if (selectable) onSelectedIdChange?.(added.id);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const response = await DataService.deletePaymentMethod(id);
    setDeletingId(null);
    if (response.error) return;
    setMethods((current) => current.filter((m) => m.id !== id));
    if (selectable && selectedId === id) onSelectedIdChange?.('');
  };

  const handleSetDefault = async (id: string) => {
    const response = await DataService.setDefaultPaymentMethod(userId, id);
    if (response.error) return;
    setMethods((current) => current.map((m) => ({ ...m, is_default: m.id === id })));
  };

  if (isLoading) {
    return <div className="py-4 text-sm text-gray-500">Loading payment methods...</div>;
  }

  return (
    <div>
      {methods.length === 0 && !showAddForm && <p className="mb-3 text-sm text-gray-500">No saved payment methods yet.</p>}

      {methods.length > 0 && (
        <div className="mb-3 space-y-2">
          {methods.map((method) => (
            <div
              key={method.id}
              onClick={() => selectable && onSelectedIdChange?.(method.id)}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-colors ${
                selectable && selectedId === method.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
              } ${selectable ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center gap-3">
                {selectable &&
                  (selectedId === method.id ? (
                    <CheckCircle className="h-4 w-4 flex-shrink-0 text-gray-900" />
                  ) : (
                    <Circle className="h-4 w-4 flex-shrink-0 text-gray-300" />
                  ))}
                <CreditCard className="h-5 w-5 flex-shrink-0 text-gray-400" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{formatCardLabel(method)}</p>
                  <p className="text-xs text-gray-500">
                    {method.cardholder_name} · Expires {String(method.exp_month).padStart(2, '0')}/{String(method.exp_year).slice(-2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {method.is_default ? (
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white">DEFAULT</span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSetDefault(method.id);
                    }}
                    className="text-gray-400 hover:text-amber-500"
                    title="Set as default"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(method.id);
                  }}
                  disabled={deletingId === method.id}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showAddForm ? (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" /> Add new card
        </button>
      ) : (
        <div className="rounded-xl border-2 border-gray-900 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-bold text-gray-900">Add a card</p>
            <button
              onClick={() => {
                setShowAddForm(false);
                setFormError(null);
              }}
              className="text-gray-400 hover:text-gray-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
              placeholder="e.g. 4242 4242 4242 4242"
              inputMode="numeric"
              maxLength={23}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Expiry month</label>
                <input
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="e.g. 04"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">Expiry year</label>
                <input
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 2028"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-gray-500">CVC</label>
                <input
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 123"
                  inputMode="numeric"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <button
              type="button"
              onClick={() => void handleAddCard()}
              disabled={isSaving}
              className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Card'}
            </button>
            <p className="text-center text-[11px] text-gray-400">Simulated for demo purposes — no real card data is transmitted.</p>
          </div>
        </div>
      )}
    </div>
  );
}
