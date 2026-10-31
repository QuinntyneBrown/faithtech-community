import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';

import { EditGrantsDialogComponent, EditGrantsDialogData } from './edit-grants-dialog.component';

const roles = [
  { value: 'r1', label: 'Event Lead', description: 'Creates and manages events' },
  { value: 'r2', label: 'Volunteer', description: 'Joins the city team' },
  {
    value: 'r3',
    label: 'System Admin',
    description: 'Administers everything',
    disabledReason: 'Only administrators can grant administration',
  },
];

function setup(overrides: Partial<EditGrantsDialogData> = {}) {
  const ref = { close: vi.fn(), disableClose: false };
  const data: EditGrantsDialogData = {
    grantor: 'City Lead',
    canAssign: true,
    roles,
    granted: ['r1'],
    submit: vi.fn(async () => null),
    ...overrides,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(EditGrantsDialogComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const text = () => host.textContent ?? '';
  const button = (name: RegExp) =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      name.test(b.textContent?.trim() ?? ''),
    )!;
  const box = (value: string) =>
    host.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${value}"]`)!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { host, data, ref, text, button, box, settle };
}

describe('EditGrantsDialogComponent', () => {
  it('names the grantor, ticks its rules and disables administration with the reason', () => {
    const { text, box } = setup();
    expect(text()).toContain('Who may grant: City Lead');
    expect(text()).toContain('Holders of City Lead may add and remove:');
    expect(text()).toContain('Only administrators can grant administration');
    expect(text()).toContain(
      'Holders of Administer the organisation can add and remove every role without a rule.',
    );
    expect(box('r1').checked).toBe(true);
    expect(box('r2').checked).toBe(false);
    expect(box('r3').disabled).toBe(true);
    expect(text()).not.toContain('can’t assign roles');
  });

  it('explains that rules for a grantor without Assign roles are stored but inactive', () => {
    const { text } = setup({ grantor: 'Staff', canAssign: false });
    expect(text()).toContain(
      'This role can’t assign roles until it has the Assign roles capability. The rules are saved and start working when it does.',
    );
  });

  it('submits the ticked roles and closes with them', async () => {
    const { box, button, data, ref, settle } = setup();
    box('r2').click();
    button(/^Save rules$/).click();
    await settle();
    expect(data.submit).toHaveBeenCalledWith(['r1', 'r2']);
    expect(ref.close).toHaveBeenCalledWith(['r1', 'r2']);
  });

  it('shows a refusal under the checklist and stays open', async () => {
    const { button, text, ref, settle } = setup({
      submit: vi.fn(
        async () => 'Only administrators can grant administration. Untick System Admin to save.',
      ),
    });
    button(/^Save rules$/).click();
    await settle();
    expect(text()).toContain(
      'Only administrators can grant administration. Untick System Admin to save.',
    );
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('keeps the input and offers Try again when the call fails', async () => {
    const { box, button, text, settle } = setup({
      submit: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    box('r2').click();
    button(/^Save rules$/).click();
    await settle();
    expect(text()).toContain('Grant rules not saved');
    expect(box('r2').checked).toBe(true);
    expect(button(/^Try again$/)).toBeTruthy();
  });
});
