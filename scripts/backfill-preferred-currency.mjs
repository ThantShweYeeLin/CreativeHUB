// One-time backfill: users.preferred_currency has a DB-level default of
// 'THB', so accounts that never explicitly touched Settings' currency
// picker are stuck showing THB pricing everywhere (including onboarding's
// budget-range options) regardless of their actual country. This finds
// accounts still sitting at that default with a country on file and
// derives their real currency from it, same lookup authService.signUp now
// does for new signups. Safe to re-run — only ever touches rows still at
// the exact 'THB' default.
//
// Usage: node scripts/backfill-preferred-currency.mjs

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { Country } from 'country-state-city';

const envPath = new URL('../.env.local', import.meta.url);
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((line) => line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Mirrors src/lib/currency.ts's SUPPORTED_CURRENCIES codes.
const SUPPORTED_CURRENCIES = new Set(['THB', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'MYR', 'AUD', 'CAD', 'MMK', 'INR', 'CNY']);

function currencyForCountryCode(isoCode) {
  const country = Country.getAllCountries().find((c) => c.isoCode === isoCode);
  const code = (country?.currency || '').trim().toUpperCase();
  return code && SUPPORTED_CURRENCIES.has(code) ? code : null;
}

async function run() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, country, country_code, preferred_currency')
    .eq('preferred_currency', 'THB')
    .not('country_code', 'is', null);

  if (error) {
    console.error('Failed to load users:', error.message);
    process.exit(1);
  }

  let updated = 0;
  let unchanged = 0;
  let unsupported = 0;

  for (const user of users) {
    const derived = currencyForCountryCode(user.country_code);
    if (!derived || derived === 'THB') {
      unchanged += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ preferred_currency: derived })
      .eq('id', user.id);

    if (updateError) {
      console.log(`  FAIL  ${user.id}  ${user.full_name || ''}  — ${updateError.message}`);
      unsupported += 1;
      continue;
    }

    updated += 1;
    console.log(`  ok    ${user.id}  ${user.full_name || '(no name)'}  ${user.country} -> ${derived}`);
  }

  console.log('\nPreferred Currency Backfill Complete\n');
  console.log(`Accounts still at the THB default with a country on file: ${users.length}`);
  console.log(`Updated to their country's currency: ${updated}`);
  console.log(`Left as THB (country's currency is THB or unsupported): ${unchanged}`);
  if (unsupported) console.log(`Failed to write: ${unsupported}`);
}

run();
