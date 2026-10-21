import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ADMIN_USERS_SERVICE } from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { SuspendUserData, SuspendUserDialog } from './suspend-user.dialog';

const data: SuspendUserData = { id: 'p7', name: 'Leah Thompson' };

function setup(suspend: (id: string, reason: string) => Observable<void>) {
  const ref = { close: vi.fn(), disableClose: false };
  const service = { suspend: vi.fn(suspend) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DIALOG_DATA, useValue: data },
      { provide: DialogRef, useValue: ref },
      { provide: ADMIN_USERS_SERVICE, useValue: service },
    ],
  });
  const fixture = TestBed.createComponent(SuspendUserDialog);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === name)!;
  const type = (value: string) => {
    const reason = host.querySelector('textarea')!;
    reason.value = value;
    reason.dispatchEvent(new Event('input'));
  };
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fixture, host, ref, service, button, type, settle };
}

describe('SuspendUserDialog', () => {
  it('makes the reason read-only while suspending', async () => {
    const pending = new Subject<void>();
    const { fixture, host, button, type, settle } = setup(() => pending);
    type('Repeated spam event listings after a warning.');
    button('Suspend').click();
    fixture.detectChanges();
    expect(host.querySelector('textarea')!.readOnly).toBe(true);
    expect(host.querySelector('button[aria-busy="true"]')!.textContent!.trim()).toBe('Suspending…');

    pending.error(new Error('offline'));
    await settle();
    expect(host.querySelector('textarea')!.readOnly).toBe(false);
  });

  it('asks to confirm and explains what suspension does', () => {
    const { host } = setup(() => of(undefined));
    expect(host.querySelector('h2')!.textContent).toContain('Suspend Leah Thompson?');
    expect(host.textContent).toContain('signed out everywhere');
    expect(host.querySelector('label')!.textContent).toContain(
      'Reason (recorded in the audit log)',
    );
  });

  it('needs a reason', async () => {
    const { host, service, button, settle } = setup(() => of(undefined));
    button('Suspend').click();
    await settle();
    expect(host.textContent).toContain('Give a reason so other admins understand.');
    expect(service.suspend).not.toHaveBeenCalled();
  });

  it('suspends with the reason and closes with true', async () => {
    const { ref, service, button, type, settle } = setup(() => of(undefined));
    type('Repeated spam event listings after a warning.');
    button('Suspend').click();
    await settle();
    expect(service.suspend).toHaveBeenCalledWith(
      'p7',
      'Repeated spam event listings after a warning.',
    );
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('shows the server’s refusal', async () => {
    const { host, ref, button, type, settle } = setup(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { detail: 'You can’t suspend your own account.' },
          }),
      ),
    );
    type('Testing');
    button('Suspend').click();
    await settle();
    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('You can’t suspend your own account.');
    expect(host.querySelector('ft-alert')!.textContent).toContain('Account not suspended');
  });

  it('says it didn’t work when FaithTech can’t be reached', async () => {
    const { host, button, type, settle } = setup(() => throwError(() => new Error('offline')));
    type('Spam');
    button('Suspend').click();
    await settle();
    expect(host.querySelector('ft-alert')!.textContent).toContain('Account not suspended');
  });
});
