// Traces to: L2-014
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE, ContactNoteDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { AddNoteData, AddNoteDialog } from './add-note.dialog';

const data: AddNoteData = { contactId: 'c1', contactName: 'Tomás Ortega' };
const note: ContactNoteDto = {
  id: 'n1',
  body: 'Called about the hackathon.',
  createdAtUtc: '2026-10-21T12:00:00Z',
};

function setup(addNote: () => Observable<ContactNoteDto>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { addNote: vi.fn(addNote) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: CONTACTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(AddNoteDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const textarea = () => host.querySelector('textarea')!;
  const write = (text: string) => {
    textarea().value = text;
    textarea().dispatchEvent(new Event('input'));
  };
  const add = async () => {
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Add note')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, service, write, add, textarea };
}

describe('AddNoteDialog', () => {
  it('names the contact and says notes stay private', () => {
    const { host } = setup(() => of(note));

    expect(host.textContent).toContain('Add a note about Tomás Ortega');
    expect(host.textContent).toContain('Only you can see your notes, even after they join.');
    expect(host.querySelector('[cdkFocusInitial]')!.tagName.toLowerCase()).toBe('textarea');
  });

  it('saves the trimmed note and closes with it', async () => {
    const { service, ref, write, add } = setup(() => of(note));

    write('  Called about the hackathon. ');
    await add();

    expect(service.addNote).toHaveBeenCalledWith('c1', 'Called about the hackathon.');
    expect(ref.close).toHaveBeenCalledWith(note);
  });

  it('asks for a note when it is empty', async () => {
    const { service, host, add, textarea } = setup(() => of(note));

    await add();

    expect(service.addNote).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Write a note to save.');
    expect(textarea().getAttribute('aria-invalid')).toBe('true');
  });

  it('rejects a note over 2,000 characters', async () => {
    const { service, host, write, add } = setup(() => of(note));

    write('a'.repeat(2001));
    await add();

    expect(service.addNote).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Use 2,000 characters or fewer for the note.');
  });

  it('keeps the note and says so when saving fails', async () => {
    const { ref, host, write, add, textarea } = setup(() =>
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );

    write('Called about the hackathon.');
    await add();

    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('We couldn’t save your note. It’s still here — try again.');
    expect(textarea().value).toBe('Called about the hackathon.');
  });
});
