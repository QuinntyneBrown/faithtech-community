// Traces to: L2-016
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { ArchiveContactDialog, ContactRef } from './archive-contact.dialog';

const data: ContactRef = { contactId: 'c1', name: 'Tomás Ortega' };

function setup(archive: () => Observable<void>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { archive: vi.fn(archive) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: CONTACTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(ArchiveContactDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const confirm = async () => {
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Archive')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, service, confirm };
}

describe('ArchiveContactDialog', () => {
  it('asks to archive the contact and says it can be restored', () => {
    const { host } = setup(() => of(undefined));

    expect(host.textContent).toContain('Archive Tomás Ortega?');
    expect(host.textContent).toContain('You can restore them whenever you like.');
  });

  it('archives the contact and closes with true', async () => {
    const { service, ref, confirm } = setup(() => of(undefined));

    await confirm();

    expect(service.archive).toHaveBeenCalledWith('c1');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays open and says so when archiving fails', async () => {
    const { ref, host, confirm } = setup(() => throwError(() => new Error('offline')));

    await confirm();

    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('That didn’t work');
  });
});
