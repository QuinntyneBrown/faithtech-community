// Traces to: L2-012, L2-013, L2-072, L2-073
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE, ContactSummary, SITE_SERVICE } from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { ArchiveContactDialog } from '../../dialogs';

import { ContactsPage } from './contacts.page';

/** The host's organisation the copy names, as GET /api/site answers it on FaithTech's host. */
const FAITHTECH_SITE = {
  site: () => ({
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    chapterLabel: { singular: 'City', plural: 'Cities' },
    communityOrigin: 'http://localhost:4200',
  }),
  load: async () => undefined,
};

function contact(overrides: Partial<ContactSummary>): ContactSummary {
  return {
    id: 'c1',
    name: 'Abby Brooks',
    email: 'abby@example.org',
    organization: 'Ellis Design Studio',
    city: 'Toronto',
    status: 'Private',
    archivedAtUtc: null,
    photoUrl: null,
    photoAltText: null,
    noteCount: 0,
    createdAtUtc: '2026-10-09T12:00:00Z',
    ...overrides,
  };
}

const abby = contact({});
const tomas = contact({
  id: 'c2',
  name: 'Tomás Ortega',
  organization: 'Harbour Light Shelter',
  status: 'SignedUp',
  photoUrl: '/api/contacts/c2/photos/p1/image',
  photoAltText: 'Tomás smiling outside Harbour Light Shelter',
  noteCount: 2,
});
const jonah = contact({
  id: 'c3',
  name: 'Jonah Bell',
  organization: null,
  city: 'Hamilton',
  status: 'Member',
});

async function setup(
  list: (term?: string) => Observable<ContactSummary[]>,
  options: { archived?: boolean } = {},
) {
  const service = {
    list: vi.fn(list),
    photoImage: vi.fn((url: string) => of(url.startsWith('/api/') ? 'blob:tomas' : url)),
  };
  const dialogs = { open: vi.fn(() => ({ closed: of(options.archived) })) };
  const toasts = { show: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: SITE_SERVICE, useValue: FAITHTECH_SITE },
      { provide: CONTACTS_SERVICE, useValue: service },
      { provide: DialogService, useValue: dialogs },
      { provide: ToastService, useValue: toasts },
    ],
  });
  const fixture = TestBed.createComponent(ContactsPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const rows = () =>
    Array.from(host.querySelectorAll('ft-person-card')).map((i) =>
      [
        '.ft-person-card__name > span',
        '.ft-person-card__subtitle',
        'ft-badge',
        '.ft-person-card__secondary',
      ]
        .map((part) => i.querySelector(part)?.textContent?.trim() ?? '')
        .join(' | '),
    );
  const search = async (term: string) => {
    const input = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    host.querySelector('form[role="search"]')!.dispatchEvent(new Event('submit'));
    await settle();
  };
  return { host, service, dialogs, toasts, text, rows, search, settle };
}

describe('ContactsPage', () => {
  it('shows the lead’s contacts as person cards with organisation, city, status and a secondary line', async () => {
    const { host, rows, text } = await setup(() => of([abby, jonah, tomas]));

    expect(host.querySelector('h1')!.textContent).toContain('Contacts');
    expect(text()).toContain('Private to you · 3 contacts');
    expect(host.querySelector('ft-person-grid ul')!.getAttribute('aria-label')).toBe('Contacts');
    expect(rows()).toEqual([
      'Abby Brooks | Ellis Design Studio · Toronto | Private | Added Fri 9 Oct',
      'Jonah Bell | Hamilton | Member | Added Fri 9 Oct',
      'Tomás Ortega | Harbour Light Shelter · Toronto | Signed up | 2 notes',
    ]);
    const link = host.querySelector<HTMLAnchorElement>('ft-person-card a')!;
    expect(link.getAttribute('href')).toBe('/contacts/c1');
    expect(link.textContent).toContain('View profile');
    expect(host.querySelector('a[href="/contacts/new"]')!.textContent).toContain('Add contact');
    expect(host.querySelector('a[href="/contacts/archived"]')!.textContent).toContain('Archived');
  });

  it('loads a private contact photo through the contacts service and shows it with its description', async () => {
    const { host, service } = await setup(() => of([abby, tomas]));

    expect(service.photoImage).toHaveBeenCalledWith('/api/contacts/c2/photos/p1/image');
    const img = host.querySelector<HTMLImageElement>('ft-person-card img')!;
    expect(img.getAttribute('src')).toBe('blob:tomas');
    expect(img.getAttribute('alt')).toBe('Tomás smiling outside Harbour Light Shelter');
    expect(host.querySelectorAll('ft-person-card img')).toHaveLength(1);
  });

  it('asks before archiving from a card’s × and removes the card once archived', async () => {
    const { host, dialogs, toasts, rows, settle } = await setup(() => of([abby, tomas]), {
      archived: true,
    });
    const dismiss = host.querySelector<HTMLButtonElement>(
      'ft-person-card button[aria-label="Archive Abby Brooks"]',
    )!;

    dismiss.click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(ArchiveContactDialog, {
      data: { contactId: 'c1', name: 'Abby Brooks' },
    });
    expect(rows().map((r) => r.split(' | ')[0])).toEqual(['Tomás Ortega']);
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', heading: 'Contact archived' }),
    );
  });

  it('keeps the card when the archive confirmation is cancelled', async () => {
    const { host, rows, toasts, settle } = await setup(() => of([abby]), { archived: false });

    host.querySelector<HTMLButtonElement>('ft-person-card button')!.click();
    await settle();

    expect(rows()).toHaveLength(1);
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('says “1 note” for a single note', async () => {
    const { rows } = await setup(() => of([contact({ noteCount: 1 })]));

    expect(rows()).toEqual(['Abby Brooks | Ellis Design Studio · Toronto | Private | 1 note']);
  });

  it('points the lead to a contact who just joined', async () => {
    const { host, text } = await setup(() => of([abby, tomas]));

    expect(text()).toContain('Tomás Ortega just joined FaithTech');
    expect(host.querySelector('ft-alert a[href="/contacts/c2"]')!.textContent).toContain('Review');
  });

  it('invites a lead with no contacts to add one', async () => {
    const { host, text } = await setup(() => of([]));

    expect(text()).toContain('No contacts yet');
    expect(host.querySelector('ft-empty-state a[href="/contacts/new"]')!.textContent).toContain(
      'Add your first contact',
    );
  });

  it('searches on submit and says when nothing matches', async () => {
    const { service, search, text, host } = await setup((term) => of(term ? [] : [abby]));

    await search(' harbour ');

    expect(service.list).toHaveBeenLastCalledWith('harbour');
    expect(text()).toContain('No contacts match “harbour”');
    expect(host.querySelector('ft-empty-state a[href="/contacts/archived"]')).not.toBeNull();
  });

  it('explains that contacts are private to each lead when the caller has no lead role', async () => {
    const { text, host } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );

    expect(text()).toContain('Contacts are private to each lead');
    expect(host.querySelector('h1.visually-hidden')!.textContent).toContain('Contacts');
    expect(host.querySelector('form[role="search"]')).toBeNull();
  });

  it('offers a retry when the list cannot load', async () => {
    let fail = true;
    const { host, text, settle } = await setup(() =>
      fail ? throwError(() => new HttpErrorResponse({ status: 500 })) : of([abby]),
    );
    expect(text()).toContain('We couldn’t load your contacts');

    fail = false;
    host.querySelector<HTMLButtonElement>('ft-empty-state button')!.click();
    await settle();

    expect(text()).toContain('Abby Brooks');
  });
});
