import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { NoteSave, NoteSaved } from '@faithtech-community/api';
import { SaveState } from '@faithtech-community/components';
import { Observable, firstValueFrom } from 'rxjs';

export const AUTOSAVE_DELAY_MS = 800;

/** Why autosave stopped: the page changed elsewhere (409), the caller lost edit rights (403) or it is gone (404). */
export type SaveStop =
  { kind: 'conflict'; body: unknown } | { kind: 'forbidden' } | { kind: 'missing' };

/**
 * Whole-page autosave (L2-086 AC8, AC9; ADR 0023): a save 800 ms after the last change, never more than one in
 * flight, each based on the version the last save returned. A refused save stops autosave for good.
 */
export class NoteAutosave {
  readonly state = signal<SaveState>('unsaved');
  readonly stopped = signal<SaveStop | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private dirty = false;

  constructor(
    private version: number,
    private readonly snapshot: () => Omit<NoteSave, 'version'>,
    private readonly send: (page: NoteSave) => Observable<NoteSaved>,
  ) {}

  get currentVersion(): number {
    return this.version;
  }

  /** Something changed: save once things are quiet. */
  changed(): void {
    if (this.stopped()) return;
    this.dirty = true;
    if (!this.inFlight) this.state.set('unsaved');
    this.schedule(AUTOSAVE_DELAY_MS);
  }

  retry(): void {
    if (this.stopped()) return;
    this.dirty = true;
    this.schedule(0);
  }

  /** Starts again from a freshly loaded page, after "Reload page" (L2-094 AC4). */
  reset(version: number): void {
    this.cancel();
    this.version = version;
    this.dirty = false;
    this.stopped.set(null);
    this.state.set('unsaved');
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delay: number): void {
    this.cancel();
    this.timer = setTimeout(() => void this.flush(), delay);
  }

  private async flush(): Promise<void> {
    this.timer = null;
    if (this.inFlight || !this.dirty || this.stopped()) return;
    this.inFlight = true;
    this.dirty = false;
    this.state.set('saving');
    try {
      const saved = await firstValueFrom(this.send({ ...this.snapshot(), version: this.version }));
      this.version = saved.version;
      this.state.set(this.dirty ? 'saving' : 'saved');
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      if (status === 409)
        this.stopped.set({ kind: 'conflict', body: (error as HttpErrorResponse).error });
      else if (status === 403) this.stopped.set({ kind: 'forbidden' });
      else if (status === 404) this.stopped.set({ kind: 'missing' });
      else {
        this.dirty = true;
        this.state.set('failed');
        return;
      }
      this.state.set('failed');
    } finally {
      this.inFlight = false;
    }
    // Changes made while the save was in flight go out now, with the new version.
    if (this.dirty && !this.stopped()) this.schedule(0);
  }
}
