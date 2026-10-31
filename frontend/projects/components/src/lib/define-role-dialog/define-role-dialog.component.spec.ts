import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';

import {
  DefineRoleDialogComponent,
  DefineRoleDialogData,
  RoleDefinitionValue,
} from './define-role-dialog.component';

const capabilities = [
  { value: 'ManageEvents', label: 'Manage events', description: 'Create, edit and cancel events.' },
  { value: 'ViewReports', label: 'View reports', description: 'Open the Reports page.' },
];

function setup(overrides: Partial<DefineRoleDialogData> = {}) {
  const ref = { close: vi.fn(), disableClose: false };
  const data: DefineRoleDialogData = {
    mode: 'define',
    capabilities,
    submit: vi.fn(async () => null),
    ...overrides,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(DefineRoleDialogComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const text = () => host.textContent ?? '';
  const button = (name: RegExp) =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      name.test(b.textContent?.trim() ?? ''),
    )!;
  const name = () => host.querySelector<HTMLInputElement>('input[type="text"]')!;
  const type = (value: string) => {
    name().value = value;
    name().dispatchEvent(new Event('input'));
  };
  const check = (value: string) => {
    host.querySelector<HTMLInputElement>(`input[type="checkbox"][value="${value}"]`)!.click();
  };
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host, data, ref, text, button, name, type, check, settle };
}

describe('DefineRoleDialogComponent', () => {
  it('asks for a name before it saves', async () => {
    const { text, button, data, settle } = setup();
    expect(text()).toContain('Define a role');
    expect(text()).toContain(
      'A role is a named set of capabilities. Members can hold several roles.',
    );
    button(/^Define role$/).click();
    await settle();
    expect(text()).toContain('Enter a name for the role.');
    expect(data.submit).not.toHaveBeenCalled();
  });

  it('submits the trimmed name, the capabilities and the options, and closes with them', async () => {
    const { type, check, button, data, ref, settle, host } = setup();
    type('  Meet-up Lead ');
    check('ViewReports');
    host.querySelectorAll<HTMLInputElement>('input[role="switch"]')[0].click();
    button(/^Define role$/).click();
    await settle();
    const value: RoleDefinitionValue = {
      name: 'Meet-up Lead',
      description: '',
      capabilities: ['ViewReports'],
      showOnTeam: true,
      isOversight: false,
      chapterScopable: false,
    };
    expect(data.submit).toHaveBeenCalledWith(value);
    expect(ref.close).toHaveBeenCalledWith(value);
  });

  it('offers "Can be held for a city" only while chapters are on, and saves it', async () => {
    expect(setup().text()).not.toContain('Can be held for a');
    TestBed.resetTestingModule();
    const { type, text, button, data, settle, host } = setup({ chapterLabel: 'City' });
    expect(text()).toContain('Can be held for a city');
    type('Meet-up Lead');
    host.querySelectorAll<HTMLInputElement>('input[role="switch"]')[1].click();
    button(/^Define role$/).click();
    await settle();
    expect(data.submit).toHaveBeenCalledWith(expect.objectContaining({ chapterScopable: true }));
  });

  it('edits a role from what it holds and says how many hold it', () => {
    const { text, name, button, host } = setup({
      mode: 'edit',
      role: {
        name: 'Steward',
        description: 'Looks after roles',
        capabilities: ['ManageEvents'],
        showOnTeam: false,
        isOversight: true,
        chapterScopable: false,
        holderCount: 1,
      },
    });
    expect(text()).toContain('Edit Steward');
    expect(text()).toContain('1 member holds Steward. Changes apply on their next request.');
    expect(name().value).toBe('Steward');
    expect(host.querySelector<HTMLInputElement>('input[value="ManageEvents"]')!.checked).toBe(true);
    expect(button(/^Save changes$/)).toBeTruthy();
  });

  it('shows a refusal inside the dialog and a field error on its field', async () => {
    const submit = vi
      .fn()
      .mockResolvedValueOnce({ message: 'Only an administrator can grant administration.' })
      .mockResolvedValueOnce({ errors: { name: 'A role called Volunteer already exists.' } });
    const { type, button, text, ref, settle } = setup({ submit });
    type('Volunteer');
    button(/^Define role$/).click();
    await settle();
    expect(text()).toContain('Not saved');
    expect(text()).toContain('Only an administrator can grant administration.');
    button(/^Define role$/).click();
    await settle();
    expect(text()).toContain('A role called Volunteer already exists.');
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('keeps the input after a failure and offers Try again', async () => {
    const { type, button, text, name, settle } = setup({
      submit: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    type('Meet-up Lead');
    button(/^Define role$/).click();
    await settle();
    expect(text()).toContain('Role not saved');
    expect(name().value).toBe('Meet-up Lead');
    expect(button(/^Try again$/)).toBeTruthy();
  });

  it('makes the fields read-only while saving', async () => {
    let finish!: () => void;
    const { type, button, name, fixture } = setup({
      submit: () => new Promise((resolve) => (finish = () => resolve(null))),
    });
    type('Meet-up Lead');
    button(/^Define role$/).click();
    fixture.detectChanges();
    expect(name().readOnly).toBe(true);
    expect(button(/^Saving…$/)).toBeTruthy();
    finish();
  });
});
