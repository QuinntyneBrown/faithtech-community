// Traces to: L2-012, L2-013
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE, ContactSummary } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { ContactsPage } from './contacts.page';

function contact(overrides: Partial<ContactSummary>): ContactSummary {
  return {
    id: 'c1',
    name: 'Abby Brooks',
    email: 'abby@example.org',
    organization: 'Ellis Design Studio',
    city: 'Toronto',
    status: 'Private',
    archivedAtUtc: null,
    ...overrides,
  };
}

const abby = contact({});
const tomas = contact({
  id: 'c2',
  name: 'Tomás Ortega',
  organization: 'Harbour Light Shelter',
  status: 'SignedUp',
});
const jonah = contact({
  id: 'c3',
  name: 'Jonah Bell',
  organization: null,
  city: 'Hamilton',
  status: 'Member',
});

async function setup(list: (term?: string) => Observable<ContactSummary[]>) {
  const service = { list: vi.fn(list) };
  TestBed.configureTestingModule({ providers: [{ provide: CONTACTS_SERVICE, useValue: service }] });
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
    Array.from(host.querySelectorAll('ft-list-item')).map((i) =>
      ['.ft-list-item__title', '.ft-list-item__meta', 'ft-badge']
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
  return { host, service, text, rows, search, settle };
}

describe('ContactsPage', () => {
  it('lists the lead’s contacts with organisation, city and whether they joined', async () => {
    const { host, rows, text } = await setup(() => of([abby, jonah, tomas]));

    expect(host.querySelector('h1')!.textContent).toContain('Contacts');
    expect(text()).toContain('Private to you · 3 contacts');
    expect(rows()).toEqual([
      'Abby Brooks | Ellis Design Studio · Toronto | Private',
      'Jonah Bell | Hamilton | Member',
      'Tomás Ortega | Harbour Light Shelter · Toronto | Signed up',
    ]);
    const link = host.querySelector<HTMLAnchorElement>('ft-list-item a')!;
    expect(link.getAttribute('href')).toBe('/contacts/c1');
    expect(host.querySelector('a[href="/contacts/new"]')!.textContent).toContain('Add contact');
    expect(host.querySelector('a[href="/contacts/archived"]')!.textContent).toContain('Archived');
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
