// Traces to: L2-095 (docs/detailed-designs/events/event-check-in)
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { CHECK_IN_SERVICE, WalkInResultDto } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { AddWalkInData, AddWalkInDialog } from './add-walk-in.dialog';

const added = { attendee: { name: 'Mira Chen' }, reused: false } as WalkInResultDto;

function setup(answer: () => Observable<WalkInResultDto>, data: AddWalkInData = { eventId: 'e1' }) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { addWalkIn: vi.fn(answer) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: CHECK_IN_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(AddWalkInDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const field = (type: string) => host.querySelector<HTMLInputElement>(`input[type="${type}"]`)!;
  const type = (value: string, kind: 'text' | 'email') => {
    field(kind).value = value;
    field(kind).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const primary = () =>
    Array.from(host.querySelectorAll('button')).find((b) =>
      /^(Add|Try again)/.test(b.textContent!.trim()),
    )!;
  const save = async () => {
    primary().click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const toggle = () => {
    host.querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    fixture.detectChanges();
  };
  return { host, ref, service, field, type, primary, save, toggle };
}

describe('AddWalkInDialog', () => {
  it('asks for a name and an optional email, checking them in by default', () => {
    const { host, primary, field } = setup(() => of(added), { eventId: 'e1', name: 'Mira' });

    expect(host.textContent).toContain('Add a walk-in');
    expect(host.textContent).toContain('A member’s email links the check-in to their profile.');
    expect(field('text').value).toBe('Mira');
    expect(host.querySelector<HTMLInputElement>('input[role="switch"]')!.checked).toBe(true);
    expect(primary().textContent!.trim()).toBe('Add and check in');
  });

  it('sends the trimmed walk-in and closes with the result', async () => {
    const { ref, service, type, save } = setup(() => of(added));

    type(' Mira Chen ', 'text');
    type(' mira.chen@example.org ', 'email');
    await save();

    expect(service.addWalkIn).toHaveBeenCalledWith('e1', {
      name: 'Mira Chen',
      email: 'mira.chen@example.org',
      checkInNow: true,
    });
    expect(ref.close).toHaveBeenCalledWith(added);
  });

  it('reads “Add walk-in” and sends checkInNow false when the switch is off', async () => {
    const { service, type, toggle, primary, save } = setup(() => of(added));

    type('Ben Carter', 'text');
    toggle();
    expect(primary().textContent!.trim()).toBe('Add walk-in');
    await save();

    expect(service.addWalkIn).toHaveBeenCalledWith('e1', {
      name: 'Ben Carter',
      email: null,
      checkInNow: false,
    });
  });

  it('shows inline errors and sends nothing without a name or with a bad email', async () => {
    const { host, service, type, save } = setup(() => of(added));

    type('mira.chen@', 'email');
    await save();

    expect(service.addWalkIn).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Enter their name so the list shows who came.');
    expect(host.textContent).toContain('Enter an email like name@example.com, or leave it empty.');
  });

  it('shows the server’s field errors', async () => {
    const { host, type, save } = setup(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: { Name: ['Use 100 characters or fewer for the name.'] } },
          }),
      ),
    );

    type('Mira', 'text');
    await save();

    expect(host.textContent).toContain('Use 100 characters or fewer for the name.');
  });

  it('keeps the input and offers Try again when the save fails', async () => {
    const { host, ref, type, primary, save } = setup(() => throwError(() => new Error('offline')));

    type('Mira Chen', 'text');
    await save();

    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Walk-in not added');
    expect(host.textContent).toContain('Mira Chen is not on the list yet; try again.');
    expect(primary().textContent!.trim()).toBe('Try again');
  });
});
