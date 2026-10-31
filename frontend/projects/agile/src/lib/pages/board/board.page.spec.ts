import { TestBed } from '@angular/core/testing';
import {
  AGILE_LIVE_SERVICE,
  AGILE_SERVICE,
  BoardDto,
  WorkspaceDto,
} from '@faithtech-community/api';
import { NEVER, of } from 'rxjs';

import { BoardPage } from './board.page';

const board: BoardDto = {
  method: 'Scrum',
  sprint: {
    id: 's7',
    name: 'Sprint 7',
    goal: 'Hackathon ready for registration',
    startDate: '2026-10-20',
    endDate: '2026-10-31',
    completedPoints: 6,
    totalPoints: 24,
  },
  columns: [
    {
      status: 'ToDo',
      cards: [
        {
          id: 'c1',
          title: 'Volunteer check-in kiosk',
          assigneeId: 'p2',
          assigneeName: 'Samuel Mensah',
          storyPoints: 5,
          tasksDone: 0,
          tasksTotal: 3,
        },
      ],
    },
    { status: 'InProgress', cards: [] },
    { status: 'Done', cards: [] },
  ],
};

async function setup(access: WorkspaceDto['access'] = 'Owner') {
  const agile = {
    getWorkspace: vi.fn(() =>
      of({
        id: 'w1',
        name: 'Toronto team',
        ownerName: 'Grace Okonkwo',
        access,
        canEdit: access !== 'Reader',
      } as WorkspaceDto),
    ),
    getBacklog: vi.fn(() => of([])),
    getBoard: vi.fn(() => of(board)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AGILE_SERVICE, useValue: agile },
      { provide: AGILE_LIVE_SERVICE, useValue: { watchBoard: () => NEVER } },
    ],
  });
  const fixture = TestBed.createComponent(BoardPage);
  fixture.componentRef.setInput('id', 'w1');
  for (let i = 0; i < 4; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BoardPage', () => {
  it('words the sprint and the cards as the mock does', async () => {
    const host = await setup();
    expect(host.querySelector('ft-page-header')!.textContent).toContain(
      'Scrum · Sprint 7 · Tue 20 – Sat 31 Oct',
    );
    expect(host.textContent).toContain('6 of 24');
    expect(host.textContent).toContain('Samuel · 5 pts · 0/3 tasks');
  });

  it('tells a member whose workspace it is', async () => {
    const host = await setup('Member');
    expect(host.textContent).toContain('You’re a member of Grace’s workspace');
  });

  it('gives Staff no Move buttons', async () => {
    const host = await setup('Reader');
    expect(host.querySelector('button[aria-label^="Move "]')).toBeNull();
  });
});
