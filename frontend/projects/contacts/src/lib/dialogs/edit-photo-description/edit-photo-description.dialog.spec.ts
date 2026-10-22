// Traces to: L2-056 AC4
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CONTACTS_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { EditPhotoDescriptionDialog, PhotoRef } from './edit-photo-description.dialog';

const data: PhotoRef = {
  contactId: 'c1',
  contactName: 'Tomás Ortega',
  photo: { id: 'p1', url: 'blob:coffee', altText: 'At the coffee morning', featured: false },
};

async function setup(describe: () => Observable<void>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { describePhoto: vi.fn(describe) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: CONTACTS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(EditPhotoDescriptionDialog);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host: HTMLElement = fixture.nativeElement;
  const input = () => host.querySelector<HTMLInputElement>('input')!;
  const type = async (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await settle();
  };
  const save = async () => {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent!.trim() === 'Save description')!
      .click();
    await settle();
  };
  return { host, ref, service, input, type, save };
}

describe('EditPhotoDescriptionDialog', () => {
  it('shows the photo and its current description', async () => {
    const { host, input } = await setup(() => of(undefined));

    expect(host.textContent).toContain('Edit photo description');
    expect(host.querySelector('img')!.getAttribute('alt')).toBe('At the coffee morning');
    expect(input().value).toBe('At the coffee morning');
  });

  it('refuses an empty description and one over 300 characters', async () => {
    const { host, service, type, save } = await setup(() => of(undefined));

    await type('  ');
    await save();
    expect(host.textContent).toContain('Describe this photo.');
    await type('a'.repeat(301));
    await save();
    expect(host.textContent).toContain('Use 300 characters or fewer to describe this photo.');
    expect(service.describePhoto).not.toHaveBeenCalled();
  });

  it('saves the trimmed description and closes with it', async () => {
    const { ref, service, type, save } = await setup(() => of(undefined));

    await type(' Pouring coffee ');
    await save();

    expect(service.describePhoto).toHaveBeenCalledWith('c1', 'p1', 'Pouring coffee');
    await vi.waitFor(() => expect(ref.close).toHaveBeenCalledWith('Pouring coffee'));
  });

  it('keeps the text and says so when saving fails', async () => {
    const { host, ref, type, save } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );

    await type('Pouring coffee');
    await save();

    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('We couldn’t save the description');
  });
});
