import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';

import { ArchiveRoleDialogComponent, ArchiveRoleDialogData } from './archive-role-dialog.component';

function setup(overrides: Partial<ArchiveRoleDialogData> = {}) {
  const ref = { close: vi.fn(), disableClose: false };
  const data: ArchiveRoleDialogData = {
    role: 'Mentor',
    submit: vi.fn(async () => null),
    ...overrides,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(ArchiveRoleDialogComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const text = () => host.textContent ?? '';
  const buttons = () =>
    Array.from(host.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');
  const button = (name: RegExp) =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      name.test(b.textContent?.trim() ?? ''),
    )!;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { data, ref, text, buttons, button, settle };
}

describe('ArchiveRoleDialogComponent', () => {
  it('asks to archive the role and archives it', async () => {
    const { text, button, data, ref, settle } = setup();
    expect(text()).toContain('Archive Mentor?');
    expect(text()).toContain('It leaves every role picker. Its history stays in the audit log.');
    expect(text()).toContain(
      'No one holds Mentor and nothing uses it. Archived roles are read-only and listed under Archived.',
    );
    button(/^Archive role$/).click();
    await settle();
    expect(data.submit).toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('shows a refusal in place of the confirmation and offers only Close', async () => {
    const { text, buttons, button, ref, settle } = setup({
      role: 'Volunteer',
      submit: vi.fn(async () => '18 members hold this role. Remove it from them first.'),
    });
    button(/^Archive role$/).click();
    await settle();
    expect(text()).toContain('Can’t archive Volunteer');
    expect(text()).toContain('18 members hold this role. Remove it from them first.');
    expect(text()).not.toContain('nothing uses it');
    expect(buttons().filter((b) => b !== '')).toEqual(['Close']);
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('offers Try again when the call fails', async () => {
    const { text, button, settle } = setup({
      submit: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    button(/^Archive role$/).click();
    await settle();
    expect(text()).toContain('Role not archived');
    expect(button(/^Try again$/)).toBeTruthy();
  });
});
