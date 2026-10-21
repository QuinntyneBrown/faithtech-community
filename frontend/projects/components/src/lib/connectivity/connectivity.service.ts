import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';

/** Online/offline state of the browser, kept current from the window online and offline events. */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly state = signal(this.window?.navigator.onLine ?? true);

  readonly online = this.state.asReadonly();
  readonly offline = computed(() => !this.state());

  constructor() {
    this.window?.addEventListener('online', () => this.state.set(true));
    this.window?.addEventListener('offline', () => this.state.set(false));
  }
}
