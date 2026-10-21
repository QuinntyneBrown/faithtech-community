import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'ft-theme';

function mockSystemDark(dark: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    change(next: boolean) {
      mql.matches = next;
      listeners.forEach((l) => l());
    },
  };
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    mockSystemDark(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const create = () => TestBed.inject(ThemeService);

  it('defaults to following the system with no data-theme attribute', () => {
    const theme = create();
    expect(theme.preference()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('sets data-theme on <html> when a theme is forced', () => {
    const theme = create();
    theme.set('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    theme.set('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('removes data-theme when returning to system', () => {
    const theme = create();
    theme.set('dark');
    theme.set('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('resolves system to the device preference and tracks changes', () => {
    const media = mockSystemDark(true);
    const theme = create();
    expect(theme.resolved()).toBe('dark');
    media.change(false);
    expect(theme.resolved()).toBe('light');
  });

  it('resolves a forced theme regardless of the device', () => {
    mockSystemDark(true);
    const theme = create();
    theme.set('light');
    expect(theme.resolved()).toBe('light');
  });

  it('persists the preference and restores it on startup', () => {
    create().set('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    TestBed.resetTestingModule();
    const restored = create();
    expect(restored.preference()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores an invalid stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'sunrise');
    expect(create().preference()).toBe('system');
  });

  it('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const theme = create();
    expect(() => theme.set('dark')).not.toThrow();
    expect(theme.preference()).toBe('dark');
  });
});
