import { Router } from 'express';

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

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(422).json({ message: 'q is required.' });

  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: String(req.query.limit || 5),
    q,
  });
  if (req.query.countrycodes) params.set('countrycodes', String(req.query.countrycodes));

  try {
    const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': req.query.lang === 'th' ? 'th' : 'en',
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
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(422).json({ message: 'lat and lon are required.' });

  const params = new URLSearchParams({ format: 'json', addressdetails: '1', lat: String(lat), lon: String(lon) });

  try {
    const response = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': req.query.lang === 'th' ? 'th' : 'en',
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
