// Traces to: L2-030 AC3
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ANNOUNCEMENTS_SERVICE } from '@faithtech-community/api';
import { Observable, of, Subject, throwError } from 'rxjs';

import { UnsubscribePage } from './unsubscribe.page';

async function setup(token: string | undefined, unsubscribe: () => Observable<void>) {
  const service = { unsubscribe: vi.fn(unsubscribe) };
  TestBed.configureTestingModule({
    providers: [{ provide: ANNOUNCEMENTS_SERVICE, useValue: service }],
  });
  const fixture = TestBed.createComponent(UnsubscribePage);
  if (token !== undefined) fixture.componentRef.setInput('token', token);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const link = (label: string) =>
    Array.from(host.querySelectorAll('a')).find((a) => a.textContent?.trim() === label);
  return { host, service, settle, link };
}

describe('UnsubscribePage', () => {
  it('opts the reader out from the link without signing in', async () => {
    const { host, service, link } = await setup('tok', () => of(undefined));

    expect(service.unsubscribe).toHaveBeenCalledWith('tok');
    expect(host.querySelector('h1')!.textContent).toContain('You’re unsubscribed');
    expect(host.textContent).toContain('You won’t get announcement emails any more.');
    expect(link('Open settings')!.getAttribute('href')).toBe('/settings');
  });

  it('says it is working while the request is on its way', async () => {
    const pending = new Subject<void>();
    const { host, settle } = await setup('tok', () => pending);

    expect(host.querySelector('h1')!.textContent).toContain('Unsubscribing…');
    pending.next();
    pending.complete();
    await settle();

    expect(host.querySelector('h1')!.textContent).toContain('You’re unsubscribed');
  });

  it('explains a link that does not work and offers settings', async () => {
    const { host, link } = await setup('bad', () =>
      throwError(() => new HttpErrorResponse({ status: 400 })),
    );

    expect(host.querySelector('h1')!.textContent).toContain('This unsubscribe link doesn’t work');
    expect(link('Sign in to settings')!.getAttribute('href')).toBe('/settings');
  });

  it('does not call the API without a token', async () => {
    const { host, service } = await setup(undefined, () => of(undefined));

    expect(service.unsubscribe).not.toHaveBeenCalled();
    expect(host.querySelector('h1')!.textContent).toContain('This unsubscribe link doesn’t work');
  });
});
