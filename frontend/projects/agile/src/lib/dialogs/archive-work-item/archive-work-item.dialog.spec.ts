import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, TaskDto, WorkItemDto } from '@faithtech-community/api';
import { of } from 'rxjs';

import { ArchiveWorkItemDialog } from './archive-work-item.dialog';

function setup(tasks: number) {
  const ref = { close: vi.fn() };
  const agile = { archiveWorkItem: vi.fn(() => of(undefined)) };
  const item = {
    id: 'i1',
    title: 'Shelter problem briefs for teams',
    tasks: Array.from({ length: tasks }, (_, i) => ({ id: `t${i}` }) as TaskDto),
  } as WorkItemDto;
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      { provide: DIALOG_DATA, useValue: { item } },
    ],
  });
  const fixture = TestBed.createComponent(ArchiveWorkItemDialog);
  fixture.detectChanges();
  return { fixture, ref, agile, host: fixture.nativeElement as HTMLElement };
}

describe('ArchiveWorkItemDialog', () => {
  it('says the story’s tasks are archived with it', () => {
    const { host } = setup(3);
    expect(host.textContent).toContain('Archive “Shelter problem briefs for teams”?');
    expect(host.textContent).toContain(
      'Its 3 tasks are archived with it. The owner can restore it from workspace settings.',
    );
  });

  it('leaves out tasks when there are none', () => {
    expect(setup(0).host.textContent).not.toContain('archived with it');
  });

  it('archives the item and closes with true', async () => {
    const { fixture, ref, agile, host } = setup(1);
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Archive')!
      .click();
    await fixture.whenStable();
    expect(agile.archiveWorkItem).toHaveBeenCalledWith('i1');
    expect(ref.close).toHaveBeenCalledWith(true);
  });
});
