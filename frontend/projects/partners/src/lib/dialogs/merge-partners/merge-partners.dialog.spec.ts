// Traces to: L2-089
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PARTNERS_SERVICE, PartnerDto } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { partnerDto } from '../../testing';
import { MergePartnersData, MergePartnersDialog } from './merge-partners.dialog';

const kept = partnerDto({ id: 'x1', phone: null, version: 3 });
const other = partnerDto({
  id: 'x2',
  name: 'Kestrel Labs Inc.',
  stage: 'Lead',
  contactName: 'N. Petrov',
  ownerId: 'p2',
  ownerName: 'Esther Nakamura',
  version: 1,
});
const data: MergePartnersData = {
  kept,
  other,
  match: {
    id: 'x2',
    name: 'Kestrel Labs Inc.',
    reason: 'Website',
    matchedOn: 'kestrel.example',
    addedByName: 'Esther Nakamura',
    addedOn: '2026-10-13',
  },
};

function setup(merge: () => Observable<PartnerDto>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = {
    merge: vi.fn(merge),
    get: vi.fn((id: string) => of(id === 'x1' ? kept : { ...other, version: 2 })),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: PARTNERS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(MergePartnersDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const groups = () => Array.from(host.querySelectorAll('ft-radio-group'));
  const legends = () => groups().map((g) => g.querySelector('legend')!.textContent!.trim());
  const radios = (legend: string) =>
    Array.from(
      groups()
        .find((g) => g.querySelector('legend')!.textContent!.trim() === legend)!
        .querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    );
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, service, text, legends, radios, button, settle };
}

describe('MergePartnersDialog', () => {
  it('offers only the differing fields, with the kept record’s values selected', () => {
    const { text, legends, radios } = setup(() => of(kept));

    expect(text()).toContain('Merge Kestrel Labs Inc. into Kestrel Labs');
    expect(text()).toContain('Nothing is lost');
    expect(text()).toContain('Esther Nakamura added Kestrel Labs Inc. on Tue 13 Oct.');
    expect(legends()).toEqual(['Name', 'Stage', 'Main contact', 'Phone', 'Owner']);
    for (const legend of legends()) {
      expect(radios(legend).map((r) => r.checked)).toEqual([true, false]);
    }
    expect(text()).toContain('Not set');
    expect(text()).toContain(
      'Email, website and offering are the same on both and are kept as they are. Notes from both records are joined, Kestrel Labs’s first.',
    );
  });

  it('sends the versions and a choice per differing field, then closes with the kept partner', async () => {
    const merged = partnerDto({ version: 4 });
    const { ref, service, radios, button, settle } = setup(() => of(merged));

    radios('Phone')[1].click();
    button('Merge partners')!.click();
    await settle();

    expect(service.merge).toHaveBeenCalledWith('x1', {
      otherId: 'x2',
      keepVersion: 3,
      otherVersion: 1,
      choices: { name: 'keep', stage: 'keep', contactName: 'keep', phone: 'other', owner: 'keep' },
    });
    expect(ref.close).toHaveBeenCalledWith(merged);
  });

  it('is busy while the merge runs and cannot be confirmed twice', async () => {
    const pending = new Subject<PartnerDto>();
    const { service, host, button, settle } = setup(() => pending);

    button('Merge partners')!.click();
    await settle();
    button('Merge partners')!.click();

    expect(service.merge).toHaveBeenCalledTimes(1);
    expect(
      host.querySelector('ft-button[variant="primary"] button')!.getAttribute('aria-busy'),
    ).toBe('true');
  });

  it('shows the conflict and reloads both partners, resetting the choices', async () => {
    const conflict = new HttpErrorResponse({
      status: 409,
      error: { detail: 'Someone changed Kestrel Labs Inc. while you were comparing.' },
    });
    const { service, text, radios, button, settle } = setup(() => throwError(() => conflict));
    radios('Phone')[1].click();

    button('Merge partners')!.click();
    await settle();

    expect(text()).toContain('Partners not merged');
    expect(text()).toContain('Someone changed Kestrel Labs Inc. while you were comparing.');
    expect(button('Merge partners')).toBeUndefined();

    button('Reload and try again')!.click();
    await settle();
    await settle();

    expect(service.get).toHaveBeenCalledWith('x1');
    expect(service.get).toHaveBeenCalledWith('x2');
    expect(text()).not.toContain('Partners not merged');
    expect(radios('Phone').map((r) => r.checked)).toEqual([true, false]);
    service.merge.mockReturnValue(of(kept));
    button('Merge partners')!.click();
    await settle();
    expect(service.merge).toHaveBeenLastCalledWith(
      'x1',
      expect.objectContaining({ otherVersion: 2 }),
    );
  });

  it('says a joined-notes refusal in the failed alert', async () => {
    const tooLong = new HttpErrorResponse({
      status: 400,
      error: { errors: { Notes: ['The joined notes are longer than 2,000 characters.'] } },
    });
    const { text, button, settle } = setup(() => throwError(() => tooLong));

    button('Merge partners')!.click();
    await settle();

    expect(text()).toContain('The joined notes are longer than 2,000 characters.');
  });
});
