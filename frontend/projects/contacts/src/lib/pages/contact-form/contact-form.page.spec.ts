// Traces to: L2-013, L2-055
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { CONTACTS_SERVICE, ContactDto, ContactPhoto } from '@faithtech-community/api';
import { PictureListComponent } from '@faithtech-community/components';
import { Observable, of, throwError } from 'rxjs';

import { ContactFormPage } from './contact-form.page';

const saved: ContactDto = {
  id: 'c9',
  name: 'Kwame Asante',
  email: 'kwame.asante@example.org',
  phone: null,
  organization: 'Maple Street Church',
  city: 'Toronto',
  linkedProfileId: null,
  photoUrl: null,
  photoAltText: null,
  match: null,
  archivedAtUtc: null,
  noteCount: 1,
  isOwn: true,
  createdAtUtc: '2026-10-21T12:00:00Z',
  photos: [],
};

async function setup(
  options: {
    id?: string;
    create?: () => Observable<ContactDto>;
    get?: () => Observable<ContactDto>;
    update?: () => Observable<ContactDto>;
    uploadPhoto?: (id: string, file: File, alt: string) => Observable<ContactPhoto>;
  } = {},
) {
  const service = {
    create: vi.fn(options.create ?? (() => of(saved))),
    get: vi.fn(options.get ?? (() => of(saved))),
    update: vi.fn(options.update ?? (() => of(saved))),
    uploadPhoto: vi.fn(
      options.uploadPhoto ??
        ((_id: string, _file: File, altText: string) =>
          of({ id: 'p1', url: null, altText, isFeatured: false, uploadedAt: '', isStored: true })),
    ),
  };
  const router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: CONTACTS_SERVICE, useValue: service },
      { provide: Router, useValue: router },
    ],
  });
  const fixture = TestBed.createComponent(ContactFormPage);
  if (options.id) fixture.componentRef.setInput('id', options.id);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const field = (label: string) => {
    const labelEl = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent!.trim().startsWith(label),
    )!;
    return host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `#${labelEl.getAttribute('for')}`,
    )!;
  };
  const type = (label: string, value: string) => {
    const input = field(label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const save = async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const pictures = () =>
    fixture.debugElement.query(By.directive(PictureListComponent))?.componentInstance as
      PictureListComponent | undefined;
  const choose = async (...files: File[]) => {
    pictures()!.picked.emit(files);
    await settle();
  };
  return { host, service, router, field, type, save, text, settle, pictures, choose };
}

const photo = (name: string) => new File(['x'], name, { type: 'image/png' });

describe('ContactFormPage', () => {
  describe('photos', () => {
    it('saves the contact, then uploads its chosen photos featured first, and opens it', async () => {
      const { service, router, type, save, choose, pictures } = await setup();
      type('Name', 'Kwame Asante');
      const doors = photo('doors.png');
      const coffee = photo('coffee.png');
      await choose(doors, coffee);
      expect(
        pictures()!
          .photos()
          .map((p) => [p.featured, p.pending]),
      ).toEqual([
        [true, true],
        [false, true],
      ]);
      pictures()!.altChange.emit({ index: 0, alt: ' At the church doors ' });
      pictures()!.altChange.emit({ index: 1, alt: 'Pouring coffee' });
      pictures()!.featured.emit(1);

      await save();

      expect(service.create).toHaveBeenCalled();
      expect(service.uploadPhoto.mock.calls).toEqual([
        ['c9', coffee, 'Pouring coffee'],
        ['c9', doors, 'At the church doors'],
      ]);
      await vi.waitFor(() =>
        expect(router.navigateByUrl).toHaveBeenCalledWith('/contacts/c9', {
          state: { failedPhotos: [] },
        }),
      );
    });

    it('blocks the save while a chosen photo has no description', async () => {
      const { service, type, save, choose, text } = await setup();
      type('Name', 'Kwame Asante');
      await choose(photo('doors.png'));

      await save();

      expect(service.create).not.toHaveBeenCalled();
      expect(text()).toContain('Describe this photo.');
      expect(text()).toContain('Fix 1 thing to save');
    });

    it('opens the contact naming the photos that failed to upload', async () => {
      const { router, type, save, choose, pictures } = await setup({
        uploadPhoto: (_id, _file, alt) =>
          alt === 'Demo'
            ? throwError(() => new HttpErrorResponse({ status: 500 }))
            : of({
                id: 'p1',
                url: null,
                altText: alt,
                isFeatured: true,
                uploadedAt: '',
                isStored: true,
              }),
      });
      type('Name', 'Tomás Ortega');
      await choose(photo('outside.png'), photo('demo.png'));
      pictures()!.altChange.emit({ index: 0, alt: 'Outside' });
      pictures()!.altChange.emit({ index: 1, alt: 'Demo' });

      await save();

      await vi.waitFor(() =>
        expect(router.navigateByUrl).toHaveBeenCalledWith('/contacts/c9', {
          state: { failedPhotos: ['Demo'] },
        }),
      );
    });

    it('removes a chosen photo, featuring the next one', async () => {
      const { choose, pictures, settle } = await setup();
      await choose(photo('a.png'), photo('b.png'));

      pictures()!.removed.emit(0);
      await settle();

      expect(
        pictures()!
          .photos()
          .map((p) => p.featured),
      ).toEqual([true]);
    });

    it('has no photo picker when editing', async () => {
      const { pictures } = await setup({ id: 'c9' });
      expect(pictures()).toBeUndefined();
    });
  });

  it('creates a contact with a first note and opens it', async () => {
    const { host, service, router, type, save } = await setup();
    expect(host.querySelector('h1')!.textContent).toContain('New contact');

    type('Name', ' Kwame Asante ');
    type('Email', 'kwame.asante@example.org');
    type('Organisation', 'Maple Street Church');
    type('City', 'Toronto');
    type('First note', 'Pastor. Interested in hosting a builders night.');
    await save();

    expect(service.create).toHaveBeenCalledWith({
      name: 'Kwame Asante',
      email: 'kwame.asante@example.org',
      phone: null,
      organization: 'Maple Street Church',
      city: 'Toronto',
      notes: 'Pastor. Interested in hosting a builders night.',
      linkToMember: false,
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/contacts/c9');
  });

  it('shows inline errors and a summary for a missing name or an invalid email', async () => {
    const { host, service, type, save, text } = await setup();

    type('Email', 'kwame@');
    await save();

    expect(service.create).not.toHaveBeenCalled();
    expect(text()).toContain('Fix 2 things to save');
    expect(text()).toContain('Enter at least a first name.');
    expect(text()).toContain('Enter an email like name@example.org, or leave it empty.');
    expect(host.querySelectorAll('[aria-invalid="true"]')).toHaveLength(2);
  });

  it('shows the server’s field errors', async () => {
    const { type, save, text } = await setup({
      create: () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { errors: { Name: ['Use 200 characters or fewer for the name.'] } },
            }),
        ),
    });

    type('Name', 'Kwame');
    await save();

    expect(text()).toContain('Use 200 characters or fewer for the name.');
  });

  it('keeps the details when saving fails', async () => {
    const { field, type, save, text } = await setup({
      create: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });

    type('Name', 'Kwame Asante');
    await save();

    expect(text()).toContain('We couldn’t save this contact');
    expect(field('Name').value).toBe('Kwame Asante');
  });

  it('edits an existing contact without a first note', async () => {
    const { host, service, router, field, type, save } = await setup({ id: 'c9' });

    expect(host.querySelector('h1')!.textContent).toContain('Edit contact');
    expect(field('Name').value).toBe('Kwame Asante');
    expect(host.textContent).not.toContain('First note');
    type('City', 'Hamilton');
    await save();

    expect(service.update).toHaveBeenCalledWith('c9', {
      name: 'Kwame Asante',
      email: 'kwame.asante@example.org',
      phone: null,
      organization: 'Maple Street Church',
      city: 'Hamilton',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/contacts/c9');
  });

  it('says so when the contact to edit cannot be loaded', async () => {
    const { text } = await setup({
      id: 'c9',
      get: () => throwError(() => new HttpErrorResponse({ status: 404 })),
    });

    expect(text()).toContain('We couldn’t load this contact');
  });

  it('offers Save and link when the email belongs to a member', async () => {
    let calls = 0;
    const { service, router, type, save, text, host } = await setup({
      create: () =>
        ++calls === 1
          ? throwError(
              () =>
                new HttpErrorResponse({
                  status: 409,
                  error: {
                    detail: 'Kwame Asante is already a member.',
                    memberName: 'Kwame Asante',
                  },
                }),
            )
          : of(saved),
    });

    type('Name', 'Kwame');
    type('Email', 'kwame.asante@example.org');
    await save();

    expect(text()).toContain('Kwame Asante is already a member');
    expect(host.querySelector('button[type="submit"]')!.textContent).toContain('Save and link');
    expect(router.navigateByUrl).not.toHaveBeenCalled();

    await save();

    expect(service.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ linkToMember: true }),
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/contacts/c9');
  });

  it('puts Cancel before the primary Save', async () => {
    const { host } = await setup();

    const actions = Array.from(host.querySelectorAll('ft-form-actions ft-button')).map((b) =>
      b.textContent!.trim(),
    );
    expect(actions).toEqual(['Cancel', 'Save contact']);
  });
});
