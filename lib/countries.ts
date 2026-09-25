export interface Country {
  code: string; // ISO alpha-2, e.g. "NG"
  name: string; // common name, e.g. "Nigeria"
}

export const MIN_QUERY_LENGTH = 3;

export class CountrySearchError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'CountrySearchError';
    this.status = status;
  }
}

// `/name` is the API's name aggregate (common, official, alternates, native names).
// It gives cleaner typeahead matches than the free-text `?q=` on the root endpoint.
const BASE_URL = 'https://api.restcountries.com/countries/v5';

// Tiny in-memory cache: the free plan is capped at 500 requests/month.
const cache = new Map<string, Country[]>();

export const flagUrl = (code: string) =>
  `https://flags.restcountries.com/v5/w160/${code.toLowerCase()}.png`;

const messageForStatus = (status: number) => {
  switch (status) {
    case 401:
      return 'API key missing or rejected (401).';
    case 403:
      return 'Access blocked (403): monthly quota reached or origin not allowed.';
    case 429:
      return 'Too many requests (429). Wait a few seconds.';
    default:
      return `Server responded with ${status}.`;
  }
};

export async function searchCountries(query: string, signal: AbortSignal): Promise<Country[]> {
  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.NEXT_PUBLIC_RESTCOUNTRIES_API_KEY;
  if (!apiKey) {
    throw new CountrySearchError('NEXT_PUBLIC_RESTCOUNTRIES_API_KEY is not set in .env.local.');
  }

  const params = new URLSearchParams({
    q: query,
    limit: '8',
    response_fields: 'names.common,codes.alpha_2',
  });

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err; // cancelled on purpose
    throw new CountrySearchError(
      navigator.onLine
        ? 'Network error. If this persists, add this origin to your API key\'s allowed origins.'
        : 'You appear to be offline.',
    );
  }

  if (!res.ok) throw new CountrySearchError(messageForStatus(res.status), res.status);

  const json = await res.json(); // rejects with AbortError if cancelled mid-body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const objects: any[] = json?.data?.objects ?? [];

  const countries: Country[] = objects
    .filter((o) => o?.names?.common)
    .map((o) => ({ name: o.names.common, code: o.codes?.alpha_2 ?? o.names.common }));

  cache.set(cacheKey, countries);
  return countries;
}
