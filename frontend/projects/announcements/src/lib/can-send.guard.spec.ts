// Traces to: L2-029 AC3
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AUTH_SERVICE, Role } from '@faithtech-community/api';

import { canSendAnnouncements } from './can-send.guard';

function run(roles: Role[]) {
  TestBed.configureTestingModule({
    providers: [{ provide: AUTH_SERVICE, useValue: { roles: signal(roles) } }],
  });
  return TestBed.runInInjectionContext(() =>
    canSendAnnouncements({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}

describe('canSendAnnouncements', () => {
  it.each<Role[]>([['CommunicationsLead'], ['SystemAdmin'], ['Volunteer', 'CommunicationsLead']])(
    'lets %s compose',
    (...roles) => {
      expect(run(roles)).toBe(true);
    },
  );

  it.each<Role[]>([[], ['CityLead'], ['Staff']])('sends %s to the forbidden page', (...roles) => {
    const result = run(roles);

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });
});
