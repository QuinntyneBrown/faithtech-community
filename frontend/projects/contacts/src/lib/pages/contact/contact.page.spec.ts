// Traces to: L2-012, L2-013, L2-055, L2-056
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE, ContactDto, ContactNoteDto } from '@faithtech-community/api';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { AddNoteDialog, ArchiveContactDialog, LinkContactDialog } from '../../dialogs';
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
    createdAtUtc: '2026-10-02T12:00:00Z',
    photos: [],
    ...overrides,
  };
}

async function setupContactPage(
  get: () => Observable<ContactDto>,
  options: {
    notes?: () => Observable<ContactNoteDto[]>;
    dialogResult?: unknown;
    navigationState?: unknown;
  } = {},
) {
  const service = {
    get: vi.fn(get),
    getNotes: vi.fn(options.notes ?? (() => of([]))),
    photoImage: vi.fn((url: string) => of(url.startsWith('/api/') ? `blob:${url}` : url)),
  };
  const dialogs = { open: vi.fn(() => ({ closed: of(options.dialogResult) })) };
  const toasts = { show: vi.fn() };
  const router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: router },
      { provide: CONTACTS_SERVICE, useValue: service },
      { provide: DialogService, useValue: dialogs },
      { provide: ToastService, useValue: toasts },
      { provide: Location, useValue: { getState: () => options.navigationState ?? null } },
    ],
  });
  const fixture = TestBed.createComponent(ContactPage);
  fixture.componentRef.setInput('id', 'c1');
  // Loading waits on the contact and its notes together, so let both resolve.
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('button, a')).find(
      (b) => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
  return { host, service, dialogs, toasts, router, text, button, settle };
}

describe('ContactPage', () => {
  it('names the photos that did not upload when the contact was created', async () => {
    const { host, text } = await setupContactPage(() => of(contactDto()), {
      navigationState: { failedPhotos: ['Tomás demoing the dashboard'] },
    });

    expect(text()).toContain('Tomás Ortega is saved, but 1 photo wasn’t added');
    expect(text()).toContain('“Tomás demoing the dashboard”');
    expect(host.querySelector('ft-alert[status="warning"]')).not.toBeNull();
  });

  it('shows no photo alert when every photo uploaded', async () => {
    const { text } = await setupContactPage(() => of(contactDto()), {
      navigationState: { failedPhotos: [] },
    });

    expect(text()).not.toContain('wasn’t added');
  });

  it('loads the contact’s own featured photo with the lead’s credentials', async () => {
    const { host, service } = await setupContactPage(() =>
      of(
        contactDto({
          photoUrl: '/api/contacts/c1/photos/p1/image',
          photoAltText: 'Tomás smiling outside the shelter',
        }),
      ),
    );

    expect(service.photoImage).toHaveBeenCalledWith('/api/contacts/c1/photos/p1/image');
    const img = host.querySelector<HTMLImageElement>('ft-photo img')!;
    expect(img.getAttribute('src')).toBe('blob:/api/contacts/c1/photos/p1/image');
    expect(img.getAttribute('alt')).toBe('Tomás smiling outside the shelter');
  });

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
      'Added: Fri 2 Oct by you',
    ]);
    expect(host.querySelector('dd a')!.getAttribute('href')).toBe(
      'mailto:tomas.ortega@example.org',
    );
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

  it('shows the private notes newest first with their dates', async () => {
    const { host } = await setupContactPage(() => of(contactDto({ noteCount: 2 })), {
      notes: () =>
        of([
          {
            id: 'n2',
            body: 'Wants two staff at the hackathon.',
            createdAtUtc: '2026-10-16T12:00:00Z',
            photos: [],
          },
          { id: 'n1', body: 'Met at Builders Night.', createdAtUtc: '2026-10-02T12:00:00Z' },
        ]),
    });

    const notes = Array.from(host.querySelectorAll('ft-note')).map(
      (n) =>
        `${n.querySelector('.ft-note__body')!.textContent!.trim()} | ${n.querySelector('.ft-note__meta')!.textContent}`,
    );
    expect(notes).toEqual([
      'Wants two staff at the hackathon. | Fri 16 Oct',
      'Met at Builders Night. | Fri 2 Oct',
    ]);
    expect(host.querySelector('#notes-heading, h2')!.textContent).toContain('Your notes');
  });

  it('adds a note through the dialog and shows it first', async () => {
    const added = { id: 'n3', body: 'Called today.', createdAtUtc: '2026-10-21T12:00:00Z' };
    const { host, dialogs, button, settle } = await setupContactPage(() => of(contactDto()), {
      notes: () =>
        of([{ id: 'n1', body: 'Met at Builders Night.', createdAtUtc: '2026-09-18T12:00:00Z' }]),
      dialogResult: added,
    });

    button('Add note')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(AddNoteDialog, {
      data: { contactId: 'c1', contactName: 'Tomás Ortega' },
    });
    expect(host.querySelector('ft-note')!.textContent).toContain('Called today.');
  });

  it('invites the lead to add a first note', async () => {
    const { text } = await setupContactPage(() => of(contactDto()));

    expect(text()).toContain('No notes yet. Only you will see what you write here.');
  });

  it('archives the contact after the dialog confirms and returns to the list', async () => {
    const { dialogs, router, toasts, button, settle } = await setupContactPage(
      () => of(contactDto()),
      { dialogResult: true },
    );

    button('Archive')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(ArchiveContactDialog, {
      data: { contactId: 'c1', name: 'Tomás Ortega' },
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/contacts');
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ heading: 'Contact archived' }),
    );
  });

  it('offers no Archive on a contact that is already archived', async () => {
    const { button } = await setupContactPage(() =>
      of(contactDto({ archivedAtUtc: '2026-10-13T12:00:00Z' })),
    );

    expect(button('Archive')).toBeUndefined();
  });

  it('offers to link a contact whose email a new member verified', async () => {
    const match = { profileId: 'p7', name: 'Tomás Ortega' };
    const linked = contactDto({
      linkedProfileId: 'p7',
      photoUrl: '/p7.webp',
      photoAltText: 'Tomás',
    });
    const { text, button, dialogs, settle } = await setupContactPage(
      () => of(contactDto({ match, noteCount: 2 })),
      { dialogResult: linked },
    );
    expect(text()).toContain('Tomás Ortega has joined FaithTech');

    button('Link to their profile')!.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(LinkContactDialog, {
      data: { contactId: 'c1', email: 'tomas.ortega@example.org', noteCount: 2, member: match },
    });
    expect(text()).toContain('Linked to Tomás Ortega’s member profile');
    expect(text()).toContain('Member · linked profile');
  });

  it('hides the match when the lead says it is not them', async () => {
    const match = { profileId: 'p7', name: 'Tomás Ortega' };
    const { text, button, settle } = await setupContactPage(() => of(contactDto({ match })));

    button('Not them')!.click();
    await settle();

    expect(text()).not.toContain('has joined FaithTech');
  });

  it('keeps a missing fact’s row and says it was not added', async () => {
    const { host } = await setupContactPage(() => of(contactDto({ phone: null, email: null })));

    const values = Array.from(host.querySelectorAll('dd')).map((d) => d.textContent!.trim());
    expect(values.slice(0, 2)).toEqual(['Not added', 'Not added']);
  });
});
