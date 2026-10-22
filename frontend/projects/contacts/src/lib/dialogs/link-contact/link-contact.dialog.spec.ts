// Traces to: L2-015
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE, ContactDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { LinkContactData, LinkContactDialog } from './link-contact.dialog';

const data: LinkContactData = {
  contactId: 'c1',
  email: 'tomas.ortega@example.org',
  noteCount: 2,
  member: { profileId: 'p7', name: 'Tomás Ortega' },
};
const linked = { id: 'c1', name: 'Tomás Ortega', linkedProfileId: 'p7' } as ContactDto;

function setup(link: () => Observable<ContactDto>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { link: vi.fn(link) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: CONTACTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(LinkContactDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const confirm = async () => {
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Link profile')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const choose = (label: string) => {
    const radio = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]')).find(
      (r) => r.closest('label')?.textContent?.includes(label),
    )!;
    radio.click();
    fixture.detectChanges();
  };
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  return { host, ref, service, confirm, choose, text };
}

describe('LinkContactDialog', () => {
  it('shows the member and keeps the notes private by default', () => {
    const { text, host } = setup(() => of(linked));

    expect(text()).toContain('Link to Tomás Ortega’s profile?');
    expect(text()).toContain('Member · tomas.ortega@example.org');
    expect(text()).toContain('Removes your 2 notes after linking');
    expect(host.querySelector('[cdkFocusInitial]')!.tagName.toLowerCase()).toBe('button');
    expect(host.querySelector('[cdkFocusInitial]')!.textContent!.trim()).toBe('Link profile');
    const keep = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]'))[0];
    expect(keep.checked).toBe(true);
  });

  it('links and keeps the notes', async () => {
    const { service, ref, confirm } = setup(() => of(linked));

    await confirm();

    expect(service.link).toHaveBeenCalledWith('c1', 'p7', false);
    expect(ref.close).toHaveBeenCalledWith(linked);
  });

  it('links and discards the notes when the lead chooses to', async () => {
    const { service, confirm, choose } = setup(() => of(linked));

    choose('Discard my notes');
    await confirm();

    expect(service.link).toHaveBeenCalledWith('c1', 'p7', true);
  });

  it('stays open and says so when linking fails', async () => {
    const { ref, text, confirm } = setup(() => throwError(() => new Error('offline')));

    await confirm();

    expect(ref.close).not.toHaveBeenCalled();
    expect(text()).toContain('We couldn’t link the profile. Nothing was changed — try again.');
    expect(text()).toContain('Profile not linked');
  });
});
