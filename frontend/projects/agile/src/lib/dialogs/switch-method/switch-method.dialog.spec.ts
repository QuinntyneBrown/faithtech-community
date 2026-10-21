import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, WorkspaceDto } from '@faithtech-community/api';
import { of, throwError } from 'rxjs';

import { SwitchMethodDialog } from './switch-method.dialog';

function setup(method: 'Scrum' | 'Kanban', activeSprintName: string | null, fail = false) {
  const ref = { close: vi.fn() };
  const agile = {
    switchMethod: vi.fn(() => (fail ? throwError(() => new Error('down')) : of(undefined))),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      {
        provide: DIALOG_DATA,
        useValue: {
          workspace: { id: 'w1', name: 'Toronto team', method } as WorkspaceDto,
          activeSprintName,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(SwitchMethodDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === text)!;
  return { fixture, ref, agile, host, button };
}

describe('SwitchMethodDialog', () => {
  it('says a switch to Kanban closes the running sprint', () => {
    const { host } = setup('Scrum', 'Sprint 7');
    expect(host.textContent).toContain('Switch Toronto team to Kanban?');
    expect(host.textContent).toContain(
      'Switching to Kanban closes Sprint 7, and its unfinished stories return to the backlog.',
    );
  });

  it('says a switch to Scrum sends stories not Done to the backlog', () => {
    const { host } = setup('Kanban', null);
    expect(host.textContent).toContain('Every story that isn’t Done goes to the backlog');
  });

  it('switches and closes with the new method', async () => {
    const { fixture, ref, agile, button } = setup('Scrum', null);
    button('Switch to Kanban').click();
    await fixture.whenStable();
    expect(agile.switchMethod).toHaveBeenCalledWith('w1', 'Kanban');
    expect(ref.close).toHaveBeenCalledWith('Kanban');
  });

  it('stays open and says so when the switch fails', async () => {
    const { fixture, ref, host, button } = setup('Scrum', null, true);
    button('Switch to Kanban').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.textContent).toContain('That didn’t work');
    expect(ref.close).not.toHaveBeenCalled();
  });
});
