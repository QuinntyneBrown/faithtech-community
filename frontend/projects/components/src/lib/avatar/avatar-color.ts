import type { AvatarColor } from './avatar.component';

/** The seven person colours, in a fixed order; plain is reserved for people who are not members. */
export const AVATAR_COLORS = ['sky', 'sun', 'lilac', 'sage', 'rose', 'mint', 'peach'] as const;

/**
 * A member's avatar colour, derived from their profile id (ADR 0008) so every screen that shows
 * them computes the same colour without storing it. No id (an unlinked contact) is plain.
 */
export function avatarColorFor(memberId: string | null | undefined): AvatarColor {
  const key = (memberId ?? '').trim().toLowerCase();
  if (!key) return 'plain';
  // FNV-1a, 32-bit: small, stable and well spread for GUIDs.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
