import { Router } from 'express';
import { z } from 'zod';
import { omiseClient } from '../lib/omiseClient.js';

const router = Router();

// Phase A plumbing only — this proves the server<->Omise round-trip works
// (real Omise charge, real test-mode money movement) before Phase B
// (premium subscriptions) and Phase C (deposit commission) build on it.
// Deliberately not auth-gated yet: nothing here is tied to a real user,
// booking, or subscription — it only exists to verify the pipe. Both later
// phases add their own auth (a signed-in user for Premium, the booking's
// own client for a deposit) once there's something real to attach a charge
// to.
const chargeSchema = z.object({
  token: z.string().min(1),
  // Omise amounts are in the smallest currency unit — satang for THB
  // (100 satang = 1 THB) — never a decimal baht figure.
  amountSatang: z.number().int().positive(),
  description: z.string().optional(),
});

router.post('/charge', async (req, res) => {
  const parsed = chargeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid request.', issues: parsed.error.issues });
  }

  const { token, amountSatang, description } = parsed.data;

  try {
    const charge = await omiseClient.charges.create({
      amount: amountSatang,
      currency: 'thb',
      card: token,
      description: description || 'CreativeHUB test charge',
      capture: true,
    });

    if (!charge.paid) {
      return res.status(402).json({
        message: charge.failure_message || 'The charge was not successful.',
        code: charge.failure_code,
        status: charge.status,
      });
    }

    return res.json({
      id: charge.id,
      status: charge.status,
      amount: charge.amount,
      currency: charge.currency,
      paid: charge.paid,
    });
  } catch (error) {
    console.error('Omise charge failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to process the charge.';
    return res.status(500).json({ message });
  }
});

export default router;
