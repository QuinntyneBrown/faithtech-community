// Traces to: L2-052 AC3
import { DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { ACCOUNT_SERVICE } from '@faithtech-community/api';
import { Observable, of, throwError } from 'rxjs';

import { SignOutEverywhereDialog } from './sign-out-everywhere.dialog';

function setup(signOutEverywhere: () => Observable<void> = () => of(undefined)) {
  const ref = { close: vi.fn() };
  const account = { signOutEverywhere: vi.fn(signOutEverywhere) };
  TestBed.configureTestingModule({
    providers: [
      { provide: DialogRef, useValue: ref },
      { provide: ACCOUNT_SERVICE, useValue: account },
    ],
  });
  const fixture = TestBed.createComponent(SignOutEverywhereDialog);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim().endsWith(name))!;
  return { fixture, ref, account, host, button };
}

describe('SignOutEverywhereDialog', () => {
  it('says every session on every device ends, including this one', () => {
    const { host } = setup();
    expect(host.textContent).toContain('Sign out everywhere?');
    expect(host.textContent).toContain(
      'This ends every session on every device, including this one.',
    );
  });

  it('Cancel closes without signing anyone out', () => {
    const { ref, account, button } = setup();
    button('Cancel').click();
    expect(ref.close).toHaveBeenCalledWith();
    expect(account.signOutEverywhere).not.toHaveBeenCalled();
  });

  it('confirming revokes every session and closes with true', async () => {
    const { fixture, ref, account, button } = setup();
    button('Sign out everywhere').click();
    await fixture.whenStable();
    expect(account.signOutEverywhere).toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('stays open and says the member is still signed in when it fails', async () => {
    const { fixture, ref, host, button } = setup(() => throwError(() => new Error('down')));
    button('Sign out everywhere').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Devices not signed out');
  });
});
