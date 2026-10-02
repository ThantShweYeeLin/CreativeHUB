import { Router } from 'express';
import { z } from 'zod';

// Proxies Nominatim (OpenStreetMap geocoding) server-side instead of the
// browser calling it directly. A browser fetch() can't set a real
// User-Agent (Nominatim's usage policy requires one identifying the
// application) and is routinely blocked or fails outright depending on the
// network/browser - this is what "Load failed"/"Failed to fetch" in the
// location picker actually was. A server-to-server request has neither
// problem.
const router = Router();
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'CreativeHUB-App/1.0 (location picker; contact via app support)';

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  // Nominatim itself caps useful results well below this; bounding it stops
  // a caller from asking for an arbitrarily large upstream response.
  limit: z.coerce.number().int().min(1).max(10).optional().default(5),
  countrycodes: z.string().trim().max(100).optional(),
  lang: z.string().trim().max(10).optional(),
});
const reverseQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  lang: z.string().trim().max(10).optional(),
});

router.get('/search', async (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(422).json({ message: 'q is required.' });
  const { q, limit, countrycodes, lang } = parsed.data;

  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    q,
  });
  if (countrycodes) params.set('countrycodes', countrycodes);

  try {
    const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': lang === 'th' ? 'th' : 'en',
        'User-Agent': USER_AGENT,
      },
    });
    if (!response.ok) return res.status(502).json({ message: 'Unable to contact the geocoding service.' });
    return res.json(await response.json());
  } catch {
    return res.status(502).json({ message: 'Unable to contact the geocoding service.' });
  }
});

router.get('/reverse', async (req, res) => {
  const parsed = reverseQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(422).json({ message: 'lat and lon are required.' });
  const { lat, lon, lang } = parsed.data;

  const params = new URLSearchParams({ format: 'json', addressdetails: '1', lat: String(lat), lon: String(lon) });

  try {
    const response = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': lang === 'th' ? 'th' : 'en',
        'User-Agent': USER_AGENT,
      },
    });
    if (!response.ok) return res.status(502).json({ message: 'Unable to contact the geocoding service.' });
    return res.json(await response.json());
  } catch {
    return res.status(502).json({ message: 'Unable to contact the geocoding service.' });
  }
});

export default router;
