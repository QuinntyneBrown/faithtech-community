import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, WorkspaceDto } from '@faithtech-community/api';
import { of, throwError } from 'rxjs';

import { ArchiveWorkspaceDialog } from './archive-workspace.dialog';

function setup(archive = () => of(undefined)) {
  const ref = { close: vi.fn() };
  const agile = { archiveWorkspace: vi.fn(archive) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      {
        provide: DIALOG_DATA,
        useValue: { workspace: { id: 'w1', name: 'Toronto team' } as WorkspaceDto },
      },
    ],
  });
  const fixture = TestBed.createComponent(ArchiveWorkspaceDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const confirm = () =>
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Archive workspace')!
      .click();
  return { fixture, ref, agile, host, confirm };
}

describe('ArchiveWorkspaceDialog', () => {
  it('says members lose access and it can be restored', () => {
    const { host } = setup();
    expect(host.textContent).toContain('Archive Toronto team?');
    expect(host.textContent).toContain(
      'Members lose access. Everything is kept, and you can restore it from Workspaces.',
    );
  });

  it('archives the workspace and closes with true', async () => {
    const { fixture, ref, agile, confirm } = setup();
    confirm();
    await fixture.whenStable();
    expect(agile.archiveWorkspace).toHaveBeenCalledWith('w1');
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays open and says so when archiving fails', async () => {
    const { fixture, ref, host, confirm } = setup(() => throwError(() => new Error('down')));
    confirm();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('That didn’t work');
  });
});
