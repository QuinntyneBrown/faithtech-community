import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, SprintDto, SprintsDto, WorkspaceDto } from '@faithtech-community/api';
import { of } from 'rxjs';

import { StartSprintDialog } from './start-sprint.dialog';

const closed = (name: string) => ({ name, state: 'Closed' }) as SprintDto;
const sprints: SprintsDto = {
  active: { name: 'Sprint 7', state: 'Active' } as SprintDto,
  history: [closed('Sprint 6'), closed('Sprint 5')],
  averageCompletedPoints: 21,
  candidates: [
    {
      id: 's1',
      title: 'Volunteer check-in kiosk',
      storyPoints: 5,
      status: 'ToDo',
      returnedFrom: null,
    },
    {
      id: 's2',
      title: 'Shelter briefs',
      storyPoints: 8,
      status: 'InProgress',
      returnedFrom: 'Sprint 7',
    },
  ],
};

function setup() {
  const ref = { close: vi.fn() };
  const agile = { startSprint: vi.fn(() => of(undefined)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      { provide: DIALOG_DATA, useValue: { workspace: { id: 'w1' } as WorkspaceDto, sprints } },
    ],
  });
  const fixture = TestBed.createComponent(StartSprintDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const startButton = () =>
    Array.from(host.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Start sprint',
    )!;
  return { fixture, host, ref, agile, startButton };
}

describe('StartSprintDialog', () => {
  it('names the next sprint after the last one and shows what to plan by', () => {
    const { host } = setup();
    expect(host.querySelector<HTMLInputElement>('input[type=text]')!.value).toBe('Sprint 8');
    expect(host.textContent).toContain('8 pts · returned from Sprint 7');
    expect(host.textContent).toContain('Recent sprints completed 21 points on average.');
  });

  it('adds up the chosen stories’ points', () => {
    const { fixture, host } = setup();
    host.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((c) => c.click());
    fixture.detectChanges();
    expect(host.textContent).toContain('Stories from the backlog · 13 points');
  });

  it('asks for a goal and a story before starting', () => {
    const { fixture, host, agile, startButton } = setup();
    startButton().click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Write a goal so the team knows what done looks like.');
    expect(host.textContent).toContain('Choose at least one story.');
    expect(agile.startSprint).not.toHaveBeenCalled();
  });
});
