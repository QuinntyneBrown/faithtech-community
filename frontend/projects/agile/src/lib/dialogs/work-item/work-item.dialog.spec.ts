import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, WorkItemDto, WorkspaceDto } from '@faithtech-community/api';
import { of } from 'rxjs';

import { WorkItemDialog, WorkItemDialogData } from './work-item.dialog';

const workspace = {
  id: 'w1',
  name: 'Toronto team',
  canManage: false,
  members: [{ profileId: 'p1', name: 'Grace Okonkwo' }],
} as WorkspaceDto;

async function setup(data: WorkItemDialogData) {
  const ref = { close: vi.fn() };
  const agile = {
    getBacklog: vi.fn(() => of([])),
    createWorkItem: vi.fn(() => of({ id: 'i1' } as WorkItemDto)),
    updateWorkItem: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      { provide: DIALOG_DATA, useValue: data },
    ],
  });
  const fixture = TestBed.createComponent(WorkItemDialog);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  return { fixture, host, ref, agile, button };
}

describe('WorkItemDialog', () => {
  it('offers a member only stories and tasks', async () => {
    const { host } = await setup({ workspace });
    const kinds = Array.from(host.querySelectorAll('input[type=radio]')).map(
      (r) => (r as HTMLInputElement).value,
    );
    expect(kinds).toEqual(['Story', 'Task']);
    expect(host.textContent).toContain('Only the owner creates initiatives and epics.');
  });

  it('offers the owner every level', async () => {
    const { host } = await setup({ workspace: { ...workspace, canManage: true } });
    expect(host.querySelectorAll('input[type=radio]')).toHaveLength(4);
  });

  it('asks for a title and for a task’s story before saving', async () => {
    const { fixture, host, agile, button } = await setup({ workspace, kind: 'Task' });
    button('Create').click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Give it a title.');
    expect(host.textContent).toContain('A task must belong to a story.');
    expect(agile.createWorkItem).not.toHaveBeenCalled();
  });

  it('saves an edit without changing the status', async () => {
    const item = {
      id: 'i1',
      kind: 'Story',
      title: 'Kiosk',
      description: '',
      status: 'InProgress',
      assigneeId: null,
      storyPoints: 5,
      parent: null,
    } as unknown as WorkItemDto;
    const { fixture, host, ref, agile, button } = await setup({ workspace, item });
    expect(host.textContent).toContain('Edit story');
    button('Save').click();
    await fixture.whenStable();
    expect(agile.updateWorkItem).toHaveBeenCalledWith('i1', {
      title: 'Kiosk',
      description: '',
      assigneeId: null,
      storyPoints: 5,
      status: 'InProgress',
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
