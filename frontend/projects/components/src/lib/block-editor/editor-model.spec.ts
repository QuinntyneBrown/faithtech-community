import {
  describeBlock,
  hasMark,
  insertSpans,
  linkAt,
  normalise,
  removeRange,
  setHref,
  setMark,
  shortcutFor,
  splitSpans,
} from './editor-model';

describe('block editor model', () => {
  it('joins neighbouring runs with the same marks and drops empty ones', () => {
    expect(normalise([{ text: 'Doors ' }, { text: '' }, { text: 'open' }])).toEqual([
      { text: 'Doors open' },
    ]);
    expect(normalise([{ text: 'a', bold: true }, { text: 'b' }])).toEqual([
      { text: 'a', bold: true },
      { text: 'b' },
    ]);
  });

  it('splits runs at a character offset, keeping their marks', () => {
    const [before, after] = splitSpans([{ text: 'Doors ' }, { text: 'open at 6', bold: true }], 10);
    expect(before).toEqual([{ text: 'Doors ' }, { text: 'open', bold: true }]);
    expect(after).toEqual([{ text: ' at 6', bold: true }]);
  });

  it('never cuts a page link in two', () => {
    const spans = [{ text: 'See ' }, { text: 'Run sheet', pageId: 'n2' }];
    expect(splitSpans(spans, 6)).toEqual([
      [{ text: 'See ' }],
      [{ text: 'Run sheet', pageId: 'n2' }],
    ]);
  });

  it('sets and clears a mark over a range and knows when the whole range has it', () => {
    const bold = setMark([{ text: 'Doors open at 6' }], 6, 10, 'bold', true);
    expect(bold).toEqual([{ text: 'Doors ' }, { text: 'open', bold: true }, { text: ' at 6' }]);
    expect(hasMark(bold, 6, 10, 'bold')).toBe(true);
    expect(hasMark(bold, 0, 10, 'bold')).toBe(false);
    expect(setMark(bold, 6, 10, 'bold', false)).toEqual([{ text: 'Doors open at 6' }]);
  });

  it('links and unlinks text, and finds the link under the caret', () => {
    const linked = setHref([{ text: 'our page' }], 4, 8, 'https://faithtech.community');
    expect(linkAt(linked, 6)).toEqual({ href: 'https://faithtech.community', start: 4, end: 8 });
    expect(setHref(linked, 4, 8, null)).toEqual([{ text: 'our page' }]);
  });

  it('inserts and removes runs at offsets', () => {
    const spans = insertSpans([{ text: 'See  now' }], 4, [{ text: 'Run sheet', pageId: 'n2' }]);
    expect(spans).toEqual([
      { text: 'See ' },
      { text: 'Run sheet', pageId: 'n2' },
      { text: ' now' },
    ]);
    expect(removeRange([{ text: 'Plan /hea' }], 5, 9)).toEqual([{ text: 'Plan ' }]);
  });

  it('recognises markdown shortcuts at the start of a block', () => {
    expect(shortcutFor('## ')?.type).toBe('heading2');
    expect(shortcutFor('[] ')?.type).toBe('todo');
    expect(shortcutFor('1. ')?.type).toBe('numbered');
    expect(shortcutFor('Hello #')).toBeNull();
  });

  it('names a block by its type and first words for move announcements', () => {
    expect(describeBlock({ id: 'b', type: 'heading2', text: [{ text: 'Run sheet' }] })).toBe(
      'Heading 2 “Run sheet”',
    );
    expect(describeBlock({ id: 'b', type: 'divider' })).toBe('Divider');
  });
});
