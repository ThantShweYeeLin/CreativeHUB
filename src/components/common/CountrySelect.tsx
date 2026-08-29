import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { findCountryByCode, searchCountries, type CountryOption } from '../../lib/geoData';

interface CountrySelectProps {
  value: string | null; // ISO code, e.g. "TH"
  onChange: (isoCode: string | null) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Type-to-search country dropdown backed by the local country-state-city
 * dataset — no API call per keystroke, and the (multi-MB) dataset itself is
 * only fetched via dynamic import() the first time this mounts, not bundled
 * into the app's main chunk. Shared by every screen that needs a country
 * picker (signup today; Edit Profile / freelancer profile can reuse it
 * later without duplicating this list or its search logic).
 */
export function CountrySelect({ value, onChange, placeholder = 'Search for your country', required }: CountrySelectProps) {
  const [selected, setSelected] = useState<CountryOption | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [results, setResults] = useState<CountryOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    findCountryByCode(value).then((country) => {
      if (cancelled) return;
      setSelected(country);
      setQuery(country?.name || '');
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setIsLoading(true);
    searchCountries(query).then((matches) => {
      if (cancelled) return;
      setResults(matches);
      setIsLoading(false);
      setHighlightedIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [query, isOpen]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery(selected?.name || '');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [selected?.name]);

  const selectCountry = (country: CountryOption) => {
    onChange(country.isoCode);
    setQuery(country.name);
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
      if (match) selectCountry(match);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setQuery(selected?.name || '');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {selected && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base">{selected.flag}</span>}
        <input
          type="text"
          value={query}
          required={required}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            if (selected) onChange(null);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-gray-200 py-3 pr-9 ${selected ? 'pl-10' : 'pl-4'} text-gray-900 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-900`}
        />
        {selected && (
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear country"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && isLoading && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500 shadow-lg">Loading countries…</div>
      )}

      {isOpen && !isLoading && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.map((country, index) => (
            <li key={country.isoCode}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCountry(country)}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${
                  index === highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-base">{country.flag}</span>
                <span className="text-gray-900">{country.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && !isLoading && query.trim() && results.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-500 shadow-lg">
          No matching countries.
        </div>
      )}
    </div>
  );
}
