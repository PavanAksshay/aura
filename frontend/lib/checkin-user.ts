/**
 * The single account shown the daily well-being check-in and her own
 * conversation view. Not a secret — it only controls which UI is offered; the
 * backend independently gates every check-in API on the JWT-verified email
 * (see app/api/routes/checkin.py). Keep in step with checkin_user_email there.
 */
export const CHECKIN_EMAIL = "chandhanasd2007@gmail.com";

export function isCheckinEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === CHECKIN_EMAIL;
}
