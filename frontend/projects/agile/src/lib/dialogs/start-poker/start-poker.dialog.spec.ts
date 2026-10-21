import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import {
  AGILE_SERVICE,
  BacklogNodeDto,
  WorkspaceDto,
  WorkspaceMemberDto,
} from '@faithtech-community/api';
import { of } from 'rxjs';

import { StartPokerDialog } from './start-poker.dialog';

const member = (profileId: string, name: string, isYou = false) =>
  ({ profileId, name, roles: ['Volunteer'], isYou }) as unknown as WorkspaceMemberDto;
const story = (id: string, title: string, storyPoints: number | null = null) =>
  ({ id, title, kind: 'Story', storyPoints }) as BacklogNodeDto;

function setup() {
  const ref = { close: vi.fn() };
  const session = { id: 's1' };
  const agile = { startPokerSession: vi.fn(() => of(session)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      {
        provide: DIALOG_DATA,
        useValue: {
          workspace: {
            id: 'w1',
            members: [member('p1', 'Marcus Lee', true), member('p2', 'Grace Okonkwo')],
          } as WorkspaceDto,
          stories: [story('i1', 'Shelter problem briefs'), story('i2', 'Kiosk', 5)],
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(StartPokerDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const check = (label: string) => {
    const box = Array.from(host.querySelectorAll('label'))
      .find((l) => l.textContent?.includes(label))!
      .querySelector('input')!;
    box.click();
  };
  const start = async () => {
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Start and invite')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, ref, agile, host, check, start, session };
}

describe('StartPokerDialog', () => {
  it('offers the stories with their estimate and every member but the facilitator', () => {
    const { host } = setup();
    expect(host.textContent).toContain('Not estimated');
    expect(host.textContent).toContain('5 pts');
    expect(host.textContent).toContain('Grace Okonkwo');
    expect(host.textContent).not.toContain('Marcus Lee');
  });

  it('asks for a story before starting', async () => {
    const { agile, host, start } = setup();
    await start();
    expect(agile.startPokerSession).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Choose at least one story to estimate.');
  });

  it('starts the session with the chosen stories and invitees and closes with it', async () => {
    const { agile, ref, check, start, session } = setup();
    check('Kiosk');
    check('Grace Okonkwo');
    await start();
    expect(agile.startPokerSession).toHaveBeenCalledWith('w1', {
      storyIds: ['i2'],
      invitedIds: ['p2'],
    });
    expect(ref.close).toHaveBeenCalledWith(session);
  });
});
