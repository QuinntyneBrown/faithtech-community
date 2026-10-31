import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AUTH_SERVICE, Capability } from '@faithtech-community/api';

import { capabilityGuard } from './capability.guard';

describe('capabilityGuard', () => {
  function run(held: Capability[]): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [{ provide: AUTH_SERVICE, useValue: { capabilities: signal(held) } }],
    });
    const guard = capabilityGuard('ManageRoles', 'ManageOrganisationSettings');
    return TestBed.runInInjectionContext(
      () =>
        guard({} as ActivatedRouteSnapshot, { url: '/organisation' } as RouterStateSnapshot) as
          boolean | UrlTree,
    );
  }

  it('lets in a holder of any of the capabilities', () => {
    expect(run(['ManageOrganisationSettings'])).toBe(true);
    TestBed.resetTestingModule();
    expect(run(['ManageRoles'])).toBe(true);
    TestBed.resetTestingModule();
    expect(run(['AdministerOrganisation'])).toBe(true);
  });

  it('sends anyone else to the forbidden page', () => {
    const result = run(['ViewReports']);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });
});
