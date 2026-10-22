// Traces to: L2-056 AC2, L2-057
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CONTACTS_SERVICE, ContactPhoto } from '@faithtech-community/api';
import { PictureListComponent } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { AddContactPhotoData, AddContactPhotoDialog } from './add-contact-photo.dialog';

const data: AddContactPhotoData = { contactId: 'c1', contactName: 'Tomás Ortega', room: 7 };
const uploaded = (altText: string): ContactPhoto => ({
  id: `p-${altText}`,
  url: '/api/contacts/c1/photos/p/image',
  altText,
  isFeatured: false,
  uploadedAt: '2026-10-22T12:00:00Z',
  isStored: true,
});

async function setup(upload: (id: string, file: File, alt: string) => Observable<ContactPhoto>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { uploadPhoto: vi.fn(upload) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: CONTACTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(AddContactPhotoDialog);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host: HTMLElement = fixture.nativeElement;
  const pictures = () =>
    fixture.debugElement.query(By.directive(PictureListComponent))
      .componentInstance as PictureListComponent;
  const add = async () => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('ft-dialog button'))
      .filter((b) => b.textContent!.trim() === 'Add photos')
      .at(-1)!
      .click();
    await settle();
  };
  return { host, ref, service, pictures, add, settle };
}

const file = (name: string) => new File(['x'], name, { type: 'image/png' });

describe('AddContactPhotoDialog', () => {
  it('offers the photos left to add, without Feature, private to the lead', async () => {
    const { host, pictures } = await setup(() => of(uploaded('x')));

    expect(host.textContent).toContain('Add photos of Tomás Ortega');
    expect(host.textContent).toContain('Only you can see these photos.');
    expect(pictures().max()).toBe(7);
    expect(pictures().featurable()).toBe(false);
  });

  it('asks for a description before uploading anything', async () => {
    const { host, service, pictures, add, settle } = await setup(() => of(uploaded('x')));
    pictures().picked.emit([file('coffee.png')]);
    await settle();

    await add();

    expect(service.uploadPhoto).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Describe this photo.');
  });

  it('uploads each chosen photo with its description and closes with them', async () => {
    const { ref, service, pictures, add, settle } = await setup((_id, _f, alt) =>
      of(uploaded(alt)),
    );
    const coffee = file('coffee.png');
    pictures().picked.emit([coffee]);
    await settle();
    pictures().altChange.emit({ index: 0, alt: ' At the coffee morning ' });
    await settle();

    await add();

    expect(service.uploadPhoto).toHaveBeenCalledWith('c1', coffee, 'At the coffee morning');
    await vi.waitFor(() =>
      expect(ref.close).toHaveBeenCalledWith([uploaded('At the coffee morning')]),
    );
  });

  it('keeps the choice and says so when the upload fails', async () => {
    const { host, ref, pictures, add, settle } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    pictures().picked.emit([file('coffee.png')]);
    await settle();
    pictures().altChange.emit({ index: 0, alt: 'At the coffee morning' });
    await settle();

    await add();
    await settle();

    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('We couldn’t add this photo');
    expect(pictures().photos()).toHaveLength(1);
  });
});
