import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AGILE_SERVICE,
  AUTH_SERVICE,
  Capability,
  WorkspaceSummaryDto,
} from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { WorkspacesPage } from './workspaces.page';

function summary(patch: Partial<WorkspaceSummaryDto>): WorkspaceSummaryDto {
  return {
    id: 'w1',
    name: 'Toronto team',
    method: 'Scrum',
    ownerId: 'p1',
    ownerName: 'Grace Okonkwo',
    isOwner: true,
    activeSprintName: 'Sprint 7',
    memberCount: 5,
    isArchived: false,
    needsNewOwner: false,
    ...patch,
  };
}

// L2-135 AC7: the page decides from capabilities, never a role name.
async function setup(capabilities: Capability[], list: () => Observable<WorkspaceSummaryDto[]>) {
  TestBed.configureTestingModule({
    providers: [
      { provide: AGILE_SERVICE, useValue: { listWorkspaces: vi.fn(list) } },
      { provide: AUTH_SERVICE, useValue: { capabilities: signal(capabilities) } },
    ],
  });
  const fixture = TestBed.createComponent(WorkspacesPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('WorkspacesPage', () => {
  it('words each workspace as the mock does', async () => {
    const host = await setup(['OwnWorkspaces'], () =>
      of([
        summary({}),
        summary({ id: 'w2', name: 'Hackathon ops', method: 'Kanban', memberCount: 1 }),
        summary({ id: 'w3', name: 'Austin', activeSprintName: null, isOwner: false }),
      ]),
    );
    const metas = Array.from(
      host.querySelectorAll('.ft-list-item__meta:not(.ft-list-item__meta-slot)'),
    ).map((m) => m.textContent?.trim());
    expect(metas).toEqual([
      'Owner: Grace Okonkwo · Scrum · Sprint 7 active · 5 members',
      'Owner: Grace Okonkwo · Kanban · 1 member',
      'Owner: Grace Okonkwo · Scrum · no active sprint · 5 members',
    ]);
    expect(host.querySelectorAll('ft-badge')).toHaveLength(2);
  });

  it('offers New workspace to holders of OwnWorkspaces only', async () => {
    const lead = await setup(['OwnWorkspaces'], () => of([]));
    expect(lead.textContent).toContain('Create your first workspace');
    TestBed.resetTestingModule();
    const volunteer = await setup(['JoinWorkspaces'], () => of([]));
    expect(volunteer.textContent).toContain('No workspaces yet');
    expect(volunteer.textContent).not.toContain('New workspace');
  });

  it('tells a reader of every workspace the list is read-only', async () => {
    const host = await setup(['ReadAllWorkspaces'], () => of([summary({ isOwner: false })]));
    expect(host.textContent).toContain('Every workspace, read-only');
    expect(host.textContent).toContain('Read-only for Staff');
  });

  it('shows an error with Try again when the list fails', async () => {
    const host = await setup(['OwnWorkspaces'], () => throwError(() => new Error('down')));
    expect(host.textContent).toContain('We couldn’t load your workspaces');
  });
});
