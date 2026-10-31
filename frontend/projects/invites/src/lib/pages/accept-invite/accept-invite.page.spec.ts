import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  AUTH_SERVICE,
  CurrentUser,
  InviteLookupDto,
  INVITES_SERVICE,
  SITE_SERVICE,
} from '@faithtech-community/api';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AcceptInvitePage } from './accept-invite.page';

/** The host's organisation the copy names, as GET /api/site answers it on FaithTech's host. */
const FAITHTECH_SITE = {
  site: () => ({
    name: 'FaithTech Community',
    shortName: 'FaithTech',
    chapterLabel: { singular: 'City', plural: 'Cities' },
    communityOrigin: 'http://localhost:4200',
  }),
  load: async () => undefined,
};

const invite: InviteLookupDto = {
  status: 'Pending',
  email: 'ruth.alvarez@example.org',
  inviterName: 'Grace Okonkwo',
  inviterCity: 'Toronto',
  preassignedRole: 'Volunteer',
  hasAccount: false,
};

function user(email: string): CurrentUser {
  return { id: 'u1', profileId: 'p1', name: 'Jonah Bell', email, emailVerified: true, roles: [] };
}

async function setup(
  lookup: () => Observable<InviteLookupDto>,
  signedIn: CurrentUser | null = null,
) {
  const invites = { getInvite: vi.fn(lookup), acceptInvite: vi.fn(() => of(undefined)) };
  const auth = {
    isAuthenticated: signal(signedIn !== null),
    currentUser: signal(signedIn),
    signIn: vi.fn(async () => undefined),
    signInWithPassword: vi.fn(() => of({ succeeded: true as const, emailVerified: true })),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: SITE_SERVICE, useValue: FAITHTECH_SITE },
      provideRouter([]),
      { provide: INVITES_SERVICE, useValue: invites },
      { provide: AUTH_SERVICE, useValue: auth },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(AcceptInvitePage);
  fixture.componentRef.setInput('token', 'tok');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  const host = fixture.nativeElement as HTMLElement;
  const button = (name: string) =>
    Array.from(host.querySelectorAll<HTMLElement>('button, a')).find(
      (b) => b.textContent?.trim() === name,
    );
  const type = (label: string, value: string) => {
    const field = Array.from(host.querySelectorAll('ft-form-field')).find((f) =>
      f.querySelector('label')?.textContent?.includes(label),
    )!;
    const input = field.querySelector('input')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  return { fixture, host, invites, auth, navigate, button, type, settle };
}

describe('AcceptInvitePage', () => {
  it('shows who invited the newcomer, with the invited email fixed', async () => {
    const { host } = await setup(() => of(invite));

    expect(host.querySelector('h1')!.textContent).toContain('You’re invited');
    expect(host.textContent!.replace(/\s+/g, ' ')).toContain(
      'Grace Okonkwo invited you to join FaithTech Toronto as a Volunteer',
    );
    expect(host.textContent).toContain('Volunteer');
    const email = host.querySelector<HTMLInputElement>('input[type="email"]')!;
    expect(email.value).toBe('ruth.alvarez@example.org');
    expect(email.readOnly).toBe(true);
  });

  it('checks the password before accepting', async () => {
    const { host, invites, button, type, settle } = await setup(() => of(invite));
    type('Full name', 'Ruth Alvarez');
    type('Create a password', 'short');
    button('Accept and join')!.click();
    await settle();

    expect(host.textContent).toContain('Fix 1 thing to accept the invite');
    expect(host.textContent).toContain('Use at least 12 characters.');
    expect(invites.acceptInvite).not.toHaveBeenCalled();
  });

  it('creates the account, then signs the new member in', async () => {
    const { invites, auth, button, type, settle } = await setup(() => of(invite));
    type('Full name', 'Ruth Alvarez');
    type('Create a password', 'a-long-enough-passphrase');
    button('Accept and join')!.click();
    await settle();

    expect(invites.acceptInvite).toHaveBeenCalledWith('tok', {
      name: 'Ruth Alvarez',
      password: 'a-long-enough-passphrase',
    });
    expect(auth.signInWithPassword).toHaveBeenCalledWith(
      'ruth.alvarez@example.org',
      'a-long-enough-passphrase',
    );
    expect(auth.signIn).toHaveBeenCalledWith('/people/me');
  });

  it('asks an existing member to sign in to accept', async () => {
    const { host, auth, button } = await setup(() => of({ ...invite, hasAccount: true }));

    expect(host.textContent).toContain('already has a FaithTech account');
    button('Sign in to accept')!.click();
    expect(auth.signIn).toHaveBeenCalledWith('/accept-invite/tok');
  });

  it('adds the role to the signed-in account with the invited email', async () => {
    const { host, invites, navigate, button, settle } = await setup(
      () => of({ ...invite, hasAccount: true }),
      user('Ruth.Alvarez@example.org'),
    );
    expect(host.textContent!.replace(/\s+/g, ' ')).toContain(
      'Accepting adds the Volunteer role to your account.',
    );

    button('Accept invite')!.click();
    await settle();

    expect(invites.acceptInvite).toHaveBeenCalledWith('tok');
    expect(navigate).toHaveBeenCalledWith('/people/me');
  });

  it('refuses a signed-in account with another email', async () => {
    const { host, button } = await setup(() => of(invite), user('jonah@example.org'));
    expect(host.querySelector('h1')!.textContent).toContain('This invite is for another email');
    expect(button('Accept invite')).toBeUndefined();
  });

  it.each([
    ['Expired', 'This invite has expired'],
    ['Accepted', 'This invite has already been used'],
    ['Revoked', 'This invite was withdrawn'],
  ] as const)('shows an error with a sign-up link for a %s invite', async (status, heading) => {
    const { host, button } = await setup(() => of({ ...invite, status }));
    expect(host.querySelector('h1')!.textContent).toContain(heading);
    expect(button('Create an account')!.getAttribute('href')).toBe('/sign-up');
  });

  it('treats an unknown token as an invalid link', async () => {
    const { host } = await setup(() => throwError(() => new HttpErrorResponse({ status: 404 })));
    expect(host.querySelector('h1')!.textContent).toContain('This invite link isn’t valid');
  });

  it('reads Joining… while the invite is being accepted', async () => {
    const { fixture, host, invites, button, type } = await setup(() => of(invite));
    invites.acceptInvite.mockReturnValue(new Subject<undefined>());
    type('Full name', 'Ruth Alvarez');
    type('Create a password', 'a-long-enough-passphrase');
    button('Accept and join')!.click();
    fixture.detectChanges();
    expect(host.querySelector('button[aria-busy="true"]')!.textContent!.trim()).toBe('Joining…');
  });
});
