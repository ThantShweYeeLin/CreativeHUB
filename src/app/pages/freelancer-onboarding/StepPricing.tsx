import { getSupportedCurrencyCodes } from '../../../lib/currency';
import { PRICING_TYPE_OPTIONS } from './types';

interface StepPricingProps {
  pricingType: string;
  onPricingTypeChange: (value: string) => void;
  startingPrice: string;
  onStartingPriceChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  minPrice: string;
  onMinPriceChange: (value: string) => void;
  maxPrice: string;
  onMaxPriceChange: (value: string) => void;
}

export function StepPricing({
  pricingType,
  onPricingTypeChange,
  startingPrice,
  onStartingPriceChange,
  currency,
  onCurrencyChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
}: StepPricingProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-gray-700">Pricing Type</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {PRICING_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPricingTypeChange(option.value)}
              className={`rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-all ${
                pricingType === option.value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-700">Starting Price</label>
        <div className="flex gap-3">
          <select
            value={currency}
            onChange={(event) => onCurrencyChange(event.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            {getSupportedCurrencyCodes().map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={startingPrice}
            onChange={(event) => onStartingPriceChange(event.target.value)}
            placeholder="3000"
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Minimum budget (optional)</label>
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={(event) => onMinPriceChange(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Maximum budget (optional)</label>
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(event) => onMaxPriceChange(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>
    </div>
  );
}
