// Traces to: L2-164 AC3, L2-165 AC3 (docs/detailed-designs/events/preview-and-publish-hub)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { EVENT_HUBS_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { UnpublishHubDialog } from './unpublish-hub.dialog';

function setup(unpublish: () => Observable<void>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { unpublish: vi.fn(unpublish) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: { eventId: 'e1' } },
      { provide: DialogRef, useValue: ref },
      { provide: EVENT_HUBS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(UnpublishHubDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  return { host, ref, service, button, settle };
}

describe('UnpublishHubDialog', () => {
  it('unpublishes the hub and closes with true', async () => {
    const { ref, service, button, settle } = setup(() => of(undefined));

    button('Unpublish').click();
    await settle();

    expect(service.unpublish).toHaveBeenCalledWith('e1');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('Cancel closes with false and changes nothing', () => {
    const { ref, service, button } = setup(() => of(undefined));

    button('Cancel').click();

    expect(service.unpublish).not.toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(false);
  });

  it('stays open after a failure and Try again unpublishes', async () => {
    let calls = 0;
    const { host, ref, button, settle } = setup(() =>
      calls++ === 0 ? throwError(() => new HttpErrorResponse({ status: 500 })) : of(undefined),
    );

    button('Unpublish').click();
    await settle();
    expect(host.textContent).toContain('We couldn’t unpublish the hub');
    expect(ref.close).not.toHaveBeenCalled();

    button('Try again').click();
    await settle();
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
