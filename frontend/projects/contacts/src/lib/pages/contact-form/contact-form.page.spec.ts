// Traces to: L2-013
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CONTACTS_SERVICE, ContactDto } from '@faithtech-community/api';
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
};

async function setup(
  options: {
    id?: string;
    create?: () => Observable<ContactDto>;
    get?: () => Observable<ContactDto>;
    update?: () => Observable<ContactDto>;
  } = {},
) {
  const service = {
    create: vi.fn(options.create ?? (() => of(saved))),
    get: vi.fn(options.get ?? (() => of(saved))),
    update: vi.fn(options.update ?? (() => of(saved))),
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
  return { host, service, router, field, type, save, text, settle };
}

describe('ContactFormPage', () => {
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
