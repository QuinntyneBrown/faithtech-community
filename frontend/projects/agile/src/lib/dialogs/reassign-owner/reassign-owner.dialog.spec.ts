import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AGILE_SERVICE, WorkspaceDto } from '@faithtech-community/api';
import { of, throwError } from 'rxjs';

import { ReassignOwnerDialog } from './reassign-owner.dialog';

async function setup(reassign = () => of(undefined)) {
  const ref = { close: vi.fn() };
  const agile = {
    listOwnerCandidates: vi.fn(() =>
      of([
        { profileId: 'p3', name: 'Esther Nakamura', roles: ['CityLead' as const] },
        { profileId: 'p4', name: 'Joel Mbeki', roles: ['CityLead' as const] },
      ]),
    ),
    reassignOwner: vi.fn(reassign),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: AGILE_SERVICE, useValue: agile },
      {
        provide: DIALOG_DATA,
        useValue: {
          workspace: { id: 'w1', name: 'Toronto team', ownerName: 'Grace Okonkwo' } as WorkspaceDto,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ReassignOwnerDialog);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const select = host.querySelector('select')!;
  const confirm = async () => {
    Array.from(host.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Reassign owner')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const choose = (value: string) => {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };
  return { fixture, ref, agile, host, select, confirm, choose };
}

describe('ReassignOwnerDialog', () => {
  it('says why and offers only City Leads', async () => {
    const { host, select } = await setup();
    expect(host.textContent).toContain('Choose a new owner for Toronto team');
    expect(host.textContent).toContain('Grace Okonkwo no longer holds the City Lead role');
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual([
      'Choose a City Lead',
      'Esther Nakamura',
      'Joel Mbeki',
    ]);
  });

  it('asks for an owner before reassigning', async () => {
    const { agile, host, confirm } = await setup();
    await confirm();
    expect(agile.reassignOwner).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Choose who will own this workspace.');
  });

  it('reassigns to the chosen City Lead and closes with their name', async () => {
    const { ref, agile, choose, confirm } = await setup();
    choose('p4');
    await confirm();
    expect(agile.reassignOwner).toHaveBeenCalledWith('w1', 'p4');
    expect(ref.close).toHaveBeenCalledWith('Joel Mbeki');
  });

  it('shows the server’s reason when the choice is refused', async () => {
    const refused = new HttpErrorResponse({
      status: 400,
      error: { errors: { OwnerId: ['Choose a City Lead.'] } },
    });
    const { ref, host, choose, confirm } = await setup(() => throwError(() => refused));
    choose('p3');
    await confirm();
    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Choose a City Lead.');
  });
});
