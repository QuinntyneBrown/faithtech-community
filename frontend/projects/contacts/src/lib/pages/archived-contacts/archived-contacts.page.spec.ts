// Traces to: L2-016
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE, ContactSummary } from '@faithtech-community/api';
import { DialogService, ToastService } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { DeleteContactDialog } from '../../dialogs';
import { ArchivedContactsPage } from './archived-contacts.page';

function archived(overrides: Partial<ContactSummary>): ContactSummary {
  return {
    id: 'c1',
    name: 'Ben Carter',
    email: null,
    organization: null,
    city: 'Calgary',
    status: 'Private',
    archivedAtUtc: '2026-10-13T12:00:00Z',
    ...overrides,
  };
}

const ben = archived({});
const lydia = archived({
  id: 'c2',
  name: 'Lydia Grant',
  city: null,
  archivedAtUtc: '2026-10-02T12:00:00Z',
});

async function setup(
  list: () => Observable<ContactSummary[]>,
  options: { restore?: () => Observable<void>; dialogResult?: boolean } = {},
) {
  const service = {
    listArchived: vi.fn(list),
    restore: vi.fn(options.restore ?? (() => of(undefined))),
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
  const fixture = TestBed.createComponent(ArchivedContactsPage);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const rows = () =>
    Array.from(host.querySelectorAll('ft-list-item')).map(
      (i) =>
        `${i.querySelector('.ft-list-item__title')!.textContent!.trim()} | ${i.querySelector('.ft-list-item__meta')?.textContent?.trim()}`,
    );
  const button = (label: string) =>
    Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.getAttribute('aria-label') === label,
    )!;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  return { host, service, dialogs, toasts, rows, button, text, settle };
}

describe('ArchivedContactsPage', () => {
  it('lists archived contacts with when they were archived', async () => {
    const { host, rows } = await setup(() => of([ben, lydia]));

    expect(host.querySelector('h1')!.textContent).toContain('Archived contacts');
    expect(rows()).toEqual([
      'Ben Carter | Archived Tue 13 Oct · Calgary',
      'Lydia Grant | Archived Fri 2 Oct',
    ]);
  });

  it('restores a contact to the main list', async () => {
    const { service, toasts, button, rows, settle } = await setup(() => of([ben, lydia]));

    button('Restore Ben Carter').click();
    await settle();

    expect(service.restore).toHaveBeenCalledWith('c1');
    expect(rows()).toEqual(['Lydia Grant | Archived Fri 2 Oct']);
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({
        heading: 'Contact restored',
        text: 'Ben Carter is back in your contacts.',
      }),
    );
  });

  it('deletes a contact permanently after the dialog confirms', async () => {
    const { dialogs, button, rows, settle, toasts } = await setup(() => of([ben, lydia]), {
      dialogResult: true,
    });

    button('Delete Ben Carter permanently').click();
    await settle();

    expect(dialogs.open).toHaveBeenCalledWith(DeleteContactDialog, {
      data: { contactId: 'c1', name: 'Ben Carter' },
    });
    expect(rows()).toEqual(['Lydia Grant | Archived Fri 2 Oct']);
    expect(toasts.show).toHaveBeenCalledWith(
      expect.objectContaining({ heading: 'Contact deleted' }),
    );
  });

  it('keeps the contact when the delete dialog is cancelled', async () => {
    const { button, rows, settle } = await setup(() => of([ben]), { dialogResult: false });

    button('Delete Ben Carter permanently').click();
    await settle();

    expect(rows()).toHaveLength(1);
  });

  it('says when nothing is archived', async () => {
    const { text, host } = await setup(() => of([]));

    expect(text()).toContain('Nothing archived');
    expect(host.querySelector('a[href="/contacts"]')).not.toBeNull();
  });

  it('offers a retry when the list cannot load', async () => {
    const { text } = await setup(() => throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(text()).toContain('We couldn’t load archived contacts');
  });
});
