import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';

export type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/** Min-widths in px, matching --layout-breakpoint-* in the tokens (40, 48, 64, 80, 96rem). */
const MIN_WIDTH: Readonly<Record<Exclude<Breakpoint, 'base'>, number>> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};
const ORDER: readonly Breakpoint[] = ['base', 'sm', 'md', 'lg', 'xl', '2xl'];

/** Mobile-first viewport state as signals, designed at 360px first (foundations/responsive). */
@Injectable({ providedIn: 'root' })
export class BreakpointService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly index = signal(0);

  /** The largest breakpoint whose min-width the viewport meets. */
  readonly current = computed<Breakpoint>(() => ORDER[this.index()]);
  /** Grid columns at the current breakpoint: 4 base, 8 from md, 12 from lg. */
  readonly columns = computed(() => (this.index() >= 3 ? 12 : this.index() >= 2 ? 8 : 4));
  /** Under 1024px: the phone and tablet layouts. */
  readonly isMobile = computed(() => this.index() < 3);
  readonly isDesktop = computed(() => !this.isMobile());

  constructor() {
    if (typeof this.window?.matchMedia !== 'function') return;
    const queries = ORDER.slice(1).map((name) =>
      this.window!.matchMedia(`(min-width: ${MIN_WIDTH[name as keyof typeof MIN_WIDTH]}px)`),
    );
    const update = () => this.index.set(queries.filter((q) => q.matches).length);
    queries.forEach((q) => q.addEventListener('change', update));
    update();
  }

  /** Signal that is true from the given breakpoint upwards. */
  isAtLeast(breakpoint: Breakpoint) {
    return computed(() => this.index() >= ORDER.indexOf(breakpoint));
  }
}
