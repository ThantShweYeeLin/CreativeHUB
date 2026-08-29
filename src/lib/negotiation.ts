// The original request counts as round 1, each counter increments it.
// Once a request reaches this round, the recipient can only Accept or
// Reject — no more countering. Shared by the client and server-side guard
// (DataService.updateRequest) so they can never drift apart.
export const MAX_NEGOTIATION_ROUNDS = 5;
