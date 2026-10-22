/**
 * The "kept session" hint (ADR 0018): a non-secret cookie the community app writes while it keeps a
 * "Keep me signed in" session, so the marketing page on another host of the same site can send a member
 * straight to the app. It grants nothing; the app still validates the session itself.
 */
export const SESSION_HINT_COOKIE = 'ftc.signed-in';

const KEPT_FOR_SECONDS = 14 * 24 * 60 * 60;

export function writeSessionHint(domain: string | undefined): void {
  document.cookie = hintCookie(domain, '1', KEPT_FOR_SECONDS);
}

export function clearSessionHint(domain: string | undefined): void {
  document.cookie = hintCookie(domain, '', 0);
}

export function hasSessionHint(): boolean {
  return document.cookie.split('; ').includes(`${SESSION_HINT_COOKIE}=1`);
}

function hintCookie(domain: string | undefined, value: string, maxAge: number): string {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  const scope = domain ? `; Domain=${domain}` : '';
  return `${SESSION_HINT_COOKIE}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${scope}${secure}`;
}
