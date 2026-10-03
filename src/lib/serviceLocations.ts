// Freelancer-side coverage preset ("will travel anywhere"). It describes where
// a freelancer will work, not a place a client can book, so it must never be
// offered as a booking location.
export const TRAVEL_ANYWHERE_PRESET = 'Open to travel anywhere';

export function isBookableLocation(address: string) {
  return address !== TRAVEL_ANYWHERE_PRESET;
}
