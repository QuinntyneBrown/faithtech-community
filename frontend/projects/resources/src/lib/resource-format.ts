import {
  OTHER_RESOURCE_TYPE,
  ResourceSummary,
  ResourceType,
  ResourceVisibility,
  ROLE_LABELS,
  Role,
} from '@faithtech-community/api';
import { BadgeVariant, formatDay, formatFileSize } from '@faithtech-community/components';

/** The upload rules shown in the add dialog and checked again by the server (L2-057 AC1, AC7). */
export const ALLOWED_EXTENSIONS = [
  'pptx',
  'ppt',
  'key',
  'pdf',
  'docx',
  'doc',
  'xlsx',
  'csv',
  'png',
  'jpg',
  'svg',
  'gif',
  'webp',
  'mp4',
  'zip',
];
export const MAX_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 20;
export const LIMITS =
  'Up to 20 files, 100 MB each. PPTX, PPT, KEY, PDF, DOCX, DOC, XLSX, CSV, PNG, JPG, SVG, GIF, WEBP, MP4 or ZIP.';

export function refusal(fileName: string): string {
  return `${fileName} can’t be added. Use PPTX, PPT, KEY, PDF, DOCX, DOC, XLSX, CSV, PNG, JPG, SVG, GIF, WEBP, MP4 or ZIP, up to 100 MB. For longer video, add a link instead.`;
}

/** "jpeg" counts as "jpg"; lower-case, without the dot. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const ext = dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
  return ext === 'jpeg' ? 'jpg' : ext;
}

export function isAllowed(file: File): boolean {
  return (
    ALLOWED_EXTENSIONS.includes(extensionOf(file.name)) && file.size > 0 && file.size <= MAX_BYTES
  );
}

export function titleFrom(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return (dot > 0 ? fileName.slice(0, dot) : fileName).trim().slice(0, 120);
}

/** The type key guessed from an extension, as ResourceFileTypes.GuessType answers it (L2-146 AC3). */
export function guessType(fileName: string): ResourceType {
  const ext = extensionOf(fileName);
  if (['pptx', 'ppt', 'key'].includes(ext)) return 'deck';
  if (['png', 'jpg', 'gif', 'webp'].includes(ext)) return 'image';
  if (ext === 'svg') return 'logo';
  if (['pdf', 'docx', 'doc', 'xlsx', 'csv'].includes(ext)) return 'document';
  return OTHER_RESOURCE_TYPE;
}

/**
 * The guess mapped onto the organisation's active types, as ResourceTypeResolver maps it: the type with the guessed
 * key, or other when the organisation has no active type with that key (L2-146 AC3).
 */
export function resolveGuess(fileName: string, active: readonly { key: string }[]): ResourceType {
  const key = guessType(fileName);
  return active.some((t) => t.key === key) ? key : OTHER_RESOURCE_TYPE;
}

/** Icons for the keys the upload guess answers; any other type shows a file. */
const TYPE_ICONS: Partial<Record<ResourceType, string>> = {
  deck: 'deck',
  logo: 'logo',
  image: 'image',
  training: 'training',
  template: 'template',
  document: 'document',
};

export function typeIcon(resource: Pick<ResourceSummary, 'type' | 'extension'>): string {
  return resource.extension === 'mp4' ? 'video' : (TYPE_ICONS[resource.type] ?? 'file');
}

/** "PPTX · 24.6 MB" for a file, the host for a link. */
export function fileOrHost(
  resource: Pick<ResourceSummary, 'extension' | 'size' | 'linkHost'>,
): string {
  return (
    resource.linkHost ??
    `${resource.extension!.toUpperCase()} · ${formatFileSize(resource.size ?? 0)}`
  );
}

/** "Deck · PPTX · 24.6 MB · you · Mon 20 Oct" (L2-055 AC2). */
export function metaLine(resource: ResourceSummary): string {
  return [
    resource.typeName,
    fileOrHost(resource),
    resource.isOwn ? 'you' : resource.ownerName,
    formatDay(resource.addedAt),
  ].join(' · ');
}

/** The visibility badge from the viewer's side (L2-055 AC3); none for Global. */
export function badgeOf(
  resource: Pick<ResourceSummary, 'visibility' | 'sharedWithYou'>,
): { text: string; variant: BadgeVariant } | null {
  if (resource.visibility === 'Private') return { text: 'Private', variant: 'neutral' };
  if (resource.visibility === 'Shared')
    return { text: resource.sharedWithYou ? 'Shared with you' : 'Shared', variant: 'info' };
  return null;
}

export function downloadLabel(resource: ResourceSummary): string {
  return `Download ${resource.title}, ${fileOrHost(resource).replace(' · ', ', ')}`;
}

export function openLabel(resource: Pick<ResourceSummary, 'title' | 'linkHost'>): string {
  return `Open ${resource.title} on ${resource.linkHost} (opens in a new tab)`;
}

export function visibilityLine(visibility: ResourceVisibility): string {
  return {
    Global: 'Global — every signed-in member',
    Private: 'Private — only you',
    Shared: 'Shared — the people and roles below',
  }[visibility];
}

export function roleLabel(role: Role | string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

/** Hands the browser a fetched file under its own name. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
