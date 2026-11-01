// Traces to: L2-156 AC4, AC6 (docs/detailed-designs/events/fill-in-hub-sections)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { ReorderHubSectionsDialog } from './reorder-hub-sections.dialog';

function setup(reorder = vi.fn<() => Observable<void>>(() => of(undefined))) {
  const ref = { close: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: EVENT_HUBS_SERVICE, useValue: { reorder } },
      { provide: DialogRef, useValue: ref },
      {
        provide: DIALOG_DATA,
        useValue: {
          eventId: 'e1',
          sections: [
            { id: 'Hero', title: 'Hero' },
            { id: 'Agenda', title: 'Agenda' },
            { id: 'Venue', title: 'Venue' },
          ],
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ReorderHubSectionsDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
    )!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, reorder, button, settle };
}

describe('ReorderHubSectionsDialog', () => {
  it('saves every section in its new order and closes', async () => {
    const { ref, reorder, button, settle } = setup();

    button('Move Agenda down').click();
    await settle();
    button('Save').click();
    await settle();

    expect(reorder).toHaveBeenCalledWith('e1', ['Hero', 'Venue', 'Agenda']);
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('keeps the order and offers Try again when the save fails', async () => {
    const failing = vi.fn<() => Observable<void>>(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const { host, ref, button, settle } = setup(failing);

    button('Move Agenda down').click();
    await settle();
    button('Save').click();
    await settle();

    expect(host.textContent).toContain('We couldn’t save the order');
    expect(ref.close).not.toHaveBeenCalled();
    failing.mockReturnValue(of(undefined));
    button('Try again').click();
    await settle();
    expect(failing).toHaveBeenLastCalledWith('e1', ['Hero', 'Venue', 'Agenda']);
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
