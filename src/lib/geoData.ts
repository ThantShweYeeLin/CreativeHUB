// Single source of truth for country/city lookups — CountrySelect, CitySelect,
// and anything else that needs a country/city list all read from here rather
// than each hardcoding their own array. Backed by the country-state-city
// package's bundled dataset, so no API request happens as the user types.
//
// country-state-city's full dataset (every country + every city worldwide)
// is several MB unminified — importing it statically ballooned the app's
// main bundle from ~1.1MB to ~9.4MB, so it's loaded lazily via dynamic
// import() the first time any of these functions are called, not at module
// load time. Everyone who was already on the page before a user opens
// Signup (or any future CountrySelect/CitySelect usage) pays nothing for it.

export interface CountryOption {
  name: string;
  isoCode: string;
  flag: string;
  /** ISO 4217 currency code from the underlying dataset — not guaranteed
   * to be one of this app's SUPPORTED_CURRENCIES; callers should validate
   * before using it as a preference (see lib/currency.ts's
   * isSupportedCurrency). */
  currency: string | null;
}

type CountryStateCityModule = typeof import('country-state-city');

let modulePromise: Promise<CountryStateCityModule> | null = null;
function loadModule(): Promise<CountryStateCityModule> {
  if (!modulePromise) {
    modulePromise = import('country-state-city');
  }
  return modulePromise;
}

let countriesPromise: Promise<CountryOption[]> | null = null;

export function loadCountries(): Promise<CountryOption[]> {
  if (!countriesPromise) {
    countriesPromise = loadModule().then(({ Country }) =>
      Country.getAllCountries().map((c) => ({ name: c.name, isoCode: c.isoCode, flag: c.flag, currency: c.currency || null }))
    );
  }
  return countriesPromise;
}

export async function findCountryByCode(isoCode: string | null | undefined): Promise<CountryOption | undefined> {
  if (!isoCode) return undefined;
  const countries = await loadCountries();
  return countries.find((c) => c.isoCode === isoCode);
}

/** The country's real-world currency, but only if this app actually
 * supports it (see lib/currency.ts) — null otherwise so callers fall back
 * to their own default instead of setting an unsupported code. */
export async function findSupportedCurrencyForCountry(isoCode: string | null | undefined): Promise<string | null> {
  const country = await findCountryByCode(isoCode);
  if (!country?.currency) return null;
  const { isSupportedCurrency, normalizeCurrencyCode } = await import('./currency');
  const code = normalizeCurrencyCode(country.currency, '');
  return code && isSupportedCurrency(code) ? code : null;
}

/** Ranks matches with the query as a name-prefix first (e.g. "My" -> Myanmar before Germany). */
export async function searchCountries(query: string, limit = 8): Promise<CountryOption[]> {
  const countries = await loadCountries();
  const q = query.trim().toLowerCase();
  if (!q) return countries.slice(0, limit);

  const starts: CountryOption[] = [];
  const contains: CountryOption[] = [];
  for (const country of countries) {
    const lower = country.name.toLowerCase();
    if (lower.startsWith(q)) starts.push(country);
    else if (lower.includes(q)) contains.push(country);
  }
  return [...starts, ...contains].slice(0, limit);
}

const cityCache = new Map<string, Promise<string[]>>();

function loadCitiesForCountry(isoCode: string): Promise<string[]> {
  let cached = cityCache.get(isoCode);
  if (!cached) {
    cached = loadModule().then(({ City }) => (City.getCitiesOfCountry(isoCode) || []).map((c) => c.name).sort((a, b) => a.localeCompare(b)));
    cityCache.set(isoCode, cached);
  }
  return cached;
}

export async function searchCities(countryIsoCode: string | null | undefined, query: string, limit = 8): Promise<string[]> {
  if (!countryIsoCode) return [];
  const all = await loadCitiesForCountry(countryIsoCode);
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);

  const starts: string[] = [];
  const contains: string[] = [];
  for (const city of all) {
    const lower = city.toLowerCase();
    if (lower.startsWith(q)) starts.push(city);
    else if (lower.includes(q)) contains.push(city);
  }
  return [...starts, ...contains].slice(0, limit);
}
