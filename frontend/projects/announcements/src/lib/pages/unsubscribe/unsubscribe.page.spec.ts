// Traces to: L2-030 AC3
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ANNOUNCEMENTS_SERVICE } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { UnsubscribePage } from './unsubscribe.page';

async function setup(token: string | undefined, unsubscribe: () => Observable<void>) {
  const service = { unsubscribe: vi.fn(unsubscribe) };
  TestBed.configureTestingModule({
    providers: [{ provide: ANNOUNCEMENTS_SERVICE, useValue: service }],
  });
  const fixture = TestBed.createComponent(UnsubscribePage);
  (fixture.componentRef as ComponentRef<UnsubscribePage>).setInput('token', token);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  return { fixture, host: fixture.nativeElement as HTMLElement, service, settle };
}

describe('UnsubscribePage', () => {
  it('turns announcement emails off with the link’s token, without a sign-in', async () => {
    const { host, service } = await setup('tok-123', () => of(undefined));

    expect(service.unsubscribe).toHaveBeenCalledWith('tok-123');
    expect(host.querySelector('h1')!.textContent).toContain('You’re unsubscribed');
    expect(host.textContent).toContain('We won’t email you announcements any more.');
    expect(host.querySelector('a[href="/settings"]')).not.toBeNull();
  });

  it('says it is working while the link is checked', async () => {
    const pending = new Subject<void>();
    const { host } = await setup('tok-123', () => pending);

    expect(host.querySelector('h1')!.textContent).toContain('Turning off announcement emails…');
    expect(host.querySelector('[role="status"]')).not.toBeNull();
  });

  it('explains a link that does not work and points to Settings', async () => {
    const { host } = await setup('bad', () =>
      throwError(() => new HttpErrorResponse({ status: 400 })),
    );

    expect(host.querySelector('h1')!.textContent).toContain('This unsubscribe link doesn’t work');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('a[href="/settings"]')).not.toBeNull();
  });

  it('does not call the API without a token', async () => {
    const { host, service } = await setup(undefined, () => of(undefined));

    expect(service.unsubscribe).not.toHaveBeenCalled();
    expect(host.querySelector('h1')!.textContent).toContain('This unsubscribe link doesn’t work');
  });
});
