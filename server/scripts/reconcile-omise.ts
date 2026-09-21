// Omise does not guarantee webhook retries. This is the safety net: it lists
// recent charges from Omise's API and activates any PAID Freelancer Premium
// charge that never made it into subscription_payments, using exactly the same
// verification + idempotent activation as checkout and the webhook. Safe to run
// on a schedule or by hand; running it twice changes nothing.
//
//   npm run reconcile:omise            (from server/; needs OMISE_SECRET_KEY + Supabase env)
import dotenv from 'dotenv';
dotenv.config();
const { omiseClient } = await import('../src/lib/omiseClient.js');
const { createSupabaseAdminClient } = await import('../src/lib/supabase.js');
const { verifyAndActivate } = await import('../src/lib/premiumCharges.js');
const { defaultWebhookDeps } = await import('../src/routes/omiseWebhook.js');

const deps = defaultWebhookDeps();
const admin = createSupabaseAdminClient();

const page: any = await (omiseClient.charges as any).list({ limit: 100, order: 'reverse_chronological' });
const charges: any[] = page.data || [];
const recorded = new Set(((await admin.from('subscription_payments').select('omise_charge_id')).data || []).map((r: any) => r.omise_charge_id));

let activated = 0, alreadyOk = 0, skipped = 0, problems = 0;
for (const charge of charges) {
  if (charge.metadata?.kind !== 'freelancer_premium') { skipped++; continue; }
  if (recorded.has(charge.id)) { alreadyOk++; continue; }
  const result = await verifyAndActivate(deps, charge, { eventKey: 'reconcile' });
  if (result.status === 'activated') { activated++; console.log(`activated ${charge.id} for ${result.userId}`); }
  else if (result.status === 'ignored') { skipped++; } // unpaid/failed/pending charges are not owed anything
  else { problems++; console.log(`NEEDS ATTENTION ${charge.id}: ${result.status} - ${result.reason}`); }
}

const { data: errors } = await admin.from('payment_events').select('omise_charge_id, reason, created_at').in('outcome', ['error', 'rejected']).order('created_at', { ascending: false }).limit(20);
console.log(`\nchecked ${charges.length} recent charges: ${activated} newly activated, ${alreadyOk} already recorded, ${skipped} not applicable, ${problems} need attention`);
if ((errors || []).length) {
  console.log('\nRecent webhook/checkout failures (payment_events):');
  for (const e of errors!) console.log(` - ${e.created_at} ${e.omise_charge_id}: ${e.reason}`);
}
