import { Injectable, computed, signal } from '@angular/core';

/**
 * Whether a phone tab bar is on screen, so bottom-anchored overlays (the toast region) can sit
 * above it instead of covering navigation. Each `ft-tab-bar` registers while it is rendered.
 */
@Injectable({ providedIn: 'root' })
export class TabBarPresence {
  private readonly count = signal(0);
  readonly present = computed(() => this.count() > 0);

  register(): () => void {
    this.count.update((n) => n + 1);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.count.update((n) => n - 1);
    };
  }
}
