/**
 * PartnerDuplicateRules (backend/src/FaithTech.Community.Application/Partners/PartnerDuplicates.cs)
 * for the fake: exact matches on normalised keys, website before name (ADR 0023).
 */
const SUFFIXES = [
  'inc',
  'incorporated',
  'ltd',
  'limited',
  'llc',
  'corp',
  'corporation',
  'co',
  'company',
];

/** The host only: no scheme, port, path, query or fragment; lowercase; one leading www. and a trailing dot removed. */
export function normaliseHost(website: string | null): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`)
      .hostname;
  } catch {
    return null;
  }
  host = host.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  if (host.endsWith('.')) host = host.slice(0, -1);
  return host || null;
}

/** Accents folded, lowercase, punctuation and symbols deleted, whitespace collapsed, one trailing suffix removed. */
export function normaliseName(name: string | null): string | null {
  if (!name) return null;
  const words = name
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length > 1 && SUFFIXES.includes(words[words.length - 1])) words.pop();
  return words.join(' ') || null;
}

export type DuplicateReason = 'Website' | 'Name';

export function match(
  a: { name: string; website: string | null },
  b: { name: string; website: string | null },
): DuplicateReason | null {
  const hostA = normaliseHost(a.website);
  if (hostA && hostA === normaliseHost(b.website)) return 'Website';
  const nameA = normaliseName(a.name);
  if (nameA && nameA === normaliseName(b.name)) return 'Name';
  return null;
}
