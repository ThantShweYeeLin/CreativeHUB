import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { searchCities } from '../../lib/geoData';

interface CitySelectProps {
  countryIsoCode: string | null;
  value: string | null;
  onChange: (city: string | null) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Type-to-search city dropdown, scoped to whichever country is currently
 * selected. Disabled until a country is chosen. This component does not
 * clear `value` on its own when `countryIsoCode` changes — the caller owns
 * that (pass `city: null` alongside the new country) so "switching country
 * clears city" stays an explicit, visible decision at the call site.
 */
export function CitySelect({ countryIsoCode, value, onChange, placeholder = 'Search for your city', required }: CitySelectProps) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [results, setResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const disabled = !countryIsoCode;

  useEffect(() => {
    if (!isOpen || disabled) return;
    let cancelled = false;
    setIsLoading(true);
    searchCities(countryIsoCode, query).then((matches) => {
      if (cancelled) return;
      setResults(matches);
      setIsLoading(false);
      setHighlightedIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [countryIsoCode, query, isOpen, disabled]);

  // `value` is the source of truth for what's displayed — when the caller
  // clears it (e.g. because the Country field changed), this field follows.
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Closing the dropdown without picking a suggestion (click elsewhere,
  // Tab out) still commits whatever was typed — the local dataset is good
  // but not exhaustive for every small town, so free text is the fallback
  // rather than forcing a match the way Country does.
  const commitTypedQuery = () => {
    const trimmed = query.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    else if (!trimmed && value) onChange(null);
  };

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        commitTypedQuery();
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [value, query]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCity = (city: string) => {
    onChange(city);
    setQuery(city);
    setIsOpen(false);
  };

  const clearSelection = () => {
    onChange(null);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const match = results[highlightedIndex];
      if (match) selectCity(match);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setQuery(value || '');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={query}
          required={required}
          disabled={disabled}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a country first' : placeholder}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-9 text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
        />
        {value && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear city"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && !disabled && isLoading && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500 shadow-lg">Loading cities…</div>
      )}

      {isOpen && !disabled && !isLoading && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.map((city, index) => (
            <li key={city}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCity(city)}
                className={`block w-full px-4 py-2.5 text-left text-sm text-gray-900 ${index === highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                {city}
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && !disabled && !isLoading && query.trim() && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500 shadow-lg">
          No matching cities — you can still type your own.
        </div>
      )}
    </div>
  );
}
