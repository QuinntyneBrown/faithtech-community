// Traces to: L2-017
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PARTNERS_SERVICE, PartnerDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { partnerDto } from '../../testing';
import { PartnerFormPage } from './partner-form.page';

async function setup(
  options: { get?: () => Observable<PartnerDto>; update?: () => Observable<PartnerDto> } = {},
) {
  const service = {
    get: vi.fn(options.get ?? (() => of(partnerDto()))),
    update: vi.fn(options.update ?? (() => of(partnerDto()))),
    owners: vi.fn(() => of([{ profileId: 'p1', name: 'Grace Okonkwo' }])),
  };
  const router = { navigateByUrl: vi.fn(() => Promise.resolve(true)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: PARTNERS_SERVICE, useValue: service },
      { provide: Router, useValue: router },
    ],
  });
  const fixture = TestBed.createComponent(PartnerFormPage);
  fixture.componentRef.setInput('id', 'x1');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  await settle();
  const host: HTMLElement = fixture.nativeElement;
  const field = (label: string) => {
    const labelEl = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent!.trim().startsWith(label),
    )!;
    return host.querySelector<HTMLInputElement>(`#${labelEl.getAttribute('for')}`)!;
  };
  const set = (label: string, value: string) => {
    const el = field(label);
    el.value = value;
    el.dispatchEvent(new Event('input'));
  };
  const save = async () => {
    host.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
  };
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  return { host, service, router, field, set, save, text };
}

describe('PartnerFormPage', () => {
  it('edits a partner’s details and returns to it', async () => {
    const { host, service, router, field, set, save } = await setup();

    expect(host.querySelector('h1')!.textContent).toContain('Edit partner');
    expect(field('Organisation').value).toBe('Kestrel Labs');
    set('Phone', '');
    set('Notes', 'Nadia is the studio director.');
    await save();

    expect(service.update).toHaveBeenCalledWith('x1', {
      name: 'Kestrel Labs',
      website: 'kestrel.example',
      offering: 'Venue for Builders Night',
      ownerId: 'p1',
      contactName: 'Nadia Petrov',
      email: 'nadia@kestrel.example',
      phone: null,
      notes: 'Nadia is the studio director.',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/partners/x1');
  });

  it('shows a summary and inline errors for a missing name or a bad email', async () => {
    const { service, set, save, text } = await setup();

    set('Organisation', '');
    set('Email', 'nadia@');
    await save();

    expect(service.update).not.toHaveBeenCalled();
    expect(text()).toContain('Fix 2 things to save');
    expect(text()).toContain('Enter the organisation’s name.');
  });

  it('keeps the changes when saving fails', async () => {
    const { set, save, text, field } = await setup({
      update: () => throwError(() => new HttpErrorResponse({ status: 503 })),
    });

    set('Website', 'kestrel.dev');
    await save();

    expect(text()).toContain('We couldn’t save this partner');
    expect(field('Website').value).toBe('kestrel.dev');
  });

  it('tells Staff they can’t edit partners', async () => {
    const { text, host } = await setup({ get: () => of(partnerDto({ canEdit: false })) });

    expect(text()).toContain('Staff can see partners but can’t change them');
    expect(host.querySelector('form')).toBeNull();
  });

  it('says so when the partner cannot be loaded', async () => {
    const { text } = await setup({
      get: () => throwError(() => new HttpErrorResponse({ status: 404 })),
    });

    expect(text()).toContain('We couldn’t load this partner');
  });

  it('puts Cancel before the primary Save', async () => {
    const { host } = await setup();

    const actions = Array.from(host.querySelectorAll('ft-form-actions ft-button')).map((b) =>
      b.textContent!.trim(),
    );
    expect(actions).toEqual(['Cancel', 'Save partner']);
  });
});
