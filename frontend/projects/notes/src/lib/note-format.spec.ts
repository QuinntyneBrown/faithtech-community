// Traces to: L2-085, L2-086
import { NotePageSummary } from '@faithtech-community/api';

import { badgeOf, editedLine, titleOf } from './note-format';

const page: NotePageSummary = {
  id: 'n1',
  title: 'Builders Night run sheet',
  icon: '🛠️',
  ownerId: 'p1',
  ownerName: 'Grace Okonkwo',
  isOwn: false,
  visibility: 'Global',
  sharedWithYou: false,
  updatedAt: '2026-10-20T12:00:00Z',
  updatedByName: 'Grace Okonkwo',
  parentTitle: null,
};

describe('note format', () => {
  it('names an empty title "Untitled"', () => {
    expect(titleOf({ title: '  ' })).toBe('Untitled');
    expect(titleOf(page)).toBe('Builders Night run sheet');
  });

  it('shows when it was edited and by whose page, "you" for the member’s own', () => {
    expect(editedLine(page)).toBe('Edited Tue 20 Oct · Grace Okonkwo');
    expect(editedLine({ ...page, isOwn: true })).toBe('Edited Tue 20 Oct · you');
    expect(editedLine({ ...page, parentTitle: 'Private page' })).toBe(
      'Edited Tue 20 Oct · Grace Okonkwo · in Private page',
    );
  });

  it('badges visibility from the viewer’s side and nothing for Global', () => {
    expect(badgeOf(page)).toBeNull();
    expect(badgeOf({ ...page, visibility: 'Private' })?.text).toBe('Private');
    expect(badgeOf({ ...page, visibility: 'Shared' })?.text).toBe('Shared');
    expect(badgeOf({ ...page, visibility: 'Shared', sharedWithYou: true })?.text).toBe(
      'Shared with you',
    );
  });
});
