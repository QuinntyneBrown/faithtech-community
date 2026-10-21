import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, BacklogNodeDto, WorkspaceDto } from '@faithtech-community/api';
import { of } from 'rxjs';

import { BacklogPage } from './backlog.page';

function node(patch: Partial<BacklogNodeDto>): BacklogNodeDto {
  return {
    id: patch.title ?? 'n',
    kind: 'Story',
    title: 'Story',
    status: 'ToDo',
    isDone: false,
    storyPoints: null,
    assigneeId: null,
    assigneeName: null,
    sprintId: null,
    children: [],
    ...patch,
  };
}

const tree = [
  node({
    kind: 'Initiative',
    title: 'Launch the hackathon season',
    children: [
      node({
        kind: 'Epic',
        title: 'Tech for Shelters hackathon',
        children: [
          node({
            title: 'Shelter problem briefs',
            status: 'InProgress',
            storyPoints: 8,
            children: [
              node({ kind: 'Task', title: 'Edit six briefs', assigneeName: 'Samuel Mensah' }),
            ],
          }),
        ],
      }),
    ],
  }),
  node({ kind: 'Epic', title: 'Monthly Builders Night' }),
  node({ title: 'Update the city team photo', storyPoints: 1 }),
];

async function setup() {
  const agile = {
    getWorkspace: vi.fn(() =>
      of({ id: 'w1', name: 'Toronto team', canEdit: true } as WorkspaceDto),
    ),
    getBacklog: vi.fn(() => of(tree)),
  };
  TestBed.configureTestingModule({ providers: [{ provide: AGILE_SERVICE, useValue: agile }] });
  const fixture = TestBed.createComponent(BacklogPage);
  fixture.componentRef.setInput('id', 'w1');
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
  fixture.detectChanges();
  return { host: fixture.nativeElement as HTMLElement, agile };
}

describe('BacklogPage', () => {
  it('words every row as the mock does', async () => {
    const { host } = await setup();
    const metas = Array.from(host.querySelectorAll('.ft-tree-item__meta')).map((m) =>
      m.textContent?.trim(),
    );
    expect(metas).toEqual([
      '1 epic',
      '1 story',
      'In Progress · 8 pts',
      'To Do · Samuel',
      'No initiative · 0 stories',
      'No epic · To Do · 1 pt',
    ]);
  });

  it('offers every initiative and epic as a filter', async () => {
    const { host } = await setup();
    const options = Array.from(host.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(options).toEqual([
      'All initiatives and epics',
      'Initiative: Launch the hackathon season',
      'Epic: Tech for Shelters hackathon',
      'Epic: Monthly Builders Night',
      'No epic',
    ]);
  });
});
