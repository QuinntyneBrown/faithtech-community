// Traces to: L2-016
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { ContactRef } from '../archive-contact';
import { DeleteContactDialog } from './delete-contact.dialog';

const data: ContactRef = { contactId: 'c1', name: 'Ben Carter' };

function setup(remove: () => Observable<void>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { delete: vi.fn(remove) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: CONTACTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(DeleteContactDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const input = () => host.querySelector<HTMLInputElement>('input')!;
  const deleteButton = () =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete permanently'),
    )!;
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    input().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    fixture.detectChanges();
  };
  const confirm = async () => {
    deleteButton().click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, service, type, confirm, deleteButton, input };
}

describe('DeleteContactDialog', () => {
  it('warns that the contact and its notes go for good', () => {
    const { host } = setup(() => of(undefined));

    expect(host.textContent).toContain('Delete Ben Carter for good?');
    expect(host.textContent).toContain('This removes the contact and all your notes.');
    expect(host.querySelector('[cdkFocusInitial]')!.tagName.toLowerCase()).toBe('input');
  });

  it.each(['', 'delete', 'DELETE ', 'DELET'])(
    'keeps Delete permanently disabled for "%s"',
    (value) => {
      const { type, deleteButton } = setup(() => of(undefined));

      type(value);

      expect(deleteButton().disabled).toBe(true);
    },
  );

  it('explains the rule when the text is not DELETE', () => {
    const { type, host, input } = setup(() => of(undefined));

    type('delet');

    expect(host.textContent).toContain('Type DELETE in capitals to confirm.');
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('deletes once DELETE is typed and closes with true', async () => {
    const { type, confirm, service, ref, deleteButton } = setup(() => of(undefined));

    type('DELETE');
    expect(deleteButton().disabled).toBe(false);
    await confirm();

    expect(service.delete).toHaveBeenCalledWith('c1');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays open and says so when the delete fails', async () => {
    const { type, confirm, ref, host } = setup(() => throwError(() => new Error('offline')));

    type('DELETE');
    await confirm();

    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('That didn’t work');
  });
});
