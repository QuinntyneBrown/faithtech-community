import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, WorkspaceDto, WorkspaceMemberDto } from '@faithtech-community/api';
import { of, throwError } from 'rxjs';

import { RemoveWorkspaceMemberDialog } from './remove-workspace-member.dialog';

const workspace = { id: 'w1', name: 'Toronto team' } as WorkspaceDto;

function setup(member: Partial<WorkspaceMemberDto>, remove = () => of(undefined)) {
  const ref = { close: vi.fn() };
  const agile = { removeMember: vi.fn(remove) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      {
        provide: DIALOG_DATA,
        useValue: {
          workspace,
          member: {
            profileId: 'p2',
            name: 'Ruth Alvarez',
            assignedStories: 0,
            assignedTasks: 0,
            ...member,
          },
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(RemoveWorkspaceMemberDialog);
  fixture.detectChanges();
  return { fixture, ref, agile, host: fixture.nativeElement as HTMLElement };
}

describe('RemoveWorkspaceMemberDialog', () => {
  it('says what removing the member unassigns', () => {
    const { host } = setup({ assignedStories: 2, assignedTasks: 1 });
    expect(host.textContent).toContain('Remove Ruth Alvarez from Toronto team?');
    expect(host.textContent).toContain(
      'Ruth Alvarez loses access straight away. Their 2 stories and 1 task become unassigned.',
    );
  });

  it('removes the member and closes with true', async () => {
    const { fixture, ref, agile, host } = setup({});
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Remove member'))!
      .click();
    await fixture.whenStable();
    expect(agile.removeMember).toHaveBeenCalledWith('w1', 'p2');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays open and says so when the removal fails', async () => {
    const { fixture, ref, host } = setup({}, () => throwError(() => new Error('down')));
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Remove member'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('That didn’t work');
  });
});
