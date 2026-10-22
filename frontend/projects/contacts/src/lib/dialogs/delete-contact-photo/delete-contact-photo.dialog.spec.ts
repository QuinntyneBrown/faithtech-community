// Traces to: L2-056 AC5, AC6
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { PhotoRef } from '../edit-photo-description';
import { DeleteContactPhotoDialog } from './delete-contact-photo.dialog';

const photo = { id: 'p1', url: 'blob:coffee', altText: 'At the coffee morning', featured: false };

async function setup(remove: () => Observable<void>, featured = false) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { deletePhoto: vi.fn(remove) };
  const data: PhotoRef = {
    contactId: 'c1',
    contactName: 'Tomás Ortega',
    photo: { ...photo, featured },
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: CONTACTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(DeleteContactPhotoDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const confirm = async () => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent!.trim() === 'Delete photo')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, service, confirm };
}

describe('DeleteContactPhotoDialog', () => {
  it('shows the photo, names it and starts on Cancel', async () => {
    const { host } = await setup(() => of(undefined));

    expect(host.textContent).toContain('Delete this photo?');
    expect(host.textContent).toContain(
      '“At the coffee morning” will be removed from Tomás Ortega’s photos. This can’t be undone.',
    );
    expect(host.querySelector('img')!.getAttribute('alt')).toBe('At the coffee morning');
    expect(host.querySelector('[cdkFocusInitial]')!.textContent!.trim()).toBe('Cancel');
  });

  it('says the newest remaining photo takes over when the featured one goes', async () => {
    const { host } = await setup(() => of(undefined), true);

    expect(host.textContent).toContain('Their newest remaining photo becomes featured.');
  });

  it('deletes the photo and closes with true', async () => {
    const { ref, service, confirm } = await setup(() => of(undefined));

    await confirm();

    expect(service.deletePhoto).toHaveBeenCalledWith('c1', 'p1');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays open and says so when the delete fails', async () => {
    const { host, ref, confirm } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    await confirm();

    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Photo not deleted');
  });
});
