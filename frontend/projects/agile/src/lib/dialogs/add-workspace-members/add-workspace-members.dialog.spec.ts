import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, WorkspaceDto, ORGANISATION_SERVICE } from '@faithtech-community/api';
import { of } from 'rxjs';

import { AddWorkspaceMembersDialog } from './add-workspace-members.dialog';

async function setup() {
  const ref = { close: vi.fn() };
  const agile = {
    listMemberCandidates: vi.fn(() =>
      of([{ profileId: 'p3', name: 'Marcus Lee', roles: ['EventLead' as const] }]),
    ),
    addMembers: vi.fn(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [
      // The FaithTech seed's names for the role keys (L2-151).
      {
        provide: ORGANISATION_SERVICE,
        useValue: {
          get: () =>
            of({
              roles: [
                {
                  id: 'role-CityLead',
                  key: 'CityLead',
                  name: 'City Lead',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-EventLead',
                  key: 'EventLead',
                  name: 'Event Lead',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-CreateLead',
                  key: 'CreateLead',
                  name: 'Create Lead',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-CommunicationsLead',
                  key: 'CommunicationsLead',
                  name: 'Communications Lead',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-Staff',
                  key: 'Staff',
                  name: 'Staff',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-Volunteer',
                  key: 'Volunteer',
                  name: 'Volunteer',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-ProductEngineer',
                  key: 'ProductEngineer',
                  name: 'Product Engineer',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-Attendee',
                  key: 'Attendee',
                  name: 'Attendee',
                  description: '',
                  chapterScopable: false,
                },
                {
                  id: 'role-SystemAdmin',
                  key: 'SystemAdmin',
                  name: 'System Admin',
                  description: '',
                  chapterScopable: false,
                },
              ],
            }),
        },
      },
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      { provide: DIALOG_DATA, useValue: { id: 'w1', name: 'Toronto team' } as WorkspaceDto },
    ],
  });
  const fixture = TestBed.createComponent(AddWorkspaceMembersDialog);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const addButton = () =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Add members'),
    )!;
  return { fixture, ref, agile, host, addButton };
}

describe('AddWorkspaceMembersDialog', () => {
  it('offers the candidates with their roles', async () => {
    const { host } = await setup();
    expect(host.textContent).toContain('Marcus Lee');
    expect(host.textContent).toContain('Event Lead');
  });

  it('asks for at least one person', async () => {
    const { fixture, agile, host, addButton } = await setup();
    addButton().click();
    fixture.detectChanges();
    expect(host.textContent).toContain('Choose at least one person.');
    expect(agile.addMembers).not.toHaveBeenCalled();
  });

  it('adds the chosen people and closes with their names', async () => {
    const { fixture, ref, agile, host, addButton } = await setup();
    host.querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    addButton().click();
    await fixture.whenStable();
    expect(agile.addMembers).toHaveBeenCalledWith('w1', ['p3']);
    expect(ref.close).toHaveBeenCalledWith(['Marcus Lee']);
  });
});
