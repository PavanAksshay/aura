/**
 * The operator's account. Not a secret — it only gates which UI surfaces are
 * offered. Every owner-only API is enforced independently on the backend
 * against the JWT-verified email (see core/quota.py `_is_owner`), so this
 * constant controls visibility, never authorization.
 */
export const OWNER_EMAIL = "pavanaksshay07@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}
