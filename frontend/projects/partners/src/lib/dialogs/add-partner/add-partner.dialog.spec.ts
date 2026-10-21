// Traces to: L2-017
import { DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PARTNERS_SERVICE, PartnerDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { partnerDto } from '../../testing';
import { AddPartnerDialog } from './add-partner.dialog';

async function setup(create: () => Observable<PartnerDto>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = {
    create: vi.fn(create),
    owners: vi.fn(() => of([{ profileId: 'p1', name: 'Grace Okonkwo' }])),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: PARTNERS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(AddPartnerDialog);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host: HTMLElement = fixture.nativeElement;
  const field = (label: string) => {
    const labelEl = Array.from(host.querySelectorAll('label')).find((l) =>
      l.textContent!.trim().startsWith(label),
    )!;
    return host.querySelector<HTMLInputElement | HTMLSelectElement>(
      `#${labelEl.getAttribute('for')}`,
    )!;
  };
  const set = (label: string, value: string) => {
    const el = field(label);
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
  };
  const add = async () => {
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Add partner')!
      .click();
    await settle();
  };
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  return { host, ref, service, set, add, text, field };
}

describe('AddPartnerDialog', () => {
  it('starts at the Lead stage and offers the leads as owners', async () => {
    const { field, text } = await setup(() => of(partnerDto()));

    expect(text()).toContain('Partners are shared with every lead.');
    expect((field('Stage') as HTMLSelectElement).value).toBe('Lead');
    expect(Array.from((field('Owner') as HTMLSelectElement).options).map((o) => o.text)).toEqual([
      'No owner',
      'Grace Okonkwo',
    ]);
  });

  it('adds a partner with every field and closes with it', async () => {
    const created = partnerDto();
    const { service, ref, set, add } = await setup(() => of(created));

    set('Organisation', ' Lantern Foundation ');
    set('Website', 'lantern.example');
    set('Stage', 'InFunnel');
    set('Main contact', 'Ada Mwangi');
    set('Email', 'ada@lantern.example');
    set('What they could offer', 'Grant funding for shelter technology.');
    set('Owner', 'p1');
    await add();

    expect(service.create).toHaveBeenCalledWith({
      name: 'Lantern Foundation',
      website: 'lantern.example',
      offering: 'Grant funding for shelter technology.',
      ownerId: 'p1',
      contactName: 'Ada Mwangi',
      email: 'ada@lantern.example',
      phone: null,
      notes: null,
      stage: 'InFunnel',
    });
    expect(ref.close).toHaveBeenCalledWith(created);
  });

  it('asks for the organisation’s name', async () => {
    const { service, add, text, field } = await setup(() => of(partnerDto()));

    await add();

    expect(service.create).not.toHaveBeenCalled();
    expect(text()).toContain('Enter the organisation’s name.');
    expect(field('Organisation').getAttribute('aria-invalid')).toBe('true');
  });

  it('stays open and says so when saving fails', async () => {
    const { ref, set, add, text } = await setup(() =>
      throwError(() => new HttpErrorResponse({ status: 503 })),
    );

    set('Organisation', 'Lantern Foundation');
    await add();

    expect(ref.close).not.toHaveBeenCalled();
    expect(text()).toContain('Partner not added');
  });
});
