import { DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { CONNECT_SERVICE } from '@faithtech-community/api';
import { ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { MyQrCodeDialog } from './my-qr-code.dialog';

const LINK = 'https://community.faithtech.example/meet/old-token';
const NEW_LINK = 'https://community.faithtech.example/meet/new-token';

async function setup(getMyLink: () => Observable<{ url: string }> = () => of({ url: LINK })) {
  const connect = {
    getMyLink: vi.fn(getMyLink),
    replaceMyLink: vi.fn(() => of({ url: NEW_LINK })),
  };
  const ref = { close: vi.fn() };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: CONNECT_SERVICE, useValue: connect },
      { provide: DialogRef, useValue: ref },
      { provide: ToastService, useValue: toasts },
    ],
  });
  const fixture = TestBed.createComponent(MyQrCodeDialog);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  const link = () => host.querySelector<HTMLInputElement>('ft-copy-field input')?.value;
  return { fixture, host, connect, ref, toasts, button, link, settle };
}

describe('MyQrCodeDialog', () => {
  it('shows the QR code and the link, and says what scanning does', async () => {
    const { host, link } = await setup();

    expect(host.querySelector('h2')!.textContent).toContain('My QR code');
    expect(host.querySelector('svg[role="img"]')!.getAttribute('aria-label')).toBe(
      'QR code for your connect link',
    );
    expect(link()).toBe(LINK);
    expect(host.textContent).toContain('added to your private contacts');
    expect(host.textContent).toContain('The link gives no role.');
  });

  it('asks before making a new code, then shows the new link', async () => {
    const { host, connect, button, link, settle } = await setup();

    button('Make a new code')!.click();
    await settle();
    expect(host.querySelector('h2')!.textContent).toContain('Make a new QR code?');
    expect(connect.replaceMyLink).not.toHaveBeenCalled();

    button('Make a new code')!.click();
    await settle();

    expect(connect.replaceMyLink).toHaveBeenCalledTimes(1);
    expect(link()).toBe(NEW_LINK);
    expect(host.textContent).toContain('New code ready');
  });

  it('keeps the code when the lead changes their mind', async () => {
    const { connect, button, link, settle } = await setup();

    button('Make a new code')!.click();
    await settle();
    button('Keep this code')!.click();
    await settle();

    expect(connect.replaceMyLink).not.toHaveBeenCalled();
    expect(link()).toBe(LINK);
  });

  it('keeps the current code when a new one cannot be made', async () => {
    const { host, connect, button, link, settle } = await setup();
    connect.replaceMyLink.mockReturnValue(throwError(() => new Error('offline')));

    button('Make a new code')!.click();
    await settle();
    button('Make a new code')!.click();
    await settle();

    expect(host.textContent).toContain('New code not made');
    expect(link()).toBe(LINK);
  });

  it('offers Try again when the code cannot be loaded', async () => {
    const { host, connect, button, link, settle } = await setup(() =>
      throwError(() => new Error('offline')),
    );
    expect(host.textContent).toContain('We couldn’t load your code');
    connect.getMyLink.mockReturnValue(of({ url: LINK }));

    button('Try again')!.click();
    await settle();

    expect(link()).toBe(LINK);
  });

  it('closes on Done', async () => {
    const { ref, button } = await setup();
    button('Done')!.click();
    expect(ref.close).toHaveBeenCalled();
  });
});
