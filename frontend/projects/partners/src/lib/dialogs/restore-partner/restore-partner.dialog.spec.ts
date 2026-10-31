// Traces to: L2-115
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PARTNERS_SERVICE, PartnerDto } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { partnerDto } from '../../testing';
import { RestorePartnerData, RestorePartnerDialog } from './restore-partner.dialog';

const archived = partnerDto({
  id: 'x2',
  name: 'Kestrel Labs Inc.',
  stage: 'lead',
  stageName: 'Lead',
  version: 2,
  archived: {
    mergedIntoId: 'x1',
    mergedIntoName: 'Kestrel Labs',
    mergedIntoVersion: 4,
    mergedById: 'p1',
    mergedByName: 'Grace Okonkwo',
    mergedAtUtc: '2026-10-21T12:00:00Z',
  },
});
const data: RestorePartnerData = { partner: archived };

function setup(restore: () => Observable<PartnerDto>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = {
    restore: vi.fn(restore),
    get: vi.fn(() =>
      of({ ...archived, archived: { ...archived.archived!, mergedIntoVersion: 5 } }),
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: PARTNERS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(RestorePartnerDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const text = () => host.textContent!.replace(/\s+/g, ' ');
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, service, text, button, settle };
}

describe('RestorePartnerDialog', () => {
  it('says what comes back and what stays', () => {
    const { text } = setup(() => of(archived));

    expect(text()).toContain('Restore Kestrel Labs Inc.?');
    expect(text()).toContain(
      'It comes back as its own partner at its old stage, Lead, and the timeline entries that came from it move back from Kestrel Labs.',
    );
    expect(text()).toContain('The values chosen in the merge stay on Kestrel Labs.');
  });

  it('restores with both versions and closes with the restored partner', async () => {
    const restored = partnerDto({ id: 'x2', archived: null });
    const { ref, service, button, settle } = setup(() => of(restored));

    button('Restore partner')!.click();
    await settle();

    expect(service.restore).toHaveBeenCalledWith('x2', { version: 2, mergedIntoVersion: 4 });
    expect(ref.close).toHaveBeenCalledWith(restored);
  });

  it('is busy while the restore runs', async () => {
    const pending = new Subject<PartnerDto>();
    const { service, host, button, settle } = setup(() => pending);

    button('Restore partner')!.click();
    await settle();
    button('Restore partner')!.click();

    expect(service.restore).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('shows a refusal and reloads the versions', async () => {
    const stale = new HttpErrorResponse({
      status: 409,
      error: { detail: 'Someone changed these partners since the page loaded.' },
    });
    const { service, text, button, settle } = setup(() => throwError(() => stale));

    button('Restore partner')!.click();
    await settle();

    expect(text()).toContain('Partner not restored');
    expect(text()).toContain('Someone changed these partners since the page loaded.');

    button('Reload and try again')!.click();
    await settle();
    await settle();
    expect(service.get).toHaveBeenCalledWith('x2');
    expect(text()).not.toContain('Partner not restored');
    service.restore.mockReturnValue(of(archived));
    button('Restore partner')!.click();
    await settle();
    expect(service.restore).toHaveBeenLastCalledWith('x2', { version: 2, mergedIntoVersion: 5 });
  });
});
