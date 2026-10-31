/*
 * EARLY IMPLEMENTATION: written ahead of the vertical slices to get a head start.
 * Contracts and DTOs follow docs/detailed-designs/ but may change as each feature is
 * implemented end to end (spec -> design -> mock -> ATDD slice).
 * Sources:
 *   - docs/detailed-designs/platform/error-and-system-pages
 */
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AUTH_SERVICE } from '../auth/auth.service';

import {
  HANDLES_FORBIDDEN,
  HANDLES_SERVER_ERROR,
  httpErrorInterceptor,
} from './http-error.interceptor';
import { problemDetails } from './problem-details';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;
  let loadCurrentUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigate = vi.fn();
    loadCurrentUser = vi.fn(() => of(null));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
        { provide: AUTH_SERVICE, useValue: { loadCurrentUser } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  it('sends 403 to the forbidden page and still surfaces the error', () => {
    let status = 0;
    http.get('/api/x').subscribe({ error: (e) => (status = e.status) });

    controller.expectOne('/api/x').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(navigate).toHaveBeenCalledWith(['/forbidden']);
    expect(status).toBe(403);
  });

  it('leaves 403 to a caller that shows its own forbidden state', () => {
    let status = 0;
    http
      .get('/api/x', { context: new HttpContext().set(HANDLES_FORBIDDEN, true) })
      .subscribe({ error: (e) => (status = e.status) });

    controller.expectOne('/api/x').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(navigate).not.toHaveBeenCalled();
    expect(status).toBe(403);
  });

  // L2-133 AC5: a 403 means the app's idea of the caller's capabilities may be stale.
  it('reloads the current member after a 403, even one the caller handles', () => {
    http.get('/api/x').subscribe({ error: () => undefined });
    http
      .get('/api/y', { context: new HttpContext().set(HANDLES_FORBIDDEN, true) })
      .subscribe({ error: () => undefined });

    controller.expectOne('/api/x').flush({}, { status: 403, statusText: 'Forbidden' });
    controller.expectOne('/api/y').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(loadCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('does not reload the current member when /api/me itself is refused', () => {
    http.get('/api/me').subscribe({ error: () => undefined });

    controller.expectOne('/api/me').flush({}, { status: 403, statusText: 'Forbidden' });

    expect(loadCurrentUser).not.toHaveBeenCalled();
  });

  it('leaves 500 to a caller that ignores its own failure', () => {
    let status = 0;
    http
      .get('/api/x', { context: new HttpContext().set(HANDLES_SERVER_ERROR, true) })
      .subscribe({ error: (e) => (status = e.status) });

    controller.expectOne('/api/x').flush({}, { status: 500, statusText: 'Server Error' });

    expect(navigate).not.toHaveBeenCalled();
    expect(status).toBe(500);
  });

  it('sends 500 to the error page with the correlation id as reference', () => {
    http.get('/api/x').subscribe({ error: () => undefined });

    controller
      .expectOne('/api/x')
      .flush(
        {},
        { status: 500, statusText: 'Server Error', headers: { 'X-Correlation-ID': 'abc-123' } },
      );

    expect(navigate).toHaveBeenCalledWith(['/error'], { state: { referenceId: 'abc-123' } });
  });

  it.each([400, 404, 409, 429])('leaves %i to the calling page', (code) => {
    http.get('/api/x').subscribe({ error: () => undefined });

    controller.expectOne('/api/x').flush({}, { status: code, statusText: 'x' });

    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('problemDetails', () => {
  it('returns the problem body of an HTTP error response', () => {
    const err = { status: 400, error: { title: 'Invalid', errors: { name: ['Required'] } } };

    expect(problemDetails(err)?.errors).toEqual({ name: ['Required'] });
  });

  it('returns null for anything else', () => {
    expect(problemDetails(new Error('boom'))).toBeNull();
  });
});
