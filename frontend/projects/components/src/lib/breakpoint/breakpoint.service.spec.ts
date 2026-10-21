import { TestBed } from '@angular/core/testing';
import { BreakpointService } from './breakpoint.service';

/** Fake matchMedia driven by a viewport width, supporting min-width queries. */
function mockViewport(initial: number) {
  let width = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => {
    const min = Number(/min-width:\s*([\d.]+)px/.exec(query)?.[1]);
    return {
      get matches() {
        return width >= min;
      },
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    };
  });
  return {
    resize(next: number) {
      width = next;
      listeners.forEach((l) => l());
    },
  };
}

describe('BreakpointService', () => {
  afterEach(() => vi.unstubAllGlobals());
  const create = () => TestBed.inject(BreakpointService);

  it('is the base (phone) layout under 640px', () => {
    mockViewport(360);
    const bp = create();
    expect(bp.current()).toBe('base');
    expect(bp.isAtLeast('sm')()).toBe(false);
    expect(bp.columns()).toBe(4);
  });

  it.each([
    [640, 'sm', 4],
    [768, 'md', 8],
    [1024, 'lg', 12],
    [1280, 'xl', 12],
    [1536, '2xl', 12],
  ] as const)('at %ipx is %s with %i columns', (width, name, columns) => {
    mockViewport(width);
    const bp = create();
    expect(bp.current()).toBe(name);
    expect(bp.columns()).toBe(columns);
  });

  it('exposes mobile-first helpers', () => {
    mockViewport(800);
    const bp = create();
    expect(bp.isAtLeast('md')()).toBe(true);
    expect(bp.isAtLeast('lg')()).toBe(false);
    expect(bp.isMobile()).toBe(true);
    expect(bp.isDesktop()).toBe(false);
  });

  it('updates when the viewport changes', () => {
    const viewport = mockViewport(360);
    const bp = create();
    viewport.resize(1100);
    expect(bp.current()).toBe('lg');
    expect(bp.isDesktop()).toBe(true);
    expect(bp.isMobile()).toBe(false);
  });

  it('falls back to base when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(create().current()).toBe('base');
  });
});
