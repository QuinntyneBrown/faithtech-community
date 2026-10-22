import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, BoardCardDto, BoardSprintDto } from '@faithtech-community/api';
import { of } from 'rxjs';

import { CloseSprintDialog } from './close-sprint.dialog';

const card = (title: string) => ({ id: title, title }) as BoardCardDto;

function setup() {
  const ref = { close: vi.fn() };
  const agile = { closeSprint: vi.fn(() => of(undefined)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      {
        provide: DIALOG_DATA,
        useValue: {
          workspaceId: 'w1',
          sprint: {
            id: 'sp7',
            name: 'Sprint 7',
            completedPoints: 6,
            totalPoints: 24,
          } as BoardSprintDto,
          unfinished: [
            { card: card('Kiosk'), status: 'ToDo' },
            { card: card('Briefs'), status: 'InProgress' },
          ],
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(CloseSprintDialog);
  fixture.detectChanges();
  return { fixture, ref, agile, host: fixture.nativeElement as HTMLElement };
}

describe('CloseSprintDialog', () => {
  it('says what the sprint completed and what goes back', () => {
    const { host } = setup();
    expect(host.textContent).toContain(
      '6 of 24 points completed. 2 unfinished stories go back to the backlog and keep their status.',
    );
    expect(host.textContent).toContain('In Progress');
  });

  it('closes the sprint and closes with true', async () => {
    const { fixture, ref, agile, host } = setup();
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Close sprint')!
      .click();
    await fixture.whenStable();
    expect(agile.closeSprint).toHaveBeenCalledWith('w1', 'sp7');
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
