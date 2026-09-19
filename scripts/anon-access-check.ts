// Verifies the API refuses an anonymous caller (public anon key, no session).
// Needs supabase/lock_down_anonymous_access.sql applied, and - for the
// Express checks - the backend running (default http://localhost:4000/api).
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anon = createClient(URL, process.env.VITE_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const API_BASE = process.env.API_BASE_URL || 'http://localhost:4000/api';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`, detail ?? ''); }
}

async function main() {
  console.log('Supabase tables (anon key, no session)');
  const spec = await (await fetch(`${URL}/rest/v1/`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } })).json();
  for (const table of Object.keys(spec.definitions)) {
    const { data, error } = await anon.from(table).select('*').limit(1);
    check(`${table}: anonymous read returns no rows`, !!error || !data || data.length === 0, `${data?.length} row(s) leaked`);
  }

  console.log('Supabase RPCs (anon key, no session)');
  for (const path of Object.keys(spec.paths).filter((p) => p.startsWith('/rpc/'))) {
    const name = path.slice(5);
    const { data, error } = await anon.rpc(name, {});
    check(`rpc ${name}: not executable anonymously`, !!error && /permission denied|Could not find|JWT/i.test(error.message), data ?? error?.message);
  }

  console.log('Express API (no bearer token)');
  for (const [method, path] of [['GET', '/freelancers'], ['GET', '/bookings'], ['GET', '/feed/for-you'], ['POST', '/chatbot/message'], ['POST', '/payments/charge'], ['DELETE', '/account']] as const) {
    try {
      const res = await fetch(`${API_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
      check(`${method} ${path} -> 401`, res.status === 401, `status ${res.status}`);
    } catch (e) {
      check(`${method} ${path} reachable`, false, `backend not running at ${API_BASE}`);
    }
  }
  try {
    const res = await fetch(`${API_BASE}/freelancers`, { headers: { Authorization: 'Bearer not-a-real-token' } });
    check('GET /freelancers with a forged token -> 401', res.status === 401, `status ${res.status}`);
  } catch { check('forged-token request reachable', false); }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();
