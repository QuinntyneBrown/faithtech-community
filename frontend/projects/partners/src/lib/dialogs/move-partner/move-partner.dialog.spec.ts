// Traces to: L2-018
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { PARTNERS_SERVICE, PartnerDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { partnerDto } from '../../testing';
import { MovePartnerData, MovePartnerDialog } from './move-partner.dialog';

const data: MovePartnerData = { partnerId: 'x1', name: 'Kestrel Labs', stage: 'InFunnel' };

function setup(move: () => Observable<PartnerDto>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { move: vi.fn(move) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: PARTNERS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(MovePartnerDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const radios = () => Array.from(host.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
  const choose = (label: string) => {
    radios()
      .find((r) => r.closest('label')?.textContent?.trim().startsWith(label))!
      .click();
    fixture.detectChanges();
  };
  const primary = () =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Move to'),
    )!;
  const note = (value: string) => {
    const textarea = host.querySelector('textarea')!;
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
  };
  const confirm = async () => {
    primary().click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, ref, service, radios, choose, primary, note, confirm };
}

describe('MovePartnerDialog', () => {
  it('lists every stage, marks the current one and preselects the next', () => {
    const { host, radios, primary } = setup(() => of(partnerDto()));

    expect(host.textContent).toContain('Move Kestrel Labs');
    expect(host.textContent).toContain('Current stage');
    expect(radios().map((r) => r.checked)).toEqual([false, false, true]);
    expect(primary().textContent).toContain('Move to Confirmed');
  });

  it('moves the partner with the note and closes with it', async () => {
    const moved = partnerDto({ stage: 'Lead' });
    const { service, ref, choose, note, confirm, primary } = setup(() => of(moved));

    choose('Lead');
    expect(primary().textContent).toContain('Move to Lead');
    note(' Back to the start. ');
    await confirm();

    expect(service.move).toHaveBeenCalledWith('x1', 'Lead', 'Back to the start.');
    expect(ref.close).toHaveBeenCalledWith(moved);
  });

  it('cannot move to the stage the partner is already at', () => {
    const { choose, primary } = setup(() => of(partnerDto()));

    choose('In funnel');

    expect(primary().disabled).toBe(true);
  });

  it('stays open and says so when the move fails', async () => {
    const { ref, host, confirm } = setup(() => throwError(() => new Error('offline')));

    await confirm();

    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('That didn’t work');
  });
});
