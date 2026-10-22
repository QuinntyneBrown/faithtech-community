import { NotePageSummary } from '@faithtech-community/api';
import { formatDay } from '@faithtech-community/components';

/** "Untitled" for a page whose title is empty (L2-086 AC2). */
export function titleOf(page: { title: string }): string {
  return page.title.trim() || 'Untitled';
}

/** "Edited Tue 21 Oct · you" (L2-085 AC2). */
export function editedLine(page: NotePageSummary): string {
  return `Edited ${formatDay(page.updatedAt)} · ${page.isOwn ? 'you' : page.ownerName}`;
}

/** The visibility badge from the viewer's side, nothing for Global (L2-085 AC3). */
export function badgeOf(
  page: NotePageSummary,
): { text: string; variant: 'neutral' | 'info' } | null {
  if (page.visibility === 'Private') return { text: 'Private', variant: 'neutral' };
  if (page.visibility === 'Shared') {
    return { text: page.sharedWithYou ? 'Shared with you' : 'Shared', variant: 'info' };
  }
  return null;
}
