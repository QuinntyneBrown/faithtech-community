// Traces to: L2-193 AC2, AC4 (docs/detailed-designs/events/share-hub-by-qr-code)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { QrCodeComponent } from '@faithtech-community/components';

import { ShareHubData } from './share-hub-data';
import { ShareHubDialog } from './share-hub.dialog';

const LINK = 'https://community.faithtech.example/public/events/e1/hub';

function setup(status: ShareHubData['status']) {
  const ref = { close: vi.fn(), disableClose: false };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: DIALOG_DATA,
        useValue: { eventTitle: 'Toronto Builders Night', link: LINK, status },
      },
      { provide: DialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(ShareHubDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  return { fixture, host, ref };
}

describe('ShareHubDialog', () => {
  it('gives the QR code exactly the hub link, named for the event', () => {
    const { fixture, host } = setup('Published');
    const qr = fixture.debugElement.query(By.directive(QrCodeComponent))
      .componentInstance as QrCodeComponent;

    expect(qr.value()).toBe(LINK);
    expect(qr.alt()).toBe('QR code for the Toronto Builders Night hub');
    expect(host.querySelector<HTMLInputElement>('input')?.value).toBe(LINK);
    expect(host.textContent).not.toContain('Your hub is a draft');
  });

  it('notes a draft hub above the code', () => {
    const { host } = setup('Draft');

    expect(host.textContent).toContain('Your hub is a draft');
    expect(host.textContent).toContain(
      'Until you publish it, the code opens the hub only for people who manage event hubs.',
    );
  });

  it('Done closes the dialog', () => {
    const { host, ref } = setup('Published');
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Done')!
      .click();
    expect(ref.close).toHaveBeenCalled();
  });
});
