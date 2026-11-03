// Traces to: L2-052
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { apiTestProviders } from '../shared/api-test-providers';
import { ACCOUNT_SERVICE, AccountUpdated } from './account.service';
import { HttpAccountService } from './http-account.service';

describe('HttpAccountService', () => {
  let service: HttpAccountService;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...apiTestProviders(),
        { provide: ACCOUNT_SERVICE, useClass: HttpAccountService },
      ],
    });
    service = TestBed.inject(ACCOUNT_SERVICE) as HttpAccountService;
    controller = TestBed.inject(HttpTestingController);
  });

  it('saves the account and returns where the link went', () => {
    let updated: AccountUpdated | undefined;
    service.update({ email: 'grace.o@example.org' }).subscribe((u) => (updated = u));

    const req = controller.expectOne('/api/account');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ email: 'grace.o@example.org' });
    req.flush({ pendingEmail: 'grace.o@example.org', passwordChanged: false });
    expect(updated).toEqual({ pendingEmail: 'grace.o@example.org', passwordChanged: false });
  });

  it('confirms an email change with the link’s user, address and token', () => {
    let done = false;
    service.confirmEmailChange('u1', 'grace.o@example.org', 't1').subscribe(() => (done = true));

    const req = controller.expectOne('/api/account/confirm-email-change');
    expect(req.request.body).toEqual({ userId: 'u1', email: 'grace.o@example.org', token: 't1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBe(true);
  });

  it('signs out everywhere', () => {
    let done = false;
    service.signOutEverywhere().subscribe(() => (done = true));

    const req = controller.expectOne('/api/account/sign-out-everywhere');
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBe(true);
  });
});
