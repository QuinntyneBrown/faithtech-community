import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';

import { RoleDialogComponent, RoleDialogData } from './role-dialog.component';

const options = [
  { value: 'Volunteer', label: 'Volunteer', description: 'Joins the city team' },
  { value: 'Attendee', label: 'Attendee', description: 'Comes to events' },
];

function setup(overrides: Partial<RoleDialogData> = {}) {
  const ref = { close: vi.fn(), disableClose: false };
  const data: RoleDialogData = {
    mode: 'add',
    name: 'Jonah Bell',
    description: 'Jonah holds Product Engineer. People can hold several roles at once.',
    options,
    caption: 'City Lead, Staff and System Admin can only be granted by a System Admin.',
    submit: vi.fn(async () => null),
    ...overrides,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(RoleDialogComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(name))!;
  const choose = (value: string) => {
    const radio = host.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host, ref, data, button, choose, settle };
}

describe('RoleDialogComponent', () => {
  it('offers each role with what it means and the caption', () => {
    const { host } = setup();
    expect(host.querySelector('h2')!.textContent).toContain('Add a role for Jonah Bell');
    expect(host.querySelector('legend')!.textContent).toContain('Role');
    expect(host.textContent).toContain('Joins the city team');
    expect(host.textContent).toContain('can only be granted by a System Admin');
  });

  it('asks for a choice before adding', async () => {
    const { host, data, button, settle } = setup();
    button('Add role').click();
    await settle();
    expect(host.textContent).toContain('Choose a role to add.');
    expect(data.submit).not.toHaveBeenCalled();
  });

  it('adds the chosen role and closes with it', async () => {
    const { ref, data, button, choose, settle } = setup();
    choose('Attendee');
    button('Add role').click();
    await settle();
    expect(data.submit).toHaveBeenCalledWith('Attendee');
    expect(ref.close).toHaveBeenCalledWith('Attendee');
  });

  it('names the role being removed and preselects the first', async () => {
    const { host, data, button, choose, settle } = setup({ mode: 'remove', name: 'Ruth Alvarez' });
    expect(host.querySelector('h2')!.textContent).toContain('Remove Volunteer from Ruth Alvarez?');
    choose('Attendee');
    expect(host.querySelector('h2')!.textContent).toContain('Remove Attendee from Ruth Alvarez?');
    button('Remove role').click();
    await settle();
    expect(data.submit).toHaveBeenCalledWith('Attendee');
  });

  it('shows the server’s reason and stays open when the change is refused', async () => {
    const { host, ref, button, choose, settle } = setup({
      submit: async () => 'There must always be at least one System Admin.',
    });
    choose('Volunteer');
    button('Add role').click();
    await settle();
    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('There must always be at least one System Admin.');
  });

  it('says it didn’t work when the request fails', async () => {
    const { host, ref, button, choose, settle } = setup({
      submit: () => Promise.reject(new Error('offline')),
    });
    choose('Volunteer');
    button('Add role').click();
    await settle();
    expect(ref.close).not.toHaveBeenCalled();
    expect(host.querySelector('ft-alert')!.textContent).toContain('Role not added');
  });

  it('names the role that was not removed when the request fails', async () => {
    const { host, button, settle } = setup({
      mode: 'remove',
      name: 'Ruth Alvarez',
      submit: () => Promise.reject(new Error('offline')),
    });
    button('Remove role').click();
    await settle();
    expect(host.querySelector('ft-alert')!.textContent).toContain('Role not removed');
  });
});
