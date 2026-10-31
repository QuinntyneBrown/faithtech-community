// Traces to: L2-055, L2-057
import { ResourceSummary } from '@faithtech-community/api';

import {
  badgeOf,
  downloadLabel,
  guessType,
  isAllowed,
  metaLine,
  openLabel,
  resolveGuess,
  titleFrom,
  typeIcon,
} from './resource-format';

const deck: ResourceSummary = {
  id: 'r1',
  title: 'City launch deck',
  type: 'deck',
  typeName: 'Deck',
  fileName: 'city-launch-deck.pptx',
  extension: 'pptx',
  size: 24.6 * 1024 * 1024,
  linkUrl: null,
  linkHost: null,
  ownerId: 'p1',
  ownerName: 'Grace Okonkwo',
  isOwn: true,
  visibility: 'Global',
  sharedWithYou: false,
  hasThumbnail: false,
  isStored: true,
  addedAt: '2026-10-20T12:00:00Z',
};

describe('resource formatting', () => {
  it('writes the list meta line with “you” for the member’s own resources', () => {
    expect(metaLine(deck)).toBe('Deck · PPTX · 24.6 MB · you · Tue 20 Oct');
  });

  it('shows a link’s host in place of the file type and size', () => {
    const link = {
      ...deck,
      type: 'template',
      typeName: 'Template',
      extension: null,
      size: null,
      linkHost: 'docs.google.com',
      isOwn: false,
      ownerName: 'Marcus Lee',
    };
    expect(metaLine(link)).toBe('Template · docs.google.com · Marcus Lee · Tue 20 Oct');
    expect(openLabel(link)).toBe('Open City launch deck on docs.google.com (opens in a new tab)');
  });

  it('names the download with its type and size', () => {
    expect(downloadLabel(deck)).toBe('Download City launch deck, PPTX, 24.6 MB');
  });

  it('badges visibility from the viewer’s side, and nothing for Global', () => {
    expect(badgeOf(deck)).toBeNull();
    expect(badgeOf({ visibility: 'Private', sharedWithYou: false })!.text).toBe('Private');
    expect(badgeOf({ visibility: 'Shared', sharedWithYou: false })!.text).toBe('Shared');
    expect(badgeOf({ visibility: 'Shared', sharedWithYou: true })!.text).toBe('Shared with you');
  });

  it('guesses the title and type from the file name', () => {
    expect(titleFrom('city-launch-deck.pptx')).toBe('city-launch-deck');
    expect([
      guessType('a.KEY'),
      guessType('b.jpeg'),
      guessType('c.svg'),
      guessType('d.csv'),
      guessType('e.mp4'),
    ]).toEqual(['deck', 'image', 'logo', 'document', 'other']);
  });

  // L2-146 AC3: the guess maps by key onto the organisation's active types, else to other.
  it('maps the guess onto the active types, or to other', () => {
    const active = [{ key: 'deck' }, { key: 'document' }, { key: 'other' }];
    expect([
      resolveGuess('pitch.pptx', active),
      resolveGuess('notes.pdf', active),
      resolveGuess('logo.svg', active),
    ]).toEqual(['deck', 'document', 'other']);
  });

  it('shows a file icon for a type the guess never answers', () => {
    expect(typeIcon({ type: 'poster', extension: 'pdf' })).toBe('file');
    expect(typeIcon({ type: 'deck', extension: 'pptx' })).toBe('deck');
  });

  it('allows only the listed extensions up to 100 MB', () => {
    expect(isAllowed(new File(['x'], 'deck.pptx'))).toBe(true);
    expect(isAllowed(new File(['x'], 'setup.exe'))).toBe(false);
    expect(isAllowed(new File([], 'empty.pdf'))).toBe(false);
  });
});
