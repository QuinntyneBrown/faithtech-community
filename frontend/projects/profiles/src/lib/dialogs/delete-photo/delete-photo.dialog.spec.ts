import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { PROFILES_SERVICE, ProfilesService } from '@faithtech-community/api';
import { of, throwError } from 'rxjs';

import { DeletePhotoData, DeletePhotoDialog } from './delete-photo.dialog';

const data: DeletePhotoData = {
  profileId: 'p1',
  photo: { id: 'ph1', url: '/team.jpg', altText: 'The team at the whiteboard' },
};

function setup(deletePhoto: ProfilesService['deletePhoto']) {
  const ref = { close: vi.fn(), disableClose: false };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: PROFILES_SERVICE, useValue: { deletePhoto: vi.fn(deletePhoto) } },
    ],
  });
  const fixture = TestBed.createComponent(DeletePhotoDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(name))!;
  return { fixture, host, ref, button };
}

describe('DeletePhotoDialog', () => {
  it('names the photo it will delete and shows it', () => {
    const { host } = setup(() => of(undefined));
    expect(host.textContent).toContain(
      '“The team at the whiteboard” will be removed from your profile.',
    );
    expect(host.querySelector('img')!.getAttribute('alt')).toBe('The team at the whiteboard');
  });

  it('closes with true once the photo is deleted', async () => {
    const { fixture, ref, button } = setup(() => of(undefined));
    button('Delete photo').click();
    await fixture.whenStable();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays open and says so when the delete fails', async () => {
    const { fixture, host, ref, button } = setup(() => throwError(() => new Error('offline')));
    button('Delete photo').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('That didn’t work');
  });
});
