// Traces to: L2-057
import { TestBed } from '@angular/core/testing';
import { AUTH_SERVICE } from '@faithtech-community/api';

import { AuthContinuePage } from './auth-continue.page';

describe('AuthContinuePage', () => {
  let started: [string, boolean][];

  beforeEach(() => {
    started = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AUTH_SERVICE,
          useValue: {
            signIn: (url: string, keep: boolean) => {
              started.push([url, keep]);
              return Promise.resolve();
            },
          },
        },
      ],
    });
  });

  async function open(returnUrl: string, keepSignedIn: string) {
    const fixture = TestBed.createComponent(AuthContinuePage);
    fixture.componentRef.setInput('returnUrl', returnUrl);
    fixture.componentRef.setInput('keepSignedIn', keepSignedIn);
    await fixture.whenStable();
  }

  it('starts PKCE for the page asked for, keeping the session when asked', async () => {
    await open('/events', '1');

    expect(started).toEqual([['/events', true]]);
  });

  it('lands on home when the return url is not an app path', async () => {
    await open('https://evil.example', '0');

    expect(started).toEqual([['/', false]]);
  });
});
