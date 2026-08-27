import { Star } from 'lucide-react';
import type { TrustLevel } from '../../lib/trustLevel';

export function TrustBadge({ trust }: { trust: TrustLevel }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
      <div className="flex items-center">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={`h-3.5 w-3.5 ${index < trust.stars ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-gray-700">{trust.label}</span>
    </div>
  );
}
