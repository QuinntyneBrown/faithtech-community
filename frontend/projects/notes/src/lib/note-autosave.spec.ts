// Traces to: L2-086 AC8, AC9, L2-094 AC3
import { HttpErrorResponse } from '@angular/common/http';
import { NoteSave, NoteSaved } from '@faithtech-community/api';
import { Subject, of, throwError } from 'rxjs';

import { AUTOSAVE_DELAY_MS, NoteAutosave } from './note-autosave';

describe('NoteAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves once, 800 ms after the last change, with the version it was based on', async () => {
    const sent: NoteSave[] = [];
    const autosave = new NoteAutosave(
      3,
      () => ({ title: 'Run sheet', icon: null, blocks: [] }),
      (page) => {
        sent.push(page);
        return of<NoteSaved>({ version: page.version + 1, updatedAt: '' });
      },
    );

    autosave.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 100);
    autosave.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);

    expect(sent.map((s) => s.version)).toEqual([3]);
    expect(autosave.state()).toBe('saved');
    expect(autosave.currentVersion).toBe(4);
  });

  it('keeps one save in flight and sends later changes with the new version', async () => {
    const responses = new Subject<NoteSaved>();
    const sent: number[] = [];
    const autosave = new NoteAutosave(
      1,
      () => ({ title: '', icon: null, blocks: [] }),
      (page) => {
        sent.push(page.version);
        return sent.length === 1 ? responses : of({ version: page.version + 1, updatedAt: '' });
      },
    );

    autosave.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    autosave.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(sent).toEqual([1]);
    responses.next({ version: 2, updatedAt: '' });
    responses.complete();
    await vi.advanceTimersByTimeAsync(1);

    expect(sent).toEqual([1, 2]);
  });

  it('shows a failure that Retry sends again, and stops for good on a conflict', async () => {
    let status = 503;
    const autosave = new NoteAutosave(
      1,
      () => ({ title: '', icon: null, blocks: [] }),
      () => throwError(() => new HttpErrorResponse({ status })),
    );

    autosave.changed();
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(autosave.state()).toBe('failed');
    expect(autosave.stopped()).toBeNull();

    status = 409;
    autosave.retry();
    await vi.advanceTimersByTimeAsync(1);
    expect(autosave.stopped()?.kind).toBe('conflict');
  });
});
