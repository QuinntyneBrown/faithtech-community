import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE } from '@faithtech-community/api';
import { of } from 'rxjs';

import { MoveCardDialog } from './move-card.dialog';

function setup() {
  const ref = { close: vi.fn() };
  const agile = { moveCard: vi.fn(() => of(undefined)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      { provide: DIALOG_DATA, useValue: { itemId: 'i1', title: 'Kiosk', status: 'ToDo' } },
    ],
  });
  const fixture = TestBed.createComponent(MoveCardDialog);
  fixture.detectChanges();
  return { fixture, ref, agile, host: fixture.nativeElement as HTMLElement };
}

describe('MoveCardDialog', () => {
  it('marks the current column', () => {
    expect(setup().host.textContent).toContain('Current column');
  });

  it('moves the card and closes with the new column', async () => {
    const { fixture, ref, agile, host } = setup();
    host.querySelectorAll<HTMLInputElement>('input[type=radio]')[2].click();
    fixture.detectChanges();
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Move to Done'))!
      .click();
    await fixture.whenStable();
    expect(agile.moveCard).toHaveBeenCalledWith('i1', 'Done');
    expect(ref.close).toHaveBeenCalledWith('Done');
  });
});
