/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 */
import { toHttpParams } from './http-params';

describe('toHttpParams', () => {
  it('drops null, undefined and empty values', () => {
    const params = toHttpParams({ q: 'ada', city: null, role: undefined, term: '' });

    expect(params.keys()).toEqual(['q']);
    expect(params.get('q')).toBe('ada');
  });

  it('stringifies numbers and booleans, keeping zero and false', () => {
    const params = toHttpParams({ page: 0, archived: false });

    expect(params.get('page')).toBe('0');
    expect(params.get('archived')).toBe('false');
  });
});
