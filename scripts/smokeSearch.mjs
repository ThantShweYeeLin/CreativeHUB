#!/usr/bin/env node
/*
Simple smoke script to test searching full_name and freelancer_profiles
Usage:
  VITE_SUPABASE_URL=https://your.supabase.co VITE_SUPABASE_ANON_KEY=anonkey node scripts/smokeSearch.mjs "search term"
*/
import process from 'process';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the environment.');
  process.exit(1);
}

const term = process.argv[2] || '';
if (!term) {
  console.error('Provide a search term as the first argument.');
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchUsersByName(q) {
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/users?select=id,full_name,email&full_name=ilike.*${encodeURIComponent(q)}*&limit=200`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Users fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchFreelancersByUserIds(userIds, q) {
  const base = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/freelancer_profiles?select=*,users:user_id(id,full_name,email,avatar_url)`;
  const parts = [];
  if (q) {
    parts.push(`title=ilike.*${encodeURIComponent(q)}*`);
    parts.push(`description=ilike.*${encodeURIComponent(q)}*`);
  }
  if (userIds && userIds.length > 0) {
    // in operator expects comma separated UUIDs
    parts.push(`user_id=in.(${userIds.join(',')})`);
  }

  const url = `${base}${parts.length ? `&or=(${parts.join(',')})` : ''}&is_available=eq.true&limit=200`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Freelancers fetch failed: ${res.status} ${res.statusText}`);
  return res.json();
}

(async () => {
  try {
    console.log(`Searching users for "${term}"...`);
    const users = await fetchUsersByName(term);
    console.log(`Found ${users.length} users matching name/email.`);

    const userIds = users.map(u => u.id).filter(Boolean);

    console.log('Searching freelancer_profiles (title/description + matched user_ids)...');
    const freelancers = await fetchFreelancersByUserIds(userIds, term);
    console.log(`Found ${freelancers.length} freelancer profiles.`);

    for (const f of freelancers) {
      console.log('---');
      console.log(`profile id: ${f.id}`);
      console.log(`user_id: ${f.user_id}`);
      console.log(`title: ${f.title}`);
      console.log(`user full_name: ${f.users?.full_name}`);
      console.log(`user email: ${f.users?.email}`);
    }
  } catch (err) {
    console.error('Error during smoke search:', err.message || err);
    process.exit(2);
  }
})();
