// Traces to: L2-005
import { AVATAR_COLORS, avatarColorFor } from './avatar-color';

describe('avatarColorFor', () => {
  it('gives the same member the same colour every time, whatever the id’s case', () => {
    const id = '3f2b8c1e-0d4a-4e6b-9a7f-1c2d3e4f5a6b';
    expect(avatarColorFor(id)).toBe(avatarColorFor(id));
    expect(avatarColorFor(id.toUpperCase())).toBe(avatarColorFor(id));
  });

  it('only ever picks one of the seven person colours, never plain', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `member-${i}`);
    for (const id of ids) {
      expect(AVATAR_COLORS).toContain(avatarColorFor(id));
    }
  });

  it('spreads members across all seven colours', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `member-${i}`);
    expect(new Set(ids.map(avatarColorFor)).size).toBe(7);
  });

  it('is plain when there is no member id', () => {
    expect(avatarColorFor('')).toBe('plain');
    expect(avatarColorFor(null)).toBe('plain');
    expect(avatarColorFor(undefined)).toBe('plain');
  });
});
