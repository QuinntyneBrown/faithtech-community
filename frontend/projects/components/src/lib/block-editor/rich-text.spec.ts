import { caretOffset, readSpans, renderSpans, setSelection } from './rich-text';

describe('rich text DOM', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('div');
    el.contentEditable = 'true';
    document.body.append(el);
  });

  afterEach(() => el.remove());

  it('renders runs with their marks and reads them back unchanged', () => {
    const spans = [
      { text: 'Start ' },
      { text: 'here', bold: true, italic: true },
      { text: ' and ' },
      { text: 'FT-TOR', code: true },
      { text: ' or ' },
      { text: 'the site', href: 'https://faithtech.community' },
    ];
    renderSpans(el, spans, { editable: true });

    expect(el.querySelector('strong em')?.textContent).toBe('here');
    expect(el.querySelector('a')?.getAttribute('rel')).toBe('noopener');
    expect(readSpans(el)).toEqual(spans);
  });

  it('never turns typed text into markup', () => {
    renderSpans(el, [{ text: '<img src=x onerror=alert(1)>' }], { editable: true });
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('renders a page link the viewer cannot open as "Private page", not a link', () => {
    renderSpans(el, [{ text: 'Private page', pageId: 'n9' }], {
      editable: false,
      pageLink: () => ({ text: 'Private page', icon: null, href: null }),
    });
    expect(el.querySelector('a')).toBeNull();
    expect(el.textContent).toBe('Private page');
  });

  it('reads browser line breaks and bold tags', () => {
    el.append('one', document.createElement('br'), 'two');
    const b = document.createElement('b');
    b.textContent = '!';
    el.append(b);
    expect(readSpans(el)).toEqual([{ text: 'one\ntwo' }, { text: '!', bold: true }]);
  });

  it('places the caret at a character offset across marks and reads it back', () => {
    renderSpans(el, [{ text: 'Doors ' }, { text: 'open', bold: true }, { text: ' at 6' }], {
      editable: true,
    });
    setSelection(el, 8);
    expect(caretOffset(el)).toBe(8);
  });
});
