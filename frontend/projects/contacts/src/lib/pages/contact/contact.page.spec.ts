// Traces to: L2-012, L2-013
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE, ContactDto, ContactNoteDto } from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { ContactPage } from './contact.page';

function contactDto(overrides: Partial<ContactDto> = {}): ContactDto {
  return {
    id: 'c1',
    name: 'Tomás Ortega',
    email: 'tomas.ortega@example.org',
    phone: '416-555-0142',
    organization: 'Harbour Light Shelter',
    city: 'Toronto',
    linkedProfileId: null,
    photoUrl: null,
    photoAltText: null,
    match: null,
    archivedAtUtc: null,
    noteCount: 0,
    isOwn: true,
    ...overrides,
  };
}

async function setupContactPage(
  get: () => Observable<ContactDto>,
  options: { notes?: () => Observable<ContactNoteDto[]>; dialogResult?: unknown } = {},
) {
  const service = {
    get: vi.fn(get),
    getNotes: vi.fn(options.notes ?? (() => of([]))),
  };
  const dialogs = { open: vi.fn(() => ({ closed: of(options.dialogResult) })) };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: CONTACTS_SERVICE, useValue: service },
      { provide: DialogService, useValue: dialogs },
      { provide: ToastService, useValue: toasts },
    ],
  });
  const fixture = TestBed.createComponent(ContactPage);
  fixture.componentRef.setInput('id', 'c1');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('button, a')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
  return { host, service, dialogs, toasts, text, button, settle };
}

describe('ContactPage', () => {
  it('shows a private contact’s details with Edit', async () => {
    const { host, text, button } = await setupContactPage(() => of(contactDto()));

    expect(host.querySelector('h1')!.textContent).toContain('Tomás Ortega');
    expect(text()).toContain('Private contact · only you can see this');
    const facts = Array.from(host.querySelectorAll('dl')).map(
      (dl) =>
        `${dl.querySelector('dt')!.textContent!.trim()}: ${dl.querySelector('dd')!.textContent!.trim()}`,
    );
    expect(facts).toEqual([
      'Email: tomas.ortega@example.org',
      'Phone: 416-555-0142',
      'Organisation: Harbour Light Shelter',
      'City: Toronto',
    ]);
    expect(button('Edit')!.getAttribute('href')).toBe('/contacts/c1/edit');
  });

  it('says when a System Admin is looking at another lead’s contact', async () => {
    const { text } = await setupContactPage(() => of(contactDto({ isOwn: false })));

    expect(text()).toContain('Another lead’s private contact · your access is recorded');
  });

  it('shows a linked contact as a member with a link to their profile', async () => {
    const { host, text } = await setupContactPage(() =>
      of(contactDto({ linkedProfileId: 'p7', photoUrl: '/photo.webp', photoAltText: 'Tomás' })),
    );

    expect(text()).toContain('Member · linked profile');
    expect(host.querySelector('a[href="/people/p7"]')!.textContent).toContain('View their profile');
  });

  it('treats a contact that is not theirs like a missing one', async () => {
    const { text } = await setupContactPage(() =>
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );

    expect(text()).toContain('We couldn’t find that contact');
  });

  it('offers a retry when the contact cannot load', async () => {
    const { text } = await setupContactPage(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    expect(text()).toContain('We couldn’t load this contact');
  });
});
