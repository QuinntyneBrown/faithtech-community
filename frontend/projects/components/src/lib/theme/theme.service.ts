import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'ft-theme';
const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * Light, dark or follow-the-device theme. A forced theme is written to `data-theme` on `<html>`;
 * `system` removes the attribute so the prefers-color-scheme rules in the tokens apply.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemQuery = this.document.defaultView?.matchMedia?.(
    '(prefers-color-scheme: dark)',
  );
  private readonly systemDark = signal(this.systemQuery?.matches ?? false);
  private readonly current = signal<ThemePreference>(this.read());

  readonly preference = this.current.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.current();
    return preference === 'system' ? (this.systemDark() ? 'dark' : 'light') : preference;
  });

  constructor() {
    this.systemQuery?.addEventListener('change', () =>
      this.systemDark.set(this.systemQuery?.matches ?? false),
    );
    this.apply(this.current());
  }

  set(preference: ThemePreference): void {
    this.current.set(preference);
    this.apply(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage can be blocked; the theme still applies for this session.
    }
  }

  private apply(preference: ThemePreference): void {
    const root = this.document.documentElement;
    if (preference === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', preference);
    }
  }

  private read(): ThemePreference {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
      return stored && PREFERENCES.includes(stored) ? stored : 'system';
    } catch {
      return 'system';
    }
  }
}
